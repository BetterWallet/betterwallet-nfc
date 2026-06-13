import json
import secrets
import time
from pathlib import Path

from eth_keys import keys

from protocol import read_payload, select_aid, write_payload
from setup import nfc, setup

SEPOLIA_CHAIN_ID = 11155111
KEYSTORE_DIR = Path.home() / ".betterwallet"
KEYSTORE_PATH = KEYSTORE_DIR / "evm_sepolia_keypair.json"


def log(message: str) -> None:
    print(f"[pairing] {message}")


def to_uncompressed_pubkey(pubkey_hex: str) -> str:
    """
    Normalize EVM public key to uncompressed format expected by mobile app:
    0x04 + 64-byte X + 64-byte Y (total 130 bytes hex chars incl prefix marker).
    """
    normalized = pubkey_hex.lower().removeprefix("0x")
    if normalized.startswith("04"):
        return f"0x{normalized}"
    return f"0x04{normalized}"


def load_or_create_keypair() -> dict[str, str]:
    KEYSTORE_DIR.mkdir(parents=True, exist_ok=True)

    if KEYSTORE_PATH.exists():
        data = json.loads(KEYSTORE_PATH.read_text())
        private_key_hex = data["private_key"]
        private_key_bytes = bytes.fromhex(private_key_hex.removeprefix("0x"))
        private_key = keys.PrivateKey(private_key_bytes)

        profile = {
            "private_key": private_key.to_hex(),
            "public_key": to_uncompressed_pubkey(private_key.public_key.to_hex()),
            "address": private_key.public_key.to_checksum_address(),
        }
        log(f"Loaded keypair from {KEYSTORE_PATH}")
        log(f"Address: {profile['address']}")
        log(f"Public key length: {len(profile['public_key'])} chars")
        return profile

    private_key_bytes = secrets.token_bytes(32)
    private_key = keys.PrivateKey(private_key_bytes)
    profile = {
        "private_key": private_key.to_hex(),
        "public_key": to_uncompressed_pubkey(private_key.public_key.to_hex()),
        "address": private_key.public_key.to_checksum_address(),
    }
    KEYSTORE_PATH.write_text(json.dumps(profile, indent=2))
    log(f"Created new keypair at {KEYSTORE_PATH}")
    log(f"Address: {profile['address']}")
    log(f"Public key length: {len(profile['public_key'])} chars")
    return profile


def wait_and_select_aid(label: str) -> bool:
    log(f"{label} — waiting for phone tap...")
    if not nfc.inListPassiveTarget():
        return False

    log("Card detected")
    if not select_aid():
        log("SELECT AID failed")
        return False
    return True


def read_phone_payload() -> dict | None:
    if not wait_and_select_aid("TAP 1"):
        return None

    try:
        payload = read_payload()
        message = json.loads(payload.decode("utf-8"))
        log(f"Received payload type={message.get('type')} id={message.get('id')}")
        log(f"Payload JSON: {json.dumps(message, sort_keys=True)}")
        return message
    except Exception as exc:  # noqa: BLE001 - keep script-level logging simple
        log(f"Failed to parse phone payload: {exc}")
        return None


def build_pair_response(request: dict, keypair: dict[str, str]) -> dict:
    if request.get("type") != "pair_request":
        return {
            "type": "pair_error",
            "reason": f"Unsupported payload type: {request.get('type')}",
        }

    if request.get("chain") != "evm":
        return {
            "type": "pair_error",
            "reason": "Only EVM pairing is supported",
        }

    chain_id = request.get("chainId")
    if chain_id != SEPOLIA_CHAIN_ID:
        return {
            "type": "pair_error",
            "reason": f"Unsupported chainId {chain_id}, expected {SEPOLIA_CHAIN_ID}",
        }

    return {
        "type": "pair_response",
        "protocolVersion": 1,
        "chain": "evm",
        "chainId": SEPOLIA_CHAIN_ID,
        "address": keypair["address"],
    }


def send_response(payload: dict) -> bool:
    response_bytes = json.dumps(payload).encode("utf-8")
    log(f"Response payload size: {len(response_bytes)} bytes")
    log(f"Response type: {payload.get('type')}")
    log(f"Response JSON: {json.dumps(payload, sort_keys=True)}")

    time.sleep(1.0)  # give user time to lift and retap
    if not wait_and_select_aid("TAP 2"):
        return False

    try:
        write_payload(response_bytes)
        log("Response sent successfully")
        return True
    except Exception as exc:  # noqa: BLE001
        log(f"Failed to send response: {exc}")
        return False


def main() -> None:
    setup()
    keypair = load_or_create_keypair()

    while True:
        request = read_phone_payload()
        if request is None:
            time.sleep(0.5)
            continue

        response = build_pair_response(request, keypair)

        ok = False
        while not ok:
            ok = send_response(response)
            time.sleep(0.5)

        log("Done. Waiting for next pairing request...\n")


if __name__ == "__main__":
    main()
