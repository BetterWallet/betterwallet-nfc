"""Reusable NFC, pairing, and signing helpers for GUI wallet flows."""

from __future__ import annotations

import base64
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

from eth_account import Account
from nacl.signing import SigningKey

from protocol import read_payload, select_aid, write_payload
from setup import nfc, setup
from wallet_keys import SEPOLIA_CHAIN_ID, SOLANA_CLUSTER, EvmKeypair, SolanaKeypair

STATUS_TIMEOUT = "timeout"
STATUS_STOPPED = "stopped"
STATUS_READY = "ready"
STATUS_ERROR = "error"


@dataclass
class SignReview:
    request: dict[str, Any]
    chain: str
    title: str
    lines: list[str]
    raw_preview: str


def parse_int(value: object, field_name: str) -> int:
    if value is None:
        raise ValueError(f"Missing required field: {field_name}")
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            raise ValueError(f"Field {field_name} is empty")
        if normalized.startswith("0x") or normalized.startswith("0X"):
            return int(normalized, 16)
        return int(normalized, 10)
    raise ValueError(f"Field {field_name} must be a string or number")


def format_eth_from_wei(value_wei: int) -> str:
    whole, remainder = divmod(value_wei, 10**18)
    if remainder == 0:
        return f"{whole}"
    frac = str(remainder).rjust(18, "0").rstrip("0")
    return f"{whole}.{frac}"


class NfcWalletService:
    def __init__(self) -> None:
        self._is_setup = False

    def ensure_hardware_ready(self) -> None:
        if self._is_setup:
            return
        setup()
        self._is_setup = True

    def _wait_for_card(self, stop_event=None, timeout_s: float = 45.0) -> str:
        start = time.time()
        while True:
            if stop_event and stop_event.is_set():
                return STATUS_STOPPED
            if nfc.inListPassiveTarget():
                return STATUS_READY
            if time.time() - start > timeout_s:
                return STATUS_TIMEOUT
            time.sleep(0.15)

    def wait_for_json_request(self, stop_event=None, timeout_s: float = 45.0) -> tuple[str, dict[str, Any] | None]:
        self.ensure_hardware_ready()
        status = self._wait_for_card(stop_event=stop_event, timeout_s=timeout_s)
        if status != STATUS_READY:
            return status, None
        if not select_aid():
            return STATUS_ERROR, {"message": "SELECT AID failed during tap 1."}
        try:
            payload = read_payload()
            request = json.loads(payload.decode("utf-8"))
            if not isinstance(request, dict):
                raise ValueError("Request payload must be a JSON object")
            return STATUS_READY, request
        except Exception as exc:  # noqa: BLE001 - UI caller displays error message
            return STATUS_ERROR, {"message": f"Unable to parse NFC payload: {exc}"}

    def send_json_response(
        self,
        payload: dict[str, Any],
        stop_event=None,
        timeout_s: float = 45.0,
    ) -> tuple[bool, str]:
        self.ensure_hardware_ready()
        time.sleep(0.75)
        status = self._wait_for_card(stop_event=stop_event, timeout_s=timeout_s)
        if status == STATUS_STOPPED:
            return False, "Cancelled while waiting for tap 2."
        if status == STATUS_TIMEOUT:
            return False, "Timed out waiting for tap 2."
        if not select_aid():
            return False, "SELECT AID failed during tap 2."
        try:
            write_payload(json.dumps(payload).encode("utf-8"))
            return True, "Response sent."
        except Exception as exc:  # noqa: BLE001
            return False, f"Unable to send NFC response: {exc}"

    def is_pair_request(self, request: dict[str, Any]) -> bool:
        return request.get("type") == "pair_request"

    def is_sign_request(self, request: dict[str, Any]) -> bool:
        return request.get("type") == "sign_request"

    def build_pair_response(
        self,
        request: dict[str, Any],
        evm_keypair: EvmKeypair,
        solana_keypair: SolanaKeypair,
    ) -> dict[str, Any]:
        if request.get("type") != "pair_request":
            return {"type": "pair_error", "reason": "Unsupported request type"}

        chain = request.get("chain")
        if chain == "evm":
            chain_id = request.get("chainId")
            if chain_id != SEPOLIA_CHAIN_ID:
                return {
                    "type": "pair_error",
                    "reason": f"Unsupported EVM chainId {chain_id}. Expected {SEPOLIA_CHAIN_ID}.",
                }
            return {
                "type": "pair_response",
                "protocolVersion": 1,
                "chain": "evm",
                "chainId": SEPOLIA_CHAIN_ID,
                "address": evm_keypair.address,
                "publicKey": evm_keypair.public_key,
            }

        if chain == "solana":
            cluster = request.get("cluster", SOLANA_CLUSTER)
            if cluster != SOLANA_CLUSTER:
                return {
                    "type": "pair_error",
                    "reason": f"Unsupported Solana cluster {cluster}. Expected {SOLANA_CLUSTER}.",
                }
            return {
                "type": "pair_response",
                "protocolVersion": 1,
                "chain": "solana",
                "cluster": SOLANA_CLUSTER,
                "address": solana_keypair.address,
                "publicKey": solana_keypair.public_key_hex,
            }

        return {"type": "pair_error", "reason": f"Unsupported chain {chain}"}

    def build_sign_review(
        self,
        request: dict[str, Any],
        evm_keypair: EvmKeypair,
        solana_keypair: SolanaKeypair,
    ) -> SignReview:
        chain = str(request.get("chain") or "evm")
        if chain == "solana":
            return self._build_solana_review(request, solana_keypair)
        return self._build_evm_review(request, evm_keypair)

    def build_signed_response(
        self,
        request: dict[str, Any],
        evm_keypair: EvmKeypair,
        solana_keypair: SolanaKeypair,
    ) -> dict[str, Any]:
        chain = str(request.get("chain") or "evm")
        if chain == "solana":
            return self._build_solana_signed_response(request, solana_keypair)
        return self._build_evm_signed_response(request, evm_keypair)

    def build_reject_response(self, request: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": request.get("id"),
            "type": "sign_rejected",
            "reason": "Rejected by hardware wallet user",
        }

    def _build_evm_review(self, request: dict[str, Any], keypair: EvmKeypair) -> SignReview:
        if "id" not in request or "tx" not in request:
            raise ValueError("Malformed sign_request. Missing id or tx.")
        raw = base64.b64decode(str(request["tx"]))
        unsigned_tx = json.loads(raw.decode("utf-8"))
        if not isinstance(unsigned_tx, dict):
            raise ValueError("EVM tx payload must decode to a JSON object.")

        required_fields = [
            "to",
            "valueWei",
            "gasLimit",
            "maxFeePerGasWei",
            "maxPriorityFeePerGasWei",
        ]
        for field in required_fields:
            if field not in unsigned_tx:
                raise ValueError(f"Unsigned tx missing field: {field}")

        from_address = unsigned_tx.get("from")
        if isinstance(from_address, str) and from_address.strip():
            if from_address.lower().strip() != keypair.address.lower():
                raise ValueError(
                    f"Refusing to sign from {from_address}. Wallet address is {keypair.address}."
                )

        nonce = parse_int(unsigned_tx.get("nonce"), "nonce")
        value_wei = parse_int(unsigned_tx["valueWei"], "valueWei")
        gas_limit = parse_int(unsigned_tx["gasLimit"], "gasLimit")
        max_fee = parse_int(unsigned_tx["maxFeePerGasWei"], "maxFeePerGasWei")
        max_priority_fee = parse_int(unsigned_tx["maxPriorityFeePerGasWei"], "maxPriorityFeePerGasWei")
        data_hex = str(unsigned_tx.get("data") or unsigned_tx.get("calldata") or "0x")

        lines = [
            f"Request ID: {request['id']}",
            f"Chain: Ethereum Sepolia ({SEPOLIA_CHAIN_ID})",
            f"Signer: {keypair.address}",
            f"To: {unsigned_tx['to']}",
            f"Nonce: {nonce}",
            f"Value: {value_wei} wei ({format_eth_from_wei(value_wei)} ETH)",
            f"Gas Limit: {gas_limit}",
            f"Max Fee/Gas: {max_fee} wei",
            f"Max Priority Fee/Gas: {max_priority_fee} wei",
            f"Calldata: {data_hex[:64]}{'...' if len(data_hex) > 64 else ''}",
        ]
        raw_preview = json.dumps(unsigned_tx, indent=2, sort_keys=True)
        return SignReview(
            request=request,
            chain="evm",
            title="Sign Ethereum Transaction",
            lines=lines,
            raw_preview=raw_preview,
        )

    def _build_solana_review(self, request: dict[str, Any], keypair: SolanaKeypair) -> SignReview:
        if "id" not in request or "tx" not in request:
            raise ValueError("Malformed Solana sign_request. Missing id or tx.")
        tx_bytes = base64.b64decode(str(request["tx"]))
        digest = hashlib.sha256(tx_bytes).hexdigest()
        summary = request.get("summary")
        lines = [
            f"Request ID: {request['id']}",
            f"Chain: Solana {SOLANA_CLUSTER}",
            f"Signer: {keypair.address}",
            f"Tx Size: {len(tx_bytes)} bytes",
            f"SHA256: {digest}",
        ]
        if isinstance(summary, dict):
            for key, value in summary.items():
                lines.append(f"{key}: {value}")
        raw_preview = json.dumps({"txBase64": request["tx"], "summary": summary}, indent=2, sort_keys=True)
        return SignReview(
            request=request,
            chain="solana",
            title="Sign Solana Transaction",
            lines=lines,
            raw_preview=raw_preview,
        )

    def _build_evm_signed_response(self, request: dict[str, Any], keypair: EvmKeypair) -> dict[str, Any]:
        raw = base64.b64decode(str(request["tx"]))
        unsigned_tx = json.loads(raw.decode("utf-8"))
        nonce = parse_int(unsigned_tx.get("nonce"), "nonce")

        tx_dict: dict[str, Any] = {
            "type": 2,
            "chainId": SEPOLIA_CHAIN_ID,
            "nonce": nonce,
            "to": unsigned_tx["to"],
            "value": parse_int(unsigned_tx["valueWei"], "valueWei"),
            "gas": parse_int(unsigned_tx["gasLimit"], "gasLimit"),
            "maxFeePerGas": parse_int(unsigned_tx["maxFeePerGasWei"], "maxFeePerGasWei"),
            "maxPriorityFeePerGas": parse_int(
                unsigned_tx["maxPriorityFeePerGasWei"], "maxPriorityFeePerGasWei"
            ),
        }

        data_hex = unsigned_tx.get("data") or unsigned_tx.get("calldata")
        if isinstance(data_hex, str) and data_hex.strip():
            tx_dict["data"] = data_hex

        signed = Account.sign_transaction(tx_dict, keypair.private_key)
        raw_hex = signed.raw_transaction.hex()
        signature = raw_hex if raw_hex.startswith("0x") else f"0x{raw_hex}"
        return {
            "id": request["id"],
            "type": "signed_tx",
            "chain": "evm",
            "chainId": SEPOLIA_CHAIN_ID,
            "signature": signature,
        }

    def _build_solana_signed_response(self, request: dict[str, Any], keypair: SolanaKeypair) -> dict[str, Any]:
        tx_bytes = base64.b64decode(str(request["tx"]))
        signing_key = SigningKey(bytes.fromhex(keypair.private_key_hex))
        signed = signing_key.sign(tx_bytes)
        signature_b64 = base64.b64encode(signed.signature).decode("ascii")
        signed_payload_b64 = base64.b64encode(signed).decode("ascii")
        return {
            "id": request["id"],
            "type": "signed_tx",
            "chain": "solana",
            "cluster": SOLANA_CLUSTER,
            "signature": signature_b64,
            "signedTx": signed_payload_b64,
        }
