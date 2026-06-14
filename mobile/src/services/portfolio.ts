import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import type { NetworkKey } from '../state/network';
import type { PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';

const IMAGE_CACHE_KEY = 'betterwallet.tokenImageUrls.v1';
const DEFI_LLAMA_ENDPOINT = 'https://coins.llama.fi/prices/current';
const COINGECKO_MARKETS_ENDPOINT = 'https://api.coingecko.com/api/v3/coins/markets';
const HTTP_TIMEOUT_MS = 12000;
const RPC_TIMEOUT_MS = 12000;

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

interface TokenConfig {
  symbol: string;
  defaultName: string;
  decimals: number;
  address: 'native' | `0x${string}`;
  defiLlamaKey: string;
  coingeckoId: string;
}

interface NetworkConfig {
  rpcUrl: string;
  tokens: TokenConfig[];
}

const NETWORK_CONFIGS: Record<NetworkKey, NetworkConfig> = {
  'eth-sepolia': {
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    tokens: [
      {
        symbol: 'ETH',
        defaultName: 'Ethereum',
        decimals: 18,
        address: 'native',
        defiLlamaKey: 'coingecko:ethereum',
        coingeckoId: 'ethereum',
      },
      {
        symbol: 'USDC',
        defaultName: 'USD Coin',
        decimals: 6,
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        defiLlamaKey: 'coingecko:usd-coin',
        coingeckoId: 'usd-coin',
      },
      {
        symbol: 'WETH',
        defaultName: 'Wrapped Ether',
        decimals: 18,
        address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
        defiLlamaKey: 'coingecko:weth',
        coingeckoId: 'weth',
      },
    ],
  },
  'avax-fuji': {
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    tokens: [
      {
        symbol: 'AVAX',
        defaultName: 'Avalanche',
        decimals: 18,
        address: 'native',
        defiLlamaKey: 'coingecko:avalanche-2',
        coingeckoId: 'avalanche-2',
      },
      {
        symbol: 'USDC',
        defaultName: 'USD Coin',
        decimals: 6,
        address: '0x5425890298aed601595a70AB815c96711a31Bc65',
        defiLlamaKey: 'coingecko:usd-coin',
        coingeckoId: 'usd-coin',
      },
    ],
  },
  'base-mainnet': {
    rpcUrl: 'https://mainnet.base.org',
    tokens: [
      {
        symbol: 'ETH',
        defaultName: 'Ethereum',
        decimals: 18,
        address: 'native',
        defiLlamaKey: 'coingecko:ethereum',
        coingeckoId: 'ethereum',
      },
      {
        symbol: 'USDC',
        defaultName: 'USD Coin',
        decimals: 6,
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        defiLlamaKey: 'coingecko:usd-coin',
        coingeckoId: 'usd-coin',
      },
    ],
  },
};

interface DeFiLlamaResponse {
  coins?: Record<string, { price?: number }>;
}

interface CoinGeckoMarketCoin {
  id: string;
  name?: string;
  image?: string;
}

interface ImageMetadata {
  imageUrl: string;
  name?: string;
}

type ImageCacheByCoinGeckoId = Record<string, ImageMetadata>;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out.`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}).`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function safeParseImageCache(raw: string | null): ImageCacheByCoinGeckoId {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    const cache: ImageCacheByCoinGeckoId = {};

    for (const [key, value] of entries) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const imageUrl = (value as { imageUrl?: unknown }).imageUrl;
      const name = (value as { name?: unknown }).name;
      if (typeof imageUrl === 'string') {
        cache[key] = {
          imageUrl,
          name: typeof name === 'string' ? name : undefined,
        };
      }
    }

    return cache;
  } catch {
    return {};
  }
}

function amountFromRaw(raw: bigint, decimals: number): number {
  const parsed = Number.parseFloat(formatUnits(raw, decimals));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadImageCache(): Promise<ImageCacheByCoinGeckoId> {
  const cachedRaw = await AsyncStorage.getItem(IMAGE_CACHE_KEY);
  return safeParseImageCache(cachedRaw);
}

async function fetchMissingTokenImages(
  missingCoinGeckoIds: string[],
): Promise<ImageCacheByCoinGeckoId> {
  if (missingCoinGeckoIds.length === 0) {
    return {};
  }

  const url = `${COINGECKO_MARKETS_ENDPOINT}?vs_currency=usd&ids=${encodeURIComponent(
    missingCoinGeckoIds.join(','),
  )}&per_page=${missingCoinGeckoIds.length}`;

  const data = await fetchJsonWithTimeout<CoinGeckoMarketCoin[]>(url);
  const map: ImageCacheByCoinGeckoId = {};
  for (const coin of data) {
    if (!coin?.id || typeof coin.image !== 'string') {
      continue;
    }
    map[coin.id] = {
      imageUrl: coin.image,
      name: typeof coin.name === 'string' ? coin.name : undefined,
    };
  }
  return map;
}

async function getImageMetadataByCoinGeckoId(
  tokens: TokenConfig[],
): Promise<ImageCacheByCoinGeckoId> {
  const cache = await loadImageCache();
  const missingCoinGeckoIds = tokens
    .map((token) => token.coingeckoId)
    .filter((coinGeckoId) => !cache[coinGeckoId]?.imageUrl);

  if (missingCoinGeckoIds.length === 0) {
    return cache;
  }

  const fetched = await fetchMissingTokenImages(missingCoinGeckoIds);
  if (Object.keys(fetched).length === 0) {
    return cache;
  }

  const merged = { ...cache, ...fetched };
  await AsyncStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(merged));
  return merged;
}

async function fetchPricesByDefiLlamaKey(
  tokens: TokenConfig[],
): Promise<Record<string, number>> {
  const keys = tokens.map((token) => token.defiLlamaKey);
  const data = await fetchJsonWithTimeout<DeFiLlamaResponse>(
    `${DEFI_LLAMA_ENDPOINT}/${keys.join(',')}`,
  );
  const result: Record<string, number> = {};

  for (const key of keys) {
    const price = data.coins?.[key]?.price;
    result[key] = typeof price === 'number' && Number.isFinite(price) ? price : 0;
  }

  return result;
}

async function fetchBalances(
  walletAddress: string,
  tokens: TokenConfig[],
  rpcUrl: string,
): Promise<Record<string, number>> {
  const provider = new JsonRpcProvider(rpcUrl);

  const balances = await Promise.all(
    tokens.map(async (token) => {
      const raw =
        token.address === 'native'
          ? await withTimeout(
              provider.getBalance(walletAddress),
              RPC_TIMEOUT_MS,
              `${token.symbol} balance lookup`,
            )
          : await withTimeout(
              new Contract(token.address, ERC20_ABI, provider).balanceOf(walletAddress),
              RPC_TIMEOUT_MS,
              `${token.symbol} balance lookup`,
            );
      return [token.symbol, amountFromRaw(raw as bigint, token.decimals)] as const;
    }),
  );

  return Object.fromEntries(balances);
}

export async function getPortfolio(
  walletAddress: string,
  network: NetworkKey = 'eth-sepolia',
): Promise<PortfolioSnapshot> {
  const normalizedAddress = walletAddress.trim();
  if (!normalizedAddress) {
    throw new Error('Wallet address is required to load portfolio.');
  }

  const { rpcUrl, tokens } = NETWORK_CONFIGS[network];

  const [balancesBySymbol, pricesByDefiLlamaKey] = await Promise.all([
    fetchBalances(normalizedAddress, tokens, rpcUrl),
    fetchPricesByDefiLlamaKey(tokens),
  ]);

  let imageMetadataByCoinGeckoId: ImageCacheByCoinGeckoId = {};
  try {
    imageMetadataByCoinGeckoId = await getImageMetadataByCoinGeckoId(tokens);
  } catch {
    imageMetadataByCoinGeckoId = {};
  }

  const assets: PortfolioAsset[] = tokens
    .map((token) => {
      const amount = balancesBySymbol[token.symbol] ?? 0;
      const priceUsd = pricesByDefiLlamaKey[token.defiLlamaKey] ?? 0;
      const valueUsd = amount * priceUsd;
      const imageMetadata = imageMetadataByCoinGeckoId[token.coingeckoId];

      return {
        symbol: token.symbol,
        name: imageMetadata?.name ?? token.defaultName,
        amount,
        priceUsd,
        valueUsd,
        imageUrl: imageMetadata?.imageUrl ?? '',
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const totalUsd = assets.reduce((sum, asset) => sum + asset.valueUsd, 0);

  return {
    assets,
    totalUsd,
    updatedAt: new Date().toISOString(),
  };
}
