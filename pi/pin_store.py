"""PIN enrollment and verification for BetterWallet."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
from pathlib import Path

PIN_STORE_PATH = Path.home() / ".betterwallet" / "pin_store.json"
PIN_DIGITS = 6
PBKDF2_ROUNDS = 200_000
PIN_REGEX = re.compile(r"^\d{6}$")


def _ensure_parent_dir() -> None:
    PIN_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _pin_hash(pin: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, PBKDF2_ROUNDS)


def is_valid_pin(pin: str) -> bool:
    return bool(PIN_REGEX.fullmatch(pin))


def pin_exists() -> bool:
    return PIN_STORE_PATH.exists()


def enroll_pin(pin: str) -> None:
    if not is_valid_pin(pin):
        raise ValueError(f"PIN must be exactly {PIN_DIGITS} digits")

    _ensure_parent_dir()
    salt = secrets.token_bytes(16)
    digest = _pin_hash(pin, salt)
    payload = {
        "pinDigits": PIN_DIGITS,
        "kdf": "pbkdf2_sha256",
        "rounds": PBKDF2_ROUNDS,
        "saltB64": base64.b64encode(salt).decode("ascii"),
        "hashB64": base64.b64encode(digest).decode("ascii"),
    }
    PIN_STORE_PATH.write_text(json.dumps(payload, indent=2))


def verify_pin(pin: str) -> bool:
    if not is_valid_pin(pin):
        return False
    if not pin_exists():
        return False

    data = json.loads(PIN_STORE_PATH.read_text())
    salt = base64.b64decode(data["saltB64"])
    expected_hash = base64.b64decode(data["hashB64"])
    rounds = int(data.get("rounds", PBKDF2_ROUNDS))
    actual_hash = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, rounds)
    return hmac.compare_digest(expected_hash, actual_hash)
