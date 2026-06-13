import base64
import json
import time

from eth_account import Account

from pairing_wallet import SEPOLIA_CHAIN_ID, load_or_create_keypair
from protocol import is_card_moved_away_error, read_payload, select_aid, write_payload
from setup import nfc, setup


def log(message: str) -> None:
    print(f"[signing] {message}")


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
    except Exception as exc:  # noqa: BLE001 - script logging is intentionally broad
        if is_card_moved_away_error(exc):
            log("Card moved away during read; waiting for next tap.")
            return None
        log(f"Failed to parse phone payload: {exc}")
        return None


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


def resolve_nonce(unsigned_tx: dict) -> int:
    nonce_value = unsigned_tx.get("nonce")
    if nonce_value is None:
        raise ValueError(
            "Unsigned tx is missing nonce. Pi is offline and requires nonce in phone payload."
        )
    return parse_int(nonce_value, "nonce")


def decode_unsigned_tx(sign_request: dict) -> dict:
    try:
        raw = base64.b64decode(sign_request["tx"])
        unsigned_tx = json.loads(raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Invalid sign_request tx payload: {exc}") from exc

    required_fields = [
        "to",
        "valueWei",
        "gasLimit",
        "maxFeePerGasWei",
        "maxPriorityFeePerGasWei",
    ]
    for field in required_fields:
        if field not in unsigned_tx:
            raise ValueError(f"Missing required unsigned tx field: {field}")

    return unsigned_tx


def sign_request_payload(sign_request: dict, keypair: dict[str, str]) -> str:
    unsigned_tx = decode_unsigned_tx(sign_request)
    log(f"Decoded unsigned tx JSON: {json.dumps(unsigned_tx, sort_keys=True)}")

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

    signed = Account.sign_transaction(tx_dict, keypair["private_key"])
    raw_hex = signed.raw_transaction.hex()
    signed_raw_tx = raw_hex if raw_hex.startswith("0x") else f"0x{raw_hex}"

    log(f"Sign request id: {sign_request['id']}")
    log(f"Signer address: {signer_address}")
    log(f"To address: {unsigned_tx['to']}")
    log(f"Value (wei): {tx_dict['value']}")
    log(f"Gas limit: {tx_dict['gas']}")
    log(f"Max fee per gas (wei): {tx_dict['maxFeePerGas']}")
    log(f"Max priority fee per gas (wei): {tx_dict['maxPriorityFeePerGas']}")
    log(f"Nonce used: {nonce}")
    # log(f"Signed raw tx: {signed_raw_tx}")

    return signed_raw_tx


def build_sign_response(request: dict, keypair: dict[str, str]) -> dict:
    if request.get("type") != "sign_request":
        raise ValueError(f"Unsupported payload type: {request.get('type')}")
    if "id" not in request:
        raise ValueError("Missing sign_request id")
    if "tx" not in request:
        raise ValueError("Missing sign_request tx")

    signature = sign_request_payload(request, keypair)
    return {"id": request["id"], "type": "signed_tx", "signature": signature}


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
        if is_card_moved_away_error(exc):
            log("Card moved away during send; waiting for re-tap.")
            return False
        log(f"Failed to send response: {exc}")
        return False


def main() -> None:
    setup()
    keypair = load_or_create_keypair()
    log("Using paired keystore for Sepolia signing")

    while True:
        request = read_phone_payload()
        if request is None:
            time.sleep(0.1)
            continue

        try:
            response = build_sign_response(request, keypair)
        except Exception as exc:  # noqa: BLE001
            log(f"Signing failed: {exc}")
            log("Waiting for next sign request...\n")
            time.sleep(0.1)
            continue

        sent = False
        while not sent:
            sent = send_response(response)
            time.sleep(0.1)

        log("Done. Waiting for next sign request...\n")


if __name__ == "__main__":
    main()
