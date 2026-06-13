"""Key management for BetterWallet hardware wallet chains."""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from pathlib import Path

import base58
from eth_keys import keys
from nacl.signing import SigningKey

SEPOLIA_CHAIN_ID = 11155111
SOLANA_CLUSTER = "devnet"

KEYSTORE_DIR = Path.home() / ".betterwallet"
EVM_KEYSTORE_PATH = KEYSTORE_DIR / "evm_sepolia_keypair.json"
SOLANA_KEYSTORE_PATH = KEYSTORE_DIR / "solana_devnet_keypair.json"


@dataclass(frozen=True)
class EvmKeypair:
    private_key: str
    public_key: str
    address: str
    chain: str = "evm"
    chain_id: int = SEPOLIA_CHAIN_ID
    network_name: str = "Sepolia"


@dataclass(frozen=True)
class SolanaKeypair:
    private_key_hex: str
    public_key_hex: str
    address: str
    chain: str = "solana"
    cluster: str = SOLANA_CLUSTER
    network_name: str = "Devnet"


def _normalize_uncompressed_pubkey(pubkey_hex: str) -> str:
    normalized = pubkey_hex.lower().removeprefix("0x")
    if normalized.startswith("04"):
        return f"0x{normalized}"
    return f"0x04{normalized}"


def _ensure_keystore_dir() -> None:
    KEYSTORE_DIR.mkdir(parents=True, exist_ok=True)


def load_or_create_evm_keypair() -> EvmKeypair:
    _ensure_keystore_dir()
    if EVM_KEYSTORE_PATH.exists():
        data = json.loads(EVM_KEYSTORE_PATH.read_text())
        private_key_hex = str(data["private_key"])
        private_key = keys.PrivateKey(bytes.fromhex(private_key_hex.removeprefix("0x")))
        return EvmKeypair(
            private_key=private_key.to_hex(),
            public_key=_normalize_uncompressed_pubkey(private_key.public_key.to_hex()),
            address=private_key.public_key.to_checksum_address(),
        )

    private_key = keys.PrivateKey(secrets.token_bytes(32))
    profile = {
        "private_key": private_key.to_hex(),
        "public_key": _normalize_uncompressed_pubkey(private_key.public_key.to_hex()),
        "address": private_key.public_key.to_checksum_address(),
    }
    EVM_KEYSTORE_PATH.write_text(json.dumps(profile, indent=2))
    return EvmKeypair(**profile)


def load_or_create_solana_keypair() -> SolanaKeypair:
    _ensure_keystore_dir()
    if SOLANA_KEYSTORE_PATH.exists():
        data = json.loads(SOLANA_KEYSTORE_PATH.read_text())
        private_key_hex = str(data["private_key_hex"])
        signing_key = SigningKey(bytes.fromhex(private_key_hex))
        public_key_hex = signing_key.verify_key.encode().hex()
        address = base58.b58encode(signing_key.verify_key.encode()).decode("ascii")
        return SolanaKeypair(
            private_key_hex=private_key_hex.lower(),
            public_key_hex=public_key_hex.lower(),
            address=address,
        )

    signing_key = SigningKey.generate()
    private_key_hex = signing_key.encode().hex()
    public_key_bytes = signing_key.verify_key.encode()
    profile = {
        "private_key_hex": private_key_hex,
        "public_key_hex": public_key_bytes.hex(),
        "address": base58.b58encode(public_key_bytes).decode("ascii"),
    }
    SOLANA_KEYSTORE_PATH.write_text(json.dumps(profile, indent=2))
    return SolanaKeypair(**profile)


def load_or_create_all_keypairs() -> dict[str, EvmKeypair | SolanaKeypair]:
    return {
        "evm": load_or_create_evm_keypair(),
        "solana": load_or_create_solana_keypair(),
    }
