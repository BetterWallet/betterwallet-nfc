import { isAddress, isHexString } from 'ethers';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const UNIVERSAL_ROUTER_VERSION = '2.0';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
const COINGECKO_MARKETS_ENDPOINT = 'https://api.coingecko.com/api/v3/coins/markets';

export const SWAP_CHAIN_ID = 11155111;
export const SEPOLIA_TOKENS = {
  ETH: ETH_ADDRESS,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  WETH: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
} as const;
export const TOKEN_COINGECKO_IDS = {
  ETH: 'ethereum',
  USDC: 'usd-coin',
  WETH: 'weth',
} as const;

export type RoutingType =
  | 'CLASSIC'
  | 'WRAP'
  | 'UNWRAP'
  | 'DUTCH_V2'
  | 'DUTCH_V3'
  | 'PRIORITY'
  | 'DUTCH_LIMIT'
  | 'LIMIT_ORDER'
  | 'BRIDGE'
  | 'QUICKROUTE'
  | string;

export interface ApprovalTx {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface CheckApprovalParams {
  walletAddress: string;
  token: string;
  amount: string;
  chainId?: number;
}

interface CheckApprovalResponse {
  approval: ApprovalTx | null;
}

export interface QuoteParams {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  type?: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  slippageTolerance?: number;
  routingPreference?: 'BEST_PRICE' | 'FASTEST' | 'CLASSIC';
}

export interface QuoteOutput {
  token: string;
  amount: string;
}

export interface QuoteResponse {
  routing: RoutingType;
  quote: {
    output?: QuoteOutput;
    gasFeeUSD?: string;
    gasLimit?: string;
    gasUseEstimate?: string;
    orderInfo?: {
      outputs?: Array<{
        token: string;
        startAmount: string;
        endAmount: string;
        recipient: string;
      }>;
    };
    [key: string]: unknown;
  };
  permitData?: Record<string, unknown> | null;
  permitTransaction?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SwapTx {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

interface SwapResponse {
  swap: SwapTx;
}

export interface TokenMarketData {
  symbol: keyof typeof TOKEN_COINGECKO_IDS;
  name: string;
  priceUsd: number;
  imageUrl: string;
}

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_UNISWAP_API_KEY;
  if (!key) {
    throw new Error('Missing EXPO_PUBLIC_UNISWAP_API_KEY. Add it to your local mobile env.');
  }
  return key;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getApiKey(),
    'x-universal-router-version': UNIVERSAL_ROUTER_VERSION,
  };
}

function isUniswapXRouting(routing: RoutingType): boolean {
  return routing === 'DUTCH_V2' || routing === 'DUTCH_V3' || routing === 'PRIORITY';
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(data?.detail || `Uniswap API request failed (${response.status}).`);
  }
  return data;
}

export async function checkApproval(params: CheckApprovalParams): Promise<ApprovalTx | null> {
  const payload: CheckApprovalParams = {
    ...params,
    chainId: params.chainId ?? SWAP_CHAIN_ID,
  };
  validateSwapAddress(payload.walletAddress, 'walletAddress');
  validateSwapAddress(payload.token, 'token');
  validateRawAmount(payload.amount, 'amount');

  const data = await postJson<CheckApprovalResponse>('/check_approval', payload);
  return data.approval;
}

export async function quoteSwap(params: QuoteParams): Promise<QuoteResponse> {
  validateSwapAddress(params.swapper, 'swapper');
  validateSwapAddress(params.tokenIn, 'tokenIn');
  validateSwapAddress(params.tokenOut, 'tokenOut');
  validateRawAmount(params.amount, 'amount');
  if (params.tokenIn.toLowerCase() === params.tokenOut.toLowerCase()) {
    throw new Error('Select two different tokens.');
  }

  return postJson<QuoteResponse>('/quote', {
    swapper: params.swapper,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    tokenInChainId: String(SWAP_CHAIN_ID),
    tokenOutChainId: String(SWAP_CHAIN_ID),
    amount: params.amount,
    type: params.type ?? 'EXACT_INPUT',
    routingPreference: params.routingPreference ?? 'BEST_PRICE',
    slippageTolerance: params.slippageTolerance ?? 1,
  });
}

export function prepareSwapRequest(
  quoteResponse: QuoteResponse,
  signature?: string,
): Record<string, unknown> {
  const { permitData, permitTransaction, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };

  if (isUniswapXRouting(quoteResponse.routing)) {
    if (signature) {
      request.signature = signature;
    }
    return request;
  }

  if (signature && permitData && typeof permitData === 'object') {
    request.signature = signature;
    request.permitData = permitData;
  }

  return request;
}

export async function fetchSwapTransaction(
  quoteResponse: QuoteResponse,
  signature?: string,
): Promise<SwapTx> {
  const request = prepareSwapRequest(quoteResponse, signature);
  const response = await postJson<SwapResponse>('/swap', request);
  validateSwapTx(response.swap, quoteResponse);
  return response.swap;
}

export async function fetchTokenMarketData(): Promise<Record<keyof typeof TOKEN_COINGECKO_IDS, TokenMarketData>> {
  const ids = Object.values(TOKEN_COINGECKO_IDS).join(',');
  const response = await fetch(
    `${COINGECKO_MARKETS_ENDPOINT}?vs_currency=usd&ids=${encodeURIComponent(ids)}&per_page=3`,
  );
  if (!response.ok) {
    throw new Error('Unable to fetch token market prices.');
  }

  const data = (await response.json()) as Array<{
    id?: string;
    name?: string;
    image?: string;
    current_price?: number;
  }>;

  const defaultEntries: Record<keyof typeof TOKEN_COINGECKO_IDS, TokenMarketData> = {
    ETH: { symbol: 'ETH', name: 'Ethereum', priceUsd: 0, imageUrl: '' },
    USDC: { symbol: 'USDC', name: 'USD Coin', priceUsd: 0, imageUrl: '' },
    WETH: { symbol: 'WETH', name: 'Wrapped Ether', priceUsd: 0, imageUrl: '' },
  };

  for (const entry of data) {
    const symbol = (Object.entries(TOKEN_COINGECKO_IDS).find(
      ([, id]) => id === entry.id,
    )?.[0] ?? null) as keyof typeof TOKEN_COINGECKO_IDS | null;
    if (!symbol) {
      continue;
    }

    defaultEntries[symbol] = {
      symbol,
      name: entry.name || defaultEntries[symbol].name,
      priceUsd: typeof entry.current_price === 'number' ? entry.current_price : 0,
      imageUrl: typeof entry.image === 'string' ? entry.image : '',
    };
  }

  return defaultEntries;
}

export function getQuoteOutputAmount(quoteResponse: QuoteResponse): string | null {
  if (isUniswapXRouting(quoteResponse.routing)) {
    const output = quoteResponse.quote.orderInfo?.outputs?.[0];
    return output?.startAmount ?? null;
  }
  return quoteResponse.quote.output?.amount ?? null;
}

export function getQuoteGasUsd(quoteResponse: QuoteResponse): string | null {
  return typeof quoteResponse.quote.gasFeeUSD === 'string' ? quoteResponse.quote.gasFeeUSD : null;
}

export function validateSwapAddress(address: string, fieldName: string): void {
  if (!isAddress(address)) {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

export function validateRawAmount(amount: string, fieldName: string): void {
  if (!/^[0-9]+$/.test(amount) || amount === '0') {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

export function validateSwapTx(swap: SwapTx, quoteResponse?: QuoteResponse): void {
  validateSwapAddress(swap.to, 'swap.to');
  validateSwapAddress(swap.from, 'swap.from');
  if (!swap.data || !isHexString(swap.data) || swap.data === '0x') {
    throw new Error('Swap calldata is empty or invalid. Refresh the quote and retry.');
  }
  if (swap.chainId !== SWAP_CHAIN_ID) {
    throw new Error('Swap chain mismatch. Expected Sepolia.');
  }
  if (quoteResponse && quoteResponse.routing && quoteResponse.routing.length === 0) {
    throw new Error('Invalid quote routing.');
  }
}
