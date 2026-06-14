import { Buffer } from 'buffer';
import {
  AbiCoder,
  Contract,
  formatUnits,
  Interface,
  JsonRpcProvider,
  MaxUint256,
  parseUnits,
  ZeroAddress,
} from 'ethers';
import type { SignRequestMessage, UnsignedTxPayload } from '../types/send';

// ─── Chain config ─────────────────────────────────────────────────────────────

export const AVAX_FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
export const FUJI_CHAIN_ID = 43113;
const ETH_SEPOLIA_CHAIN_SELECTOR = 16015286601757825753n;

// Avalanche Fuji contract addresses
const FUJI_CCIP_ROUTER = '0xF694E193200268f9a4868e4Aa017A0118C9a8177';
const FUJI_USDC = '0x5425890298aed601595a70AB815c96711a31Bc65';
const USDC_DECIMALS = 6;

// Gas limits (conservative estimates for Fuji testnet)
const APPROVE_GAS_LIMIT = '80000';
const CCIP_SEND_GAS_LIMIT = '350000';

// Fuji gas prices (in wei) — Avalanche uses 25 gwei base fee minimum
const FUJI_MAX_FEE_PER_GAS_WEI = '35000000000'; // 35 gwei
const FUJI_MAX_PRIORITY_FEE_PER_GAS_WEI = '1500000000'; // 1.5 gwei

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Field order must match Client.EVM2AnyMessage: tokenAmounts → feeToken → extraArgs
const CCIP_ROUTER_ABI = [
  'function getFee(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256 fee)',
  'function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) payable returns (bytes32 messageId)',
];

// ─── CCIP message helpers ──────────────────────────────────────────────────────

// GenericExtraArgsV2: gasLimit=0, allowOutOfOrderExecution=true
// Tag = bytes4(keccak256("CCIP EVMExtraArgsV2")) = 0x181dcf10
function buildExtraArgs(): string {
  const tag = '181dcf10';
  const encoded = AbiCoder.defaultAbiCoder().encode(['uint256', 'bool'], [0n, true]);
  return '0x' + tag + encoded.slice(2);
}

function buildCCIPMessage(receiver: string, amountWei: bigint) {
  return {
    receiver: AbiCoder.defaultAbiCoder().encode(['address'], [receiver]),
    data: '0x',
    tokenAmounts: [{ token: FUJI_USDC, amount: amountWei }],
    feeToken: ZeroAddress,
    extraArgs: buildExtraArgs(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function estimateCcipFee(receiver: string, amountUsdc: string): Promise<bigint> {
  const provider = new JsonRpcProvider(AVAX_FUJI_RPC);
  const router = new Contract(FUJI_CCIP_ROUTER, CCIP_ROUTER_ABI, provider);
  const amountWei = parseUnits(amountUsdc, USDC_DECIMALS);
  const message = buildCCIPMessage(receiver, amountWei);
  const fee: bigint = await router.getFee(ETH_SEPOLIA_CHAIN_SELECTOR, message);
  return fee;
}

export function formatAvaxFee(avaxFeeWei: bigint): string {
  return formatUnits(avaxFeeWei, 18);
}

export function buildApprovalTx(): UnsignedTxPayload {
  const iface = new Interface(ERC20_ABI);
  const data = iface.encodeFunctionData('approve', [FUJI_CCIP_ROUTER, MaxUint256]);
  return {
    to: FUJI_USDC,
    valueWei: '0',
    gasLimit: APPROVE_GAS_LIMIT,
    maxFeePerGasWei: FUJI_MAX_FEE_PER_GAS_WEI,
    maxPriorityFeePerGasWei: FUJI_MAX_PRIORITY_FEE_PER_GAS_WEI,
    data,
    chainId: FUJI_CHAIN_ID,
  };
}

export function buildCcipSendTx(
  receiver: string,
  amountUsdc: string,
  avaxFeeWei: bigint,
): UnsignedTxPayload {
  const amountWei = parseUnits(amountUsdc, USDC_DECIMALS);
  const message = buildCCIPMessage(receiver, amountWei);
  const iface = new Interface(CCIP_ROUTER_ABI);
  const data = iface.encodeFunctionData('ccipSend', [ETH_SEPOLIA_CHAIN_SELECTOR, message]);
  return {
    to: FUJI_CCIP_ROUTER,
    valueWei: avaxFeeWei.toString(),
    gasLimit: CCIP_SEND_GAS_LIMIT,
    maxFeePerGasWei: FUJI_MAX_FEE_PER_GAS_WEI,
    maxPriorityFeePerGasWei: FUJI_MAX_PRIORITY_FEE_PER_GAS_WEI,
    data,
    chainId: FUJI_CHAIN_ID,
  };
}

export function buildBridgeSignRequest(
  requestId: string,
  unsignedTx: UnsignedTxPayload,
  fromAddress: string,
  nonce: number,
): SignRequestMessage {
  const payload = {
    version: 1,
    chain: 'avalanche',
    chainId: FUJI_CHAIN_ID,
    from: fromAddress,
    to: unsignedTx.to,
    valueWei: unsignedTx.valueWei,
    gasLimit: unsignedTx.gasLimit,
    maxFeePerGasWei: unsignedTx.maxFeePerGasWei,
    maxPriorityFeePerGasWei: unsignedTx.maxPriorityFeePerGasWei,
    nonce,
    data: unsignedTx.data,
    createdAt: new Date().toISOString(),
  };
  const tx = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return { id: requestId, type: 'sign_request', tx };
}

export async function broadcastOnFuji(signedHex: string): Promise<string> {
  const provider = new JsonRpcProvider(AVAX_FUJI_RPC);
  const response = await provider.broadcastTransaction(signedHex);
  await response.wait();
  return response.hash;
}

export async function broadcastCcipSendOnFuji(
  signedHex: string,
): Promise<{ txHash: string; messageId: string }> {
  const provider = new JsonRpcProvider(AVAX_FUJI_RPC);
  const response = await provider.broadcastTransaction(signedHex);
  const receipt = await response.wait();

  let messageId = response.hash;
  for (const log of receipt?.logs ?? []) {
    if (log.topics[1]) {
      messageId = log.topics[1];
      break;
    }
  }

  return { txHash: response.hash, messageId };
}

export async function getNonce(address: string): Promise<number> {
  const provider = new JsonRpcProvider(AVAX_FUJI_RPC);
  return provider.getTransactionCount(address, 'pending');
}
