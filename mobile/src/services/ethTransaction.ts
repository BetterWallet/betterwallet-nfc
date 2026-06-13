import { Buffer } from 'buffer';
import { isAddress, parseEther } from 'ethers';
import type {
  ReviewDetails,
  SendDraft,
  SignRequestMessage,
  SwapReviewMeta,
  TypedDataSignRequestMessage,
  UnsignedTxPayload,
} from '../types/send';

const ESTIMATED_FEE_ETH = '0.00011';
const ETH_USD_PRICE = 3400;
const DEFAULT_MAX_FEE_PER_GAS_WEI = '30000000000';
const DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI = '1500000000';
const DEFAULT_TRANSFER_GAS_LIMIT = '21000';

export function validateRecipientAddress(address: string): boolean {
  return isAddress(address.trim());
}

export function validateAmount(amountEth: string): boolean {
  try {
    const value = parseEther(amountEth.trim());
    return value > 0n;
  } catch {
    return false;
  }
}

export function createReviewDetails(draft: SendDraft): ReviewDetails {
  const normalizedTo = draft.to.trim();
  const normalizedAmount = draft.amountEth.trim();
  const amountWei = parseEther(normalizedAmount).toString();

  const amountEthNum = Number(normalizedAmount);
  const feeEthNum = Number(ESTIMATED_FEE_ETH);
  const totalEthNum = amountEthNum + feeEthNum;

  const amountUsdNum = amountEthNum * ETH_USD_PRICE;
  const feeUsdNum = feeEthNum * ETH_USD_PRICE;
  const totalUsdNum = amountUsdNum + feeUsdNum;

  return {
    requestId: `tx-${Date.now()}`,
    kind: 'transfer',
    to: normalizedTo,
    unsignedTx: {
      to: normalizedTo,
      valueWei: amountWei,
      gasLimit: DEFAULT_TRANSFER_GAS_LIMIT,
      maxFeePerGasWei: DEFAULT_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGasWei: DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI,
    },
    amountEth: normalizedAmount,
    amountWei,
    network: 'Ethereum',
    estimatedFeeEth: ESTIMATED_FEE_ETH,
    estimatedFeeUsd: usd(feeUsdNum),
    amountUsd: usd(amountUsdNum),
    totalEth: trimDecimals(totalEthNum, 6),
    totalUsd: usd(totalUsdNum),
    title: 'Confirm Transaction',
    subtitle: undefined,
  };
}

interface CreateContractReviewParams {
  kind: 'swap' | 'approval';
  title: string;
  subtitle?: string;
  unsignedTx: UnsignedTxPayload;
  amountEth: string;
  amountWei: string;
  amountUsd: string;
  estimatedFeeEth: string;
  estimatedFeeUsd: string;
  totalEth: string;
  totalUsd: string;
  swapMeta?: SwapReviewMeta;
}

export function createContractReviewDetails(params: CreateContractReviewParams): ReviewDetails {
  return {
    requestId: `tx-${Date.now()}`,
    kind: params.kind,
    to: params.unsignedTx.to,
    unsignedTx: params.unsignedTx,
    amountEth: params.amountEth,
    amountWei: params.amountWei,
    network: 'Ethereum',
    estimatedFeeEth: params.estimatedFeeEth,
    estimatedFeeUsd: params.estimatedFeeUsd,
    amountUsd: params.amountUsd,
    totalEth: params.totalEth,
    totalUsd: params.totalUsd,
    title: params.title,
    subtitle: params.subtitle,
    swapMeta: params.swapMeta,
  };
}

export function buildSignRequest(
  review: ReviewDetails,
  fromAddress?: string | null,
  nonce?: number | string | null,
): SignRequestMessage {
  const unsignedTxPayload = {
    version: 1,
    chain: 'ethereum',
    from: fromAddress ?? null,
    to: review.unsignedTx.to,
    valueWei: review.unsignedTx.valueWei,
    gasLimit: review.unsignedTx.gasLimit,
    maxFeePerGasWei: review.unsignedTx.maxFeePerGasWei,
    maxPriorityFeePerGasWei: review.unsignedTx.maxPriorityFeePerGasWei,
    nonce: nonce ?? null,
    data: review.unsignedTx.data,
    createdAt: new Date().toISOString(),
  };

  const tx = Buffer.from(JSON.stringify(unsignedTxPayload), 'utf8').toString('base64');
  return {
    id: review.requestId,
    type: 'sign_request',
    tx,
  };
}

export function buildTypedDataSignRequest(
  id: string,
  typedData: Record<string, unknown>,
): TypedDataSignRequestMessage {
  return {
    id,
    type: 'typed_data_sign_request',
    typedData,
  };
}

function usd(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function trimDecimals(amount: number, max: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
}
