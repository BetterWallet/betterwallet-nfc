import { isAddress } from 'ethers';
import { SEPOLIA_CHAIN_ID } from '../types/wallet';
import type { PairRequestMessage, PairResponseMessage, WalletProfile } from '../types/wallet';

export function buildPairRequest(): PairRequestMessage {
  return {
    type: 'pair_request',
    protocolVersion: 1,
    chain: 'evm',
    chainId: SEPOLIA_CHAIN_ID,
  };
}

export function parsePairResponse(json: string): WalletProfile {
  const parsed = JSON.parse(json) as Partial<PairResponseMessage>;

  if (
    parsed.type !== 'pair_response' ||
    typeof parsed.protocolVersion !== 'number' ||
    typeof parsed.address !== 'string'
  ) {
    throw new Error('Malformed pair response from NFC hardware wallet.');
  }
  if (parsed.chain !== 'evm') {
    throw new Error('Unsupported chain returned by hardware wallet.');
  }
  if (parsed.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error('Hardware wallet did not return Sepolia chain configuration.');
  }
  if (!isAddress(parsed.address)) {
    throw new Error('Hardware wallet returned invalid EVM address.');
  }

  return {
    walletId: `wallet-${parsed.address}`,
    chain: 'evm',
    chainId: parsed.chainId,
    networkName: 'Sepolia',
    address: parsed.address,
    pairedAt: new Date().toISOString(),
  };
}

export function isValidWalletProfile(value: unknown): value is WalletProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const profile = value as Partial<WalletProfile>;
  return (
    typeof profile.walletId === 'string' &&
    profile.chain === 'evm' &&
    profile.chainId === SEPOLIA_CHAIN_ID &&
    profile.networkName === 'Sepolia' &&
    typeof profile.address === 'string' &&
    isAddress(profile.address) &&
    (profile.publicKey === undefined ||
      (typeof profile.publicKey === 'string' && /^0x04[0-9a-fA-F]{128}$/.test(profile.publicKey))) &&
    typeof profile.pairedAt === 'string'
  );
}
