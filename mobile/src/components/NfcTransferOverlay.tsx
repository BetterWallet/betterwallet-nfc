import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { NfcTransferPhase, NfcTransferProgress } from '../useHCE';

interface NfcTransferOverlayProps {
  visible?: boolean;
  phase: NfcTransferPhase;
  progress: NfcTransferProgress | null;
  error: string | null;
  errorTitle?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
  contextLabel?: string;
}

interface PhaseCopy {
  title: string;
  hint: string;
  stepLabel: string | null;
}

const SIZE = 128;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getPhaseCopy(phase: NfcTransferPhase): PhaseCopy {
  switch (phase) {
    case 'waiting_for_tap':
      return {
        title: 'Ready to scan',
        hint: 'Tap your Better Wallet to start data transfer.',
        stepLabel: 'Step 1 of 2',
      };
    case 'transferring_to_wallet':
      return {
        title: 'Sending data',
        hint: 'Keep your wallet still while request data is transferred.',
        stepLabel: 'Step 1 of 2',
      };
    case 'waiting_for_rescan':
      return {
        title: 'Re-scan required',
        hint: 'Lift and tap again so your phone can receive the signed response.',
        stepLabel: 'Step 2 of 2',
      };
    case 'transferring_from_wallet':
      return {
        title: 'Receiving signature',
        hint: 'Receiving signed data from your wallet.',
        stepLabel: 'Step 2 of 2',
      };
    case 'complete':
      return {
        title: 'Transfer complete',
        hint: 'Continuing to the next step.',
        stepLabel: null,
      };
    case 'idle':
    default:
      return {
        title: 'Preparing NFC',
        hint: 'Getting the transfer channel ready.',
        stepLabel: null,
      };
  }
}

function getFallbackProgress(phase: NfcTransferPhase): number {
  switch (phase) {
    case 'waiting_for_tap':
      return 0;
    case 'transferring_to_wallet':
      return 0.35;
    case 'waiting_for_rescan':
      return 0.55;
    case 'transferring_from_wallet':
      return 0.78;
    case 'complete':
      return 1;
    case 'idle':
    default:
      return 0;
  }
}

export function NfcTransferOverlay({
  visible = true,
  phase,
  progress,
  error,
  errorTitle,
  onRetry,
  retryLabel = 'Retry',
  onClose,
  closeLabel = 'Close',
  contextLabel,
}: NfcTransferOverlayProps) {
  const copy = useMemo(() => getPhaseCopy(phase), [phase]);

  const computedProgress = useMemo(() => {
    if (phase === 'complete') {
      return 1;
    }
    if (progress?.ratio != null) {
      return Math.max(0, Math.min(progress.ratio, 1));
    }
    return getFallbackProgress(phase);
  }, [phase, progress]);

  const progressPercent = Math.round(computedProgress * 100);
  const strokeDashoffset = CIRCUMFERENCE - computedProgress * CIRCUMFERENCE;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.ringWrap}>
            <Svg width={SIZE} height={SIZE}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke="#303030"
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={error ? '#ff9188' : '#c8f323'}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            </Svg>
            <View style={s.ringCenter}>
              <Text style={[s.progressLabel, error ? s.progressLabelError : null]}>{progressPercent}%</Text>
              {copy.stepLabel ? <Text style={s.stepLabel}>{copy.stepLabel}</Text> : null}
            </View>
          </View>

          <Text style={[s.title, error ? s.titleError : null]}>
            {error ? (errorTitle ?? 'NFC error') : copy.title}
          </Text>
          <Text style={s.hint}>{error ?? copy.hint}</Text>

          {contextLabel ? <Text style={s.contextLabel}>{contextLabel}</Text> : null}
          {progress ? (
            <Text style={s.bytesLabel}>
              {progress.totalBytes
                ? `${progress.bytesTransferred}/${progress.totalBytes} bytes`
                : `${progress.bytesTransferred} bytes transferred`}
            </Text>
          ) : null}

          {onClose && !error ? (
            <View style={s.errorActions}>
              <Pressable style={s.secondaryButton} onPress={onClose}>
                <Text style={s.secondaryButtonText}>{closeLabel}</Text>
              </Pressable>
            </View>
          ) : null}

          {error && (onRetry || onClose) ? (
            <View style={s.errorActions}>
              {onClose ? (
                <Pressable style={s.secondaryButton} onPress={onClose}>
                  <Text style={s.secondaryButtonText}>{closeLabel}</Text>
                </Pressable>
              ) : null}
              {onRetry ? (
                <Pressable style={s.retryButton} onPress={onRetry}>
                  <Text style={s.retryButtonText}>{retryLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    color: '#c8f323',
    fontSize: 21,
    fontWeight: '700',
  },
  progressLabelError: {
    color: '#ff9188',
  },
  stepLabel: {
    marginTop: 2,
    color: '#9a9a9a',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    marginTop: 16,
    color: '#c8f323',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleError: {
    color: '#ffb4ab',
  },
  hint: {
    marginTop: 10,
    color: '#d4d4d4',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  contextLabel: {
    marginTop: 10,
    color: '#d8d8d8',
    fontSize: 13,
    textAlign: 'center',
  },
  bytesLabel: {
    marginTop: 6,
    color: '#9a9a9a',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 14,
  },
  errorActions: {
    marginTop: 16,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    backgroundColor: '#232323',
  },
  secondaryButtonText: {
    color: '#d7d7d7',
    fontWeight: '600',
    fontSize: 14,
  },
});
