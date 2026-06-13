import type { NfcTransferPhase } from '../useHCE';

export type NfcErrorKind =
  | 'timeout_before_tap'
  | 'timeout_waiting_rescan'
  | 'data_mismatch'
  | 'malformed_payload'
  | 'generic';

export interface NfcErrorDetails {
  kind: NfcErrorKind;
  title: string;
  guidance: string;
  actionLabel: string;
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
