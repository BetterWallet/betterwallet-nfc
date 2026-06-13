import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import type { PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
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
  sepoliaAddress: 'native' | `0x${string}`;
  defiLlamaKey: string;
  coingeckoId: string;
}

const TOKENS: TokenConfig[] = [
  {
    symbol: 'ETH',
    defaultName: 'Ethereum',
    decimals: 18,
    sepoliaAddress: 'native',
    defiLlamaKey: 'coingecko:ethereum',
    coingeckoId: 'ethereum',
  },
  {
    symbol: 'USDC',
    defaultName: 'USD Coin',
    decimals: 6,
    sepoliaAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    defiLlamaKey: 'coingecko:usd-coin',
    coingeckoId: 'usd-coin',
  },
  {
    symbol: 'WETH',
    defaultName: 'Wrapped Ether',
    decimals: 18,
    sepoliaAddress: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
    defiLlamaKey: 'coingecko:weth',
    coingeckoId: 'weth',
  },
];

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

const provider = new JsonRpcProvider(RPC_URL);

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

async function getImageMetadataByCoinGeckoId(): Promise<ImageCacheByCoinGeckoId> {
  const cache = await loadImageCache();
  const missingCoinGeckoIds = TOKENS.map((token) => token.coingeckoId).filter(
    (coinGeckoId) => !cache[coinGeckoId]?.imageUrl,
  );

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

async function fetchPricesByDefiLlamaKey(): Promise<Record<string, number>> {
  const keys = TOKENS.map((token) => token.defiLlamaKey);
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

async function fetchBalances(walletAddress: string): Promise<Record<string, number>> {
  const balances = await Promise.all(
    TOKENS.map(async (token) => {
      const raw =
        token.sepoliaAddress === 'native'
          ? await withTimeout(
              provider.getBalance(walletAddress),
              RPC_TIMEOUT_MS,
              `${token.symbol} balance lookup`,
            )
          : await withTimeout(
              new Contract(token.sepoliaAddress, ERC20_ABI, provider).balanceOf(walletAddress),
              RPC_TIMEOUT_MS,
              `${token.symbol} balance lookup`,
            );
      return [token.symbol, amountFromRaw(raw as bigint, token.decimals)] as const;
    }),
  );

  return Object.fromEntries(balances);
}

export async function getPortfolio(walletAddress: string): Promise<PortfolioSnapshot> {
  const normalizedAddress = walletAddress.trim();
  if (!normalizedAddress) {
    throw new Error('Wallet address is required to load portfolio.');
  }

  const [balancesBySymbol, pricesByDefiLlamaKey] = await Promise.all([
    fetchBalances(normalizedAddress),
    fetchPricesByDefiLlamaKey(),
  ]);

  let imageMetadataByCoinGeckoId: ImageCacheByCoinGeckoId = {};
  try {
    imageMetadataByCoinGeckoId = await getImageMetadataByCoinGeckoId();
  } catch {
    imageMetadataByCoinGeckoId = {};
  }

  const assets: PortfolioAsset[] = TOKENS.map((token) => {
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
  }).sort((a, b) => b.valueUsd - a.valueUsd);

  const totalUsd = assets.reduce((sum, asset) => sum + asset.valueUsd, 0);

  return {
    assets,
    totalUsd,
    updatedAt: new Date().toISOString(),
  };
}
