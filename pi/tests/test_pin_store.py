import tempfile
import unittest
from pathlib import Path
import sys

PI_DIR = Path(__file__).resolve().parents[1]
if str(PI_DIR) not in sys.path:
    sys.path.insert(0, str(PI_DIR))

import pin_store


class PinStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.original_path = pin_store.PIN_STORE_PATH
        pin_store.PIN_STORE_PATH = Path(self.tmpdir.name) / "pin_store.json"

    def tearDown(self) -> None:
        pin_store.PIN_STORE_PATH = self.original_path
        self.tmpdir.cleanup()

    def test_enroll_and_verify_pin(self) -> None:
        self.assertFalse(pin_store.pin_exists())
        pin_store.enroll_pin("123456")
        self.assertTrue(pin_store.pin_exists())
        self.assertTrue(pin_store.verify_pin("123456"))
        self.assertFalse(pin_store.verify_pin("000000"))

    def test_invalid_pin_rejected(self) -> None:
        with self.assertRaises(ValueError):
            pin_store.enroll_pin("12345")
        with self.assertRaises(ValueError):
            pin_store.enroll_pin("ABCDEF")


if __name__ == "__main__":
    unittest.main()
