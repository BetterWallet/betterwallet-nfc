import { Buffer } from 'buffer';
import { isAddress, parseEther } from 'ethers';
import type { ReviewDetails, SendDraft, SignRequestMessage } from '../types/send';

const ESTIMATED_FEE_ETH = '0.00011';
const ETH_USD_PRICE = 3400;

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
    to: normalizedTo,
    amountEth: normalizedAmount,
    amountWei,
    network: 'Ethereum',
    estimatedFeeEth: ESTIMATED_FEE_ETH,
    estimatedFeeUsd: usd(feeUsdNum),
    amountUsd: usd(amountUsdNum),
    totalEth: trimDecimals(totalEthNum, 6),
    totalUsd: usd(totalUsdNum),
  };
}

export function buildSignRequest(
  review: ReviewDetails,
  fromAddress?: string | null,
): SignRequestMessage {
  const unsignedTxPayload = {
    version: 1,
    chain: 'ethereum',
    from: fromAddress ?? null,
    to: review.to,
    valueWei: review.amountWei,
    gasLimit: '21000',
    maxFeePerGasWei: '30000000000',
    maxPriorityFeePerGasWei: '1500000000',
    nonce: null,
    createdAt: new Date().toISOString(),
  };

  const tx = Buffer.from(JSON.stringify(unsignedTxPayload), 'utf8').toString('base64');
  return {
    id: review.requestId,
    type: 'sign_request',
    tx,
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
