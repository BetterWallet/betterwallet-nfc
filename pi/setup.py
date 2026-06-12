import time

from pn532pi import Pn532, Pn532I2c

PN532_I2C = Pn532I2c(Pn532I2c.RPI_BUS1)  # I2C1: SDA=GPIO2 (pin 3), SCL=GPIO3 (pin 5)
nfc = Pn532(PN532_I2C)

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

def setup():
    print("------- Better Wallet HCE -------")
    nfc.begin()

    versiondata = nfc.getFirmwareVersion()
    if not versiondata:
        raise RuntimeError("Didn't find PN53x board — check wiring and jumpers")

    print(
        "Found chip PN5{:#x} Firmware ver. {:d}.{:d}".format(
            (versiondata >> 24) & 0xFF,
            (versiondata >> 16) & 0xFF,
            (versiondata >> 8) & 0xFF,
        )
    )
    nfc.SAMConfig()
    print("Ready.\n")
