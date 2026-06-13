import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { findTokenByAddress, SEPOLIA_SWAP_TOKENS, SWAP_NETWORK, type SwapTokenOption } from '../config/swapTokens';

const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const NEGATIVE_CACHE_TTL_MS = 30_000;

const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
const metadataCache = new Map<string, SwapTokenOption>();
const missingTokenCache = new Map<string, number>();

export async function resolveSepoliaToken(address: string): Promise<SwapTokenOption | null> {
  const normalizedAddress = address.trim().toLowerCase();
  if (!isAddress(normalizedAddress)) {
    return null;
  }

  if (metadataCache.has(normalizedAddress)) {
    return metadataCache.get(normalizedAddress) ?? null;
  }

  const missingAt = missingTokenCache.get(normalizedAddress);
  if (missingAt && Date.now() - missingAt < NEGATIVE_CACHE_TTL_MS) {
    return null;
  }
  if (missingAt) {
    missingTokenCache.delete(normalizedAddress);
  }

  const curated = findTokenByAddress(normalizedAddress, SEPOLIA_SWAP_TOKENS);
  if (curated) {
    metadataCache.set(normalizedAddress, curated);
    missingTokenCache.delete(normalizedAddress);
    return curated;
  }

  try {
    const tokenContract = new Contract(normalizedAddress, ERC20_METADATA_ABI, provider);
    const [symbol, name, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals(),
    ]);

    const resolvedToken: SwapTokenOption = {
      address: normalizedAddress,
      symbol: String(symbol),
      name: String(name),
      decimals: Number(decimals),
      chainId: SWAP_NETWORK.id,
      isCurated: false,
    };
    metadataCache.set(normalizedAddress, resolvedToken);
    missingTokenCache.delete(normalizedAddress);
    return resolvedToken;
  } catch {
    missingTokenCache.set(normalizedAddress, Date.now());
    return null;
  }
}
