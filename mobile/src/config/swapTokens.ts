export const SWAP_NETWORK = {
  id: 11155111 as const,
  label: 'Ethereum Sepolia',
  shortLabel: 'Sepolia',
};

export type SwapTokenOption = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: typeof SWAP_NETWORK.id;
  isCurated: boolean;
};

const UNISWAP_SEPOLIA_TOKEN_LIST_URL =
  'https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/sepolia.json';
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const SEPOLIA_SWAP_TOKENS: SwapTokenOption[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: SWAP_NETWORK.id,
    isCurated: true,
  },
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: SWAP_NETWORK.id,
    isCurated: true,
  },
  {
    address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    chainId: SWAP_NETWORK.id,
    isCurated: true,
  },
];

export async function fetchSepoliaSwapTokens(): Promise<SwapTokenOption[]> {
  try {
    const response = await fetch(UNISWAP_SEPOLIA_TOKEN_LIST_URL);
    if (!response.ok) {
      throw new Error(`Token list request failed (${response.status}).`);
    }

    const data = (await response.json()) as Array<{
      address?: string;
      symbol?: string;
      name?: string;
      decimals?: number;
      chainId?: number;
    }>;

    const dynamicTokens = data
      .filter((entry) => {
        return (
          entry.chainId === SWAP_NETWORK.id &&
          typeof entry.address === 'string' &&
          ADDRESS_PATTERN.test(entry.address) &&
          typeof entry.symbol === 'string' &&
          typeof entry.name === 'string' &&
          Number.isFinite(entry.decimals)
        );
      })
      .map((entry) => ({
        address: entry.address!,
        symbol: entry.symbol!,
        name: entry.name!,
        decimals: Number(entry.decimals),
        chainId: SWAP_NETWORK.id,
        isCurated: true,
      }));

    return mergeUniqueByAddress([SEPOLIA_SWAP_TOKENS[0], ...dynamicTokens, ...SEPOLIA_SWAP_TOKENS]);
  } catch {
    return SEPOLIA_SWAP_TOKENS;
  }
}

function mergeUniqueByAddress(tokens: SwapTokenOption[]): SwapTokenOption[] {
  const byAddress = new Map<string, SwapTokenOption>();
  for (const token of tokens) {
    byAddress.set(token.address.toLowerCase(), token);
  }
  return Array.from(byAddress.values());
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function findTokenByAddress(address: string, tokens: SwapTokenOption[]): SwapTokenOption | null {
  const normalizedAddress = address.trim().toLowerCase();
  if (!normalizedAddress) {
    return null;
  }
  return tokens.find((token) => token.address.toLowerCase() === normalizedAddress) ?? null;
}

export function filterTokens(query: string, tokens: SwapTokenOption[]): SwapTokenOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return tokens;
  }

  return tokens.filter((token) => {
    const bySymbol = token.symbol.toLowerCase().includes(normalizedQuery);
    const byName = token.name.toLowerCase().includes(normalizedQuery);
    const byAddress = token.address.toLowerCase().includes(normalizedQuery);
    return bySymbol || byName || byAddress;
  });
}
