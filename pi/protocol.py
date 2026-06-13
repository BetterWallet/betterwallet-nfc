import binascii

from setup import SELECT_AID_APDU, nfc

CHUNK_SIZE = 200  # safe within PN532's ~265-byte frame buffer
STATUS_OK = bytes([0x90, 0x00])
MAX_PAYLOAD_BYTES = 64 * 1024


class CardMovedAwayError(IOError):
    """Transient NFC exchange error when the phone/card leaves field."""


def is_card_moved_away_error(error: object) -> bool:
    text = str(error).lower()
    return (
        "card moved away" in text
        or "indataexchangefailed" in text
        or "indataexchange failed" in text
    )


def _exchange(apdu: bytearray) -> bytearray:
    """Send APDU and return response bytes."""
    try:
        success, response = nfc.inDataExchange(apdu)
    except Exception as exc:  # noqa: BLE001 - normalize library-specific transport errors
        if is_card_moved_away_error(exc):
            raise CardMovedAwayError("inDataExchange failed — card moved away?") from exc
        raise
    if not success:
        raise CardMovedAwayError("inDataExchange failed — card moved away?")
    return bytearray(response)


def _split_apdu_response(response: bytes) -> tuple[bytes, bytes]:
    """Split APDU response into payload bytes and trailing status word."""
    if len(response) < 2:
        raise IOError("APDU response too short for status word")
    return response[:-2], response[-2:]


def select_aid() -> bool:
    """Send SELECT AID. Returns True only on 90 00 response."""
    success, response = nfc.inDataExchange(SELECT_AID_APDU)
    if not success:
        return False

    resp = bytes(response)
    print("  SELECT AID response:", binascii.hexlify(resp))
    return resp.endswith(STATUS_OK)


def read_payload() -> bytes:
    """
    Tap 1: read full JSON payload from Android HCE.
    Android pre-loads the payload before the tap.
    """
    resp = bytes(_exchange(bytearray([0x01])))
    length_bytes, status = _split_apdu_response(resp)
    if status != STATUS_OK:
        raise IOError(f"GET_LEN failed: {binascii.hexlify(status)}")
    if len(length_bytes) < 2:
        raise IOError("GET_LEN payload too short")

    total_len = (length_bytes[0] << 8) | length_bytes[1]
    if total_len > MAX_PAYLOAD_BYTES:
        raise IOError(f"Payload too large: {total_len} > {MAX_PAYLOAD_BYTES}")
    print(f"  Payload length: {total_len} bytes")

    data = bytearray()
    offset = 0
    while offset < total_len:
        hi = (offset >> 8) & 0xFF
        lo = offset & 0xFF
        resp = bytes(_exchange(bytearray([0x02, hi, lo])))
        chunk, status = _split_apdu_response(resp)
        if status != STATUS_OK:
            raise IOError(f"GET_CHUNK failed at {offset}: {binascii.hexlify(status)}")
        if not chunk:
            raise IOError("GET_CHUNK returned empty response before payload complete")

        remaining = total_len - offset
        data.extend(chunk[:remaining])
        offset += min(len(chunk), remaining)
        print(f"  Read {offset}/{total_len} bytes", end="\r")

    print()
    return bytes(data)


def write_payload(data: bytes):
    """
    Tap 2: send signed tx JSON to Android HCE in chunks, then commit.
    Android fires the HCE_SIGNED_TX React Native event on commit.
    """
    total = len(data)
    sent = 0
    while sent < total:
        chunk = data[sent : sent + CHUNK_SIZE]
        ack = _exchange(bytearray([0x03]) + bytearray(chunk))
        if not bytes(ack).endswith(STATUS_OK):
            raise IOError(f"RECV_CHUNK failed: {binascii.hexlify(ack)}")

        sent += len(chunk)
        print(f"  Wrote {sent}/{total} bytes", end="\r")

    print()
    ack = _exchange(bytearray([0x04]))
    if not bytes(ack).endswith(STATUS_OK):
        raise IOError(f"COMMIT failed: {binascii.hexlify(ack)}")
    print("  Committed.")
