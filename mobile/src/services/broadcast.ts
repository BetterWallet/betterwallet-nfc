import { JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import type {
  ReviewDetails,
  SignedTxMessage,
  TxResult,
  TypedDataSignatureMessage,
} from '../types/send';

const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_EXPLORER_BASE_URL = 'https://sepolia.etherscan.io/tx/';

export function parseSignedTxMessage(json: string): SignedTxMessage {
  const parsed = JSON.parse(json) as Partial<SignedTxMessage>;
  if (parsed.type !== 'signed_tx' || !parsed.id || !parsed.signature) {
    throw new Error('Malformed signed payload received from NFC signer.');
  }

  return {
    id: parsed.id,
    type: 'signed_tx',
    signature: parsed.signature,
  };
}

export function parseTypedDataSignatureMessage(json: string): TypedDataSignatureMessage {
  const parsed = JSON.parse(json) as Partial<TypedDataSignatureMessage>;
  if (parsed.type !== 'typed_data_signature' || !parsed.id || !parsed.signature) {
    throw new Error('Malformed typed-data signature payload received from NFC signer.');
  }

  return {
    id: parsed.id,
    type: 'typed_data_signature',
    signature: parsed.signature,
  };
}

export async function broadcastSignedResult(
  signedTx: SignedTxMessage,
  review: ReviewDetails,
): Promise<TxResult> {
  const candidate = signedTx.signature.trim();

  if (candidate.startsWith('0x')) {
    const provider = new JsonRpcProvider(DEFAULT_RPC_URL);
    const response = await provider.broadcastTransaction(candidate);
    return {
      txHash: response.hash,
      explorerUrl: `${DEFAULT_EXPLORER_BASE_URL}${response.hash}`,
      simulated: false,
    };
  }

  const txHash = keccak256(
    toUtf8Bytes(`${review.requestId}:${signedTx.id}:${signedTx.signature}`),
  );

  return {
    txHash,
    explorerUrl: `${DEFAULT_EXPLORER_BASE_URL}${txHash}`,
    simulated: true,
  };
}
