export const SEPOLIA_CHAIN_ID = 11155111;

export interface PairRequestMessage {
  type: 'pair_request';
  protocolVersion: 1;
  chain: 'evm';
  chainId: typeof SEPOLIA_CHAIN_ID;
}

export interface PairResponseMessage {
  type: 'pair_response';
  protocolVersion: number;
  chain: 'evm';
  chainId: number;
  address: string;
}

export interface WalletProfile {
  walletId: string;
  chain: 'evm';
  chainId: number;
  networkName: 'Sepolia';
  address: string;
  publicKey?: string;
  pairedAt: string;
}
