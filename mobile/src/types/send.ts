export type FlowStage =
  | 'compose'
  | 'review'
  | 'nfc'
  | 'broadcasting'
  | 'success'
  | 'error';

export interface SendDraft {
  to: string;
  amountEth: string;
}

export type ReviewKind = 'transfer' | 'swap' | 'approval';

export interface UnsignedTxPayload {
  to: string;
  valueWei: string;
  gasLimit: string;
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei: string;
  data?: string;
}

export interface SwapReviewMeta {
  provider: 'Uniswap';
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountInDisplay: string;
  amountOutDisplay: string;
  slippagePercent: string;
  routing: string;
}

export interface ReviewDetails {
  requestId: string;
  kind: ReviewKind;
  to: string;
  unsignedTx: UnsignedTxPayload;
  amountEth: string;
  amountWei: string;
  network: 'Ethereum';
  estimatedFeeEth: string;
  estimatedFeeUsd: string;
  amountUsd: string;
  totalEth: string;
  totalUsd: string;
  title?: string;
  subtitle?: string;
  swapMeta?: SwapReviewMeta;
}

export interface SignRequestMessage {
  id: string;
  type: 'sign_request';
  tx: string;
}

export interface TypedDataSignRequestMessage {
  id: string;
  type: 'typed_data_sign_request';
  typedData: Record<string, unknown>;
}

export interface SignedTxMessage {
  id: string;
  type: 'signed_tx';
  signature: string;
}

export interface TypedDataSignatureMessage {
  id: string;
  type: 'typed_data_signature';
  signature: string;
}

export interface TxResult {
  txHash: string;
  explorerUrl: string;
  simulated: boolean;
}
