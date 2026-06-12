import base64
import json
import time

from protocol import read_payload, select_aid, write_payload
from setup import nfc, setup


def mock_sign(tx_b64: str) -> str:
    """Mock signing; replace with real key operations."""
    return base64.b64encode(b"signed:" + base64.b64decode(tx_b64)).decode()


def loop_tap1() -> dict | None:
    """Wait for phone and read sign request payload."""
    print("TAP 1 — waiting for phone...")
    if not nfc.inListPassiveTarget():
        return None

    print("  Card detected!")
    try:
        if not select_aid():
            print("  SELECT AID failed.")
            return None

        raw = read_payload()
        msg = json.loads(raw.decode("utf-8"))

        if msg.get("type") != "sign_request":
            print(f"  Unexpected type: {msg.get('type')}")
            return None
        if "id" not in msg or "tx" not in msg:
            print("  Missing required fields in sign request.")
            return None

        print(f"  Got sign request id={msg['id']}")
        return msg
    except (IOError, json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        print(f"  Error: {exc}")
        return None


def loop_tap2(data: bytes) -> bool:
    """Wait for phone and write signed tx payload."""
    print("TAP 2 — waiting for phone...")
    if not nfc.inListPassiveTarget():
        return False

    print("  Card detected!")
    try:
        if not select_aid():
            print("  SELECT AID failed.")
            return False

        write_payload(data)
        return True
    except IOError as exc:
        print(f"  Error: {exc}")
        return False


def main():
    setup()

    while True:
        msg = None
        while msg is None:
            msg = loop_tap1()
            time.sleep(0.5)

        try:
            signature = mock_sign(msg["tx"])
        except (ValueError, TypeError) as exc:
            print(f"  Signing failed: {exc}")
            print("  Waiting for next transaction...\n")
            continue

        response = json.dumps(
            {"id": msg["id"], "type": "signed_tx", "signature": signature}
        )
        response_bytes = response.encode("utf-8")
        print(f"  Signed. Response size: {len(response_bytes)} bytes")

        # Let user move phone away between taps.
        time.sleep(1.0)

        success = False
        while not success:
            success = loop_tap2(response_bytes)
            time.sleep(0.5)

        print("  Done! Waiting for next transaction...\n")


if __name__ == "__main__":
    main()
