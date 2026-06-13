import json
import time

from eth_account import Account
from eth_account.messages import encode_typed_data

import sign_wallet
from pairing_wallet import SEPOLIA_CHAIN_ID, load_or_create_keypair
from setup import setup

try:
    from clearsig import Registry, translate_with_registry
    from clearsig._calldata_digest import calldata_digest_hex
    from clearsig._validate import sanitize_for_terminal
except ImportError as exc:
    raise RuntimeError(
        "Missing dependency 'clearsig'. Install with: pip install --ignore-requires-python clearsig"
    ) from exc

try:
    from eth_account.messages import encode_structured_data
except ImportError:
    encode_structured_data = None


def log(message: str) -> None:
    print(f"[clear-signing] {message}")


# Reuse the existing NFC tap protocol helpers and override their logger prefix.
sign_wallet.log = log
read_phone_payload = sign_wallet.read_phone_payload
send_response = sign_wallet.send_response
decode_unsigned_tx = sign_wallet.decode_unsigned_tx
parse_int = sign_wallet.parse_int
resolve_nonce = sign_wallet.resolve_nonce

_registry: Registry | None = None


def ensure_registry() -> Registry:
    global _registry
    if _registry is not None:
        return _registry

    try:
        _registry = Registry.load()
    except ValueError:
        # Keep signing path offline at runtime; pre-download registry during setup.
        raise RuntimeError(
            "ERC-7730 registry not found locally. Offline mode enabled; "
            "run setup to pre-download registry."
        )
    return _registry


def normalize_calldata(unsigned_tx: dict) -> str:
    raw = unsigned_tx.get("data")
    if raw is None:
        raw = unsigned_tx.get("calldata")
    if raw is None:
        return "0x"
    if not isinstance(raw, str):
        raise ValueError("Unsigned tx field data/calldata must be a hex string")

    normalized = raw.strip()
    if not normalized:
        return "0x"
    if normalized.startswith("0x") or normalized.startswith("0X"):
        hex_body = normalized[2:]
    else:
        hex_body = normalized
    if len(hex_body) % 2 != 0:
        raise ValueError("Calldata hex length must be even")
    bytes.fromhex(hex_body)
    return f"0x{hex_body.lower()}"


def format_eth_from_wei(value_wei: int) -> str:
    whole, remainder = divmod(value_wei, 10**18)
    if remainder == 0:
        return f"{whole}"
    frac = str(remainder).rjust(18, "0").rstrip("0")
    return f"{whole}.{frac}"


def display_clear_signing_review(unsigned_tx: dict, keypair: dict[str, str]) -> str:
    signer_address = keypair["address"]
    nonce = resolve_nonce(unsigned_tx)
    value_wei = parse_int(unsigned_tx["valueWei"], "valueWei")
    gas_limit = parse_int(unsigned_tx["gasLimit"], "gasLimit")
    max_fee = parse_int(unsigned_tx["maxFeePerGasWei"], "maxFeePerGasWei")
    max_priority_fee = parse_int(unsigned_tx["maxPriorityFeePerGasWei"], "maxPriorityFeePerGasWei")
    calldata_hex = normalize_calldata(unsigned_tx)

    log("--- Transaction review ---")
    log(f"Signer: {signer_address}")
    log(f"To: {unsigned_tx['to']}")
    log(f"Chain ID: {SEPOLIA_CHAIN_ID}")
    log(f"Nonce: {nonce}")
    log(f"Value: {format_eth_from_wei(value_wei)} ETH")
    log(f"Gas limit: {gas_limit}")
    log(f"Max fee per gas: {max_fee / 1e9:.9f} gwei")
    log(f"Max priority fee per gas: {max_priority_fee / 1e9:.9f} gwei")
    log(f"Unsigned tx JSON: {json.dumps(unsigned_tx, sort_keys=True)}")

    digest = calldata_digest_hex(calldata_hex)
    log(f"ERC-8213 calldata digest: {digest}")

    calldata_bytes = bytes.fromhex(calldata_hex[2:])
    if len(calldata_bytes) < 4:
        log("Intent: Plain ETH transfer")
        return calldata_hex

    try:
        translated = translate_with_registry(
            ensure_registry(),
            calldata_hex,
            to=unsigned_tx["to"],
            chain_id=SEPOLIA_CHAIN_ID,
            from_address=signer_address,
        )
        entity_str = f" ({sanitize_for_terminal(translated.entity)})" if translated.entity else ""
        log(f"Intent: {sanitize_for_terminal(translated.intent)}{entity_str}")
        log(f"Function: {sanitize_for_terminal(translated.function_signature)}")
        for field in translated.fields:
            log(
                f"  {sanitize_for_terminal(field.label)}: "
                f"{sanitize_for_terminal(field.value)}"
            )
    except Exception as exc:  # noqa: BLE001 - continue with raw calldata + digest visibility
        log(f"ERC-7730 decode unavailable: {exc}")

    return calldata_hex


def confirm_signing() -> bool:
    answer = input("Sign this transaction? [y/N]: ").strip().lower()
    return answer in ("y", "yes")


def sign_request_payload(sign_request: dict, keypair: dict[str, str]) -> str | None:
    unsigned_tx = decode_unsigned_tx(sign_request)

    signer_address = keypair["address"]
    from_address = unsigned_tx.get("from")
    if isinstance(from_address, str) and from_address.strip():
        normalized_from = from_address.strip().lower()
        if normalized_from != signer_address.lower():
            raise ValueError(
                f"Refusing to sign for from={from_address}; keystore address is {signer_address}"
            )
    else:
        log("Unsigned tx has no from address; defaulting signer to keystore address")

    calldata_hex = display_clear_signing_review(unsigned_tx, keypair)
    if not confirm_signing():
        log("Transaction rejected by user.")
        return None

    nonce = resolve_nonce(unsigned_tx)
    tx_dict = {
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
    if calldata_hex != "0x":
        tx_dict["data"] = calldata_hex

    signed = Account.sign_transaction(tx_dict, keypair["private_key"])
    raw_hex = signed.raw_transaction.hex()
    signed_raw_tx = raw_hex if raw_hex.startswith("0x") else f"0x{raw_hex}"

    log(f"Sign request id: {sign_request['id']}")
    log(f"Signed raw tx: {signed_raw_tx}")
    return signed_raw_tx


def _stringify_json_compact(value: object) -> str:
    try:
        return json.dumps(value, separators=(",", ":"), sort_keys=True)
    except TypeError:
        return str(value)


def sign_typed_data_payload(request: dict, keypair: dict[str, str]) -> str | None:
    typed_data = request.get("typedData")
    if not isinstance(typed_data, dict):
        raise ValueError("typed_data_sign_request typedData must be an object")

    domain = typed_data.get("domain")
    primary_type = typed_data.get("primaryType")
    message = typed_data.get("message")
    if not isinstance(domain, dict):
        raise ValueError("typedData.domain must be an object")
    if not isinstance(message, dict):
        raise ValueError("typedData.message must be an object")
    if not isinstance(primary_type, str) or not primary_type:
        raise ValueError("typedData.primaryType must be a non-empty string")

    log("--- Typed data review ---")
    log(f"Signer: {keypair['address']}")
    log(f"Primary type: {primary_type}")
    log(f"Domain: {_stringify_json_compact(domain)}")
    log(f"Message: {_stringify_json_compact(message)}")

    if not confirm_signing():
        log("Typed data signing rejected by user.")
        return None

    try:
        signable_message = encode_typed_data(full_message=typed_data)
    except TypeError:
        if encode_structured_data is None:
            raise
        signable_message = encode_structured_data(primitive=typed_data)

    signed = Account.sign_message(signable_message, keypair["private_key"])
    signature_hex = signed.signature.hex()
    signature = signature_hex if signature_hex.startswith("0x") else f"0x{signature_hex}"
    log(f"Typed data request id: {request['id']}")
    log(f"Typed data signature: {signature}")
    return signature


def build_sign_response(request: dict, keypair: dict[str, str]) -> dict | None:
    if "id" not in request:
        raise ValueError("Missing request id")

    payload_type = request.get("type")
    if payload_type == "sign_request":
        if "tx" not in request:
            raise ValueError("Missing sign_request tx")
        signature = sign_request_payload(request, keypair)
        if signature is None:
            return None
        return {"id": request["id"], "type": "signed_tx", "signature": signature}

    if payload_type == "typed_data_sign_request":
        signature = sign_typed_data_payload(request, keypair)
        if signature is None:
            return None
        return {"id": request["id"], "type": "typed_data_signature", "signature": signature}

    raise ValueError(f"Unsupported payload type: {payload_type}")


def main() -> None:
    setup()
    keypair = load_or_create_keypair()
    log("Using paired keystore for Sepolia clear-signing")

    while True:
        request = read_phone_payload()
        if request is None:
            time.sleep(0.5)
            continue

        try:
            response = build_sign_response(request, keypair)
        except Exception as exc:  # noqa: BLE001
            log(f"Signing failed: {exc}")
            log("Waiting for next sign request...\n")
            time.sleep(0.5)
            continue

        if response is None:
            log("Waiting for next sign request...\n")
            time.sleep(0.5)
            continue

        sent = False
        while not sent:
            sent = send_response(response)
            time.sleep(0.5)

        log("Done. Waiting for next sign request...\n")


if __name__ == "__main__":
    main()
