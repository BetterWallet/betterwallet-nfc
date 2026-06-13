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

export interface ReviewDetails {
  requestId: string;
  to: string;
  amountEth: string;
  amountWei: string;
  network: 'Ethereum';
  estimatedFeeEth: string;
  estimatedFeeUsd: string;
  amountUsd: string;
  totalEth: string;
  totalUsd: string;
}

export interface SignRequestMessage {
  id: string;
  type: 'sign_request';
  tx: string;
}

export interface SignedTxMessage {
  id: string;
  type: 'signed_tx';
  signature: string;
}

export interface TxResult {
  txHash: string;
  explorerUrl: string;
  simulated: boolean;
}
