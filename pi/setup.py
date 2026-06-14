import time
import subprocess

from pn532pi import Pn532, Pn532I2c
try:
    import RPi.GPIO as GPIO
except Exception:  # noqa: BLE001
    GPIO = None  # type: ignore[assignment]

PN532_I2C = Pn532I2c(Pn532I2c.RPI_BUS3)  # I2C3: SDA=GPIO6 (pin 31), SCL=GPIO7 (pin 26)
nfc = Pn532(PN532_I2C)
RST_PIN = 25
_GPIO_INITIALIZED = False

CUSTOM_AID = bytearray([0xF0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])

SELECT_AID_APDU = bytearray(
    [
        0x00,  # CLA
        0xA4,  # INS: SELECT
        0x04,  # P1: select by name
        0x00,  # P2
        len(CUSTOM_AID),
        *CUSTOM_AID,
        0x00,  # Le
    ]
)

def _ensure_gpio_ready() -> None:
    if GPIO is None:
        raise RuntimeError("RPi.GPIO unavailable")
    global _GPIO_INITIALIZED
    if _GPIO_INITIALIZED:
        return
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(RST_PIN, GPIO.OUT, initial=GPIO.HIGH)
    _GPIO_INITIALIZED = True


def _reset_via_pinctrl() -> None:
    print(f"[nfc] Resetting PN532 via pinctrl GPIO{RST_PIN}")
    subprocess.run(["pinctrl", "set", str(RST_PIN), "op", "dl"], check=True)
    time.sleep(0.1)
    subprocess.run(["pinctrl", "set", str(RST_PIN), "op", "dh"], check=True)
    time.sleep(0.5)
    print("[nfc] PN532 reset complete (pinctrl)")


def reset_pn532() -> None:
    try:
        _ensure_gpio_ready()
        print(f"[nfc] Resetting PN532 via GPIO{RST_PIN}")
        GPIO.output(RST_PIN, GPIO.LOW)
        time.sleep(0.1)
        GPIO.output(RST_PIN, GPIO.HIGH)
        time.sleep(0.5)
        print("[nfc] PN532 reset complete")
    except Exception as exc:  # noqa: BLE001
        print(f"[nfc] RPi.GPIO reset failed ({exc}); falling back to pinctrl")
        _reset_via_pinctrl()


def reconnect_pn532() -> int:
    close_transport = getattr(PN532_I2C, "close", None)
    if callable(close_transport):
        close_transport()
    reset_pn532()
    nfc.begin()

    versiondata = nfc.getFirmwareVersion()
    if not versiondata:
        raise RuntimeError("Didn't find PN53x board — check wiring and jumpers")

    nfc.SAMConfig()
    return versiondata


def _init_pn532_no_reset() -> int:
    nfc.begin()

    versiondata = nfc.getFirmwareVersion()
    if not versiondata:
        raise RuntimeError("Didn't find PN53x board — check wiring and jumpers")

    nfc.SAMConfig()
    return versiondata


def setup():
    print("------- Better Wallet HCE -------")
    versiondata = _init_pn532_no_reset()
    print(
        "Found chip PN5{:#x} Firmware ver. {:d}.{:d}".format(
            (versiondata >> 24) & 0xFF,
            (versiondata >> 16) & 0xFF,
            (versiondata >> 8) & 0xFF,
        )
    )
    print("Ready.\n")
