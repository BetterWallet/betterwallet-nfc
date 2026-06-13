import base64
import json
import unittest
from pathlib import Path
import sys

PI_DIR = Path(__file__).resolve().parents[1]
if str(PI_DIR) not in sys.path:
    sys.path.insert(0, str(PI_DIR))

IMPORT_ERROR = None
try:
    from nfc_wallet_service import NfcWalletService, parse_int
    from wallet_keys import EvmKeypair, SolanaKeypair
except ModuleNotFoundError as exc:  # pragma: no cover - environment-specific dependency check
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"Missing dependency: {IMPORT_ERROR}")
class NfcWalletServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = NfcWalletService()
        self.evm = EvmKeypair(
            private_key="0x4c0883a6910395b7f0e1f13f0aa9f4f9c4a0f1e5d8366af7d2a3dfcc5a2ddca7",
            public_key="0x04" + "11" * 64,
            address="0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1",
        )
        self.solana = SolanaKeypair(
            private_key_hex="01" * 32,
            public_key_hex="02" * 32,
            address="2mc7fM3WwJQ7fQ4D7Vm6yq8bM2wM1N1BfGfXzGz7f8bE",
        )

    def test_parse_int(self) -> None:
        self.assertEqual(parse_int("10", "value"), 10)
        self.assertEqual(parse_int("0x0a", "value"), 10)
        self.assertEqual(parse_int(12, "value"), 12)

    def test_build_pair_response_solana(self) -> None:
        request = {"type": "pair_request", "chain": "solana", "cluster": "devnet"}
        response = self.service.build_pair_response(request, self.evm, self.solana)
        self.assertEqual(response["type"], "pair_response")
        self.assertEqual(response["chain"], "solana")
        self.assertEqual(response["address"], self.solana.address)

    def test_build_evm_review(self) -> None:
        unsigned = {
            "to": "0x1111111111111111111111111111111111111111",
            "valueWei": "100000000000000000",
            "gasLimit": "21000",
            "maxFeePerGasWei": "30000000000",
            "maxPriorityFeePerGasWei": "1500000000",
            "nonce": "1",
            "from": self.evm.address,
        }
        tx = base64.b64encode(json.dumps(unsigned).encode("utf-8")).decode("ascii")
        request = {"id": "tx-1", "type": "sign_request", "tx": tx}
        review = self.service.build_sign_review(request, self.evm, self.solana)
        self.assertEqual(review.chain, "evm")
        self.assertIn("Ethereum Sepolia", " ".join(review.lines))


if __name__ == "__main__":
    unittest.main()
