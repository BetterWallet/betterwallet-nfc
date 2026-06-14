import { formatUnits } from 'ethers';
import type { NfcTransferPhase } from '../useHCE';

export type NfcErrorKind =
  | 'timeout_before_tap'
  | 'timeout_waiting_rescan'
  | 'data_mismatch'
  | 'malformed_payload'
  | 'generic';

export type FlowErrorKind =
  | NfcErrorKind
  | 'insufficient_funds'
  | 'transaction_rejected'
  | 'transaction_conflict'
  | 'network_error'
  | 'flow_failed';

export interface NfcErrorDetails {
  kind: NfcErrorKind;
  title: string;
  guidance: string;
  actionLabel: string;
}

export interface FlowErrorDetails {
  kind: FlowErrorKind;
  title: string;
  guidance: string;
  actionLabel: string;
  isNfcError: boolean;
}

const TIMEOUT_PATTERN = /timed out waiting/i;
const MISMATCH_PATTERN = /mismatch/i;
const MALFORMED_PATTERN = /malformed/i;
const NFC_PATTERN = /\bnfc\b|signed payload|signed transaction|typed-data signature/i;

export function isLikelyNfcError(message: string): boolean {
  return (
    TIMEOUT_PATTERN.test(message) ||
    MISMATCH_PATTERN.test(message) ||
    MALFORMED_PATTERN.test(message) ||
    NFC_PATTERN.test(message)
  );
}

export function describeNfcError(message: string, phase: NfcTransferPhase): NfcErrorDetails {
  if (TIMEOUT_PATTERN.test(message)) {
    if (phase === 'waiting_for_rescan' || phase === 'transferring_from_wallet') {
      return {
        kind: 'timeout_waiting_rescan',
        title: 'Unable to send NFC response',
        guidance:
          'The phone likely moved away during response transfer (InDataExchange failed). Re-scan and keep devices steady.',
        actionLabel: 'Re-scan',
      };
    }
    return {
      kind: 'timeout_before_tap',
      title: 'Wallet not detected',
      guidance: 'Hold your Better Wallet against the back of your phone and try again.',
      actionLabel: 'Retry',
    };
  }

  if (MISMATCH_PATTERN.test(message)) {
    return {
      kind: 'data_mismatch',
      title: 'Data mismatch',
      guidance: 'The returned signature does not match this request. Start a fresh scan.',
      actionLabel: 'Try again',
    };
  }

  if (MALFORMED_PATTERN.test(message)) {
    return {
      kind: 'malformed_payload',
      title: 'Invalid response',
      guidance: 'The response could not be parsed. Re-scan your wallet to retry transfer.',
      actionLabel: 'Try again',
    };
  }

  return {
    kind: 'generic',
    title: 'NFC error',
    guidance: 'Move the wallet closer to your phone and retry the transfer.',
    actionLabel: 'Retry',
  };
}

const INSUFFICIENT_FUNDS_PATTERN = /insufficient funds/i;
const REVERT_PATTERN = /revert|execution reverted|CALL_EXCEPTION/i;
const CONFLICT_PATTERN = /nonce too low|replacement transaction underpriced|already known/i;
const NETWORK_PATTERN = /network|fetch failed|ECONNREFUSED|timeout exceeded|could not detect network/i;

function extractNestedRpcMessage(message: string): string {
  const nested = message.match(/"message":\s*"([^"]+)"/);
  return nested?.[1] ?? message;
}

function stripTransactionBlob(message: string): string {
  return message.replace(/\(transaction="0x[^"]+"[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function formatAvaxShort(wei: bigint): string {
  const avax = Number(formatUnits(wei, 18));
  if (avax >= 0.01) {
    return `${avax.toFixed(4)} AVAX`;
  }
  return `${avax.toFixed(6)} AVAX`;
}

function describeInsufficientFunds(message: string): FlowErrorDetails {
  const rpcMessage = extractNestedRpcMessage(stripTransactionBlob(message));
  const balanceMatch = rpcMessage.match(/balance\s+(\d+)/i);
  const costMatch = rpcMessage.match(/tx cost\s+(\d+)/i);
  const overshotMatch = rpcMessage.match(/overshot\s+(\d+)/i);

  let guidance =
    'Your wallet needs more AVAX on Avalanche Fuji to cover the CCIP fee and gas. Add AVAX and try again.';

  if (balanceMatch && costMatch) {
    const balance = BigInt(balanceMatch[1]);
    const cost = BigInt(costMatch[1]);
    const shortfall = overshotMatch ? BigInt(overshotMatch[1]) : cost - balance;
    guidance = `You have ${formatAvaxShort(balance)} but need ${formatAvaxShort(cost)} (short by ${formatAvaxShort(shortfall)}). Add AVAX on Fuji and retry.`;
  }

  return {
    kind: 'insufficient_funds',
    title: 'Insufficient AVAX',
    guidance,
    actionLabel: 'Retry',
    isNfcError: false,
  };
}

function describeTransactionError(message: string): FlowErrorDetails {
  const cleaned = stripTransactionBlob(extractNestedRpcMessage(message));

  if (INSUFFICIENT_FUNDS_PATTERN.test(cleaned)) {
    return describeInsufficientFunds(message);
  }

  if (CONFLICT_PATTERN.test(cleaned)) {
    return {
      kind: 'transaction_conflict',
      title: 'Transaction conflict',
      guidance: 'A previous transaction may still be pending. Wait a moment and retry.',
      actionLabel: 'Retry',
      isNfcError: false,
    };
  }

  if (REVERT_PATTERN.test(cleaned)) {
    const reasonMatch = cleaned.match(/reason="([^"]+)"/) ?? cleaned.match(/reverted with reason string '([^']+)'/);
    return {
      kind: 'transaction_rejected',
      title: 'Transaction rejected',
      guidance: reasonMatch?.[1] ?? cleaned.slice(0, 180),
      actionLabel: 'Retry',
      isNfcError: false,
    };
  }

  if (NETWORK_PATTERN.test(cleaned)) {
    return {
      kind: 'network_error',
      title: 'Network error',
      guidance: cleaned.slice(0, 180),
      actionLabel: 'Retry',
      isNfcError: false,
    };
  }

  return {
    kind: 'flow_failed',
    title: 'Transfer failed',
    guidance: cleaned.slice(0, 220),
    actionLabel: 'Retry',
    isNfcError: false,
  };
}

export function describeFlowError(message: string, phase: NfcTransferPhase): FlowErrorDetails {
  if (isLikelyNfcError(message)) {
    const nfc = describeNfcError(message, phase);
    return { ...nfc, isNfcError: true };
  }
  return describeTransactionError(message);
}
