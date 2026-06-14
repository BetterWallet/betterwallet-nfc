import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NfcTransferOverlay } from '../components/NfcTransferOverlay';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  broadcastCcipSendOnFuji,
  broadcastOnFuji,
  buildApprovalTx,
  buildBridgeSignRequest,
  buildCcipSendTx,
  getNonce,
} from '../services/ccip';
import { describeNfcError } from '../services/nfcError';
import { parseSignedTxMessage } from '../services/broadcast';
import { useBridgeFlow } from '../state/bridgeFlow';
import { useWallet } from '../state/wallet';
import { useHCE } from '../useHCE';

type Props = NativeStackScreenProps<RootStackParamList, 'BridgeScan'>;

const STEP_CONFIG = {
  nfc_approve: { step: 1, label: 'Approve USDC', hint: 'Authorising the CCIP router to spend your USDC.' },
  broadcasting_approve: { step: 1, label: 'Broadcasting approval…', hint: 'Submitting approval transaction to Avalanche Fuji.' },
  nfc_send: { step: 2, label: 'Send Cross-Chain', hint: 'Sending USDC from Avalanche Fuji to Ethereum Sepolia.' },
  broadcasting_send: { step: 2, label: 'Broadcasting…', hint: 'Submitting CCIP message to the router.' },
} as const;

export function BridgeScanScreen({ navigation }: Props) {
  const { state, setStage, setApproveHash, setCcipResult, setError } = useBridgeFlow();
  const { wallet } = useWallet();
  const {
    loadPayload,
    waitForSignedTxOnce,
    clearSignedTxListener,
    resetTransferState,
    transferPhase,
    transferProgress,
  } = useHCE();

  const [localError, setLocalError] = useState<string | null>(null);
  const [runNonce, setRunNonce] = useState(0);
  const startedRef = useRef(false);

  const isBroadcasting =
    state.stage === 'broadcasting_approve' || state.stage === 'broadcasting_send';

  const stepConfig = useMemo(() => {
    const key = state.stage as keyof typeof STEP_CONFIG;
    return STEP_CONFIG[key] ?? STEP_CONFIG.nfc_approve;
  }, [state.stage]);

  const nfcError = useMemo(() => {
    if (!localError) return null;
    return describeNfcError(localError, transferPhase);
  }, [localError, transferPhase]);

  useEffect(() => {
    if (startedRef.current) return;
    if (!state.avaxFeeWei || !state.receiver || !state.amountUsdc) return;
    if (!wallet?.address) return;

    startedRef.current = true;
    let cancelled = false;

    const runFlow = async () => {
      const signerAddress = wallet.address;
      const avaxFeeWei = state.avaxFeeWei!;

      try {
        // ── Step 1: Approve USDC ────────────────────────────────────────────
        setStage('nfc_approve');

        const nonce1 = await getNonce(signerAddress);
        const approveId = `bridge-approve-${Date.now()}`;
        const approveTx = buildApprovalTx();
        const approveSignRequest = buildBridgeSignRequest(approveId, approveTx, signerAddress, nonce1);

        const approveSignedPromise = waitForSignedTxOnce(45000);
        loadPayload(approveSignRequest);
        const approveSignedJson = await approveSignedPromise;

        if (cancelled) return;

        const approveSigned = parseSignedTxMessage(approveSignedJson);
        if (approveSigned.id !== approveId) {
          throw new Error('Approval signature ID mismatch. Please retry.');
        }

        setStage('broadcasting_approve');
        const approveTxHash = await broadcastOnFuji(approveSigned.signature);
        if (cancelled) return;

        setApproveHash(approveTxHash);
        resetTransferState();

        // ── Step 2: ccipSend ────────────────────────────────────────────────
        setStage('nfc_send');

        const nonce2 = nonce1 + 1;
        const ccipId = `bridge-ccip-${Date.now()}`;
        const ccipTx = buildCcipSendTx(state.receiver, state.amountUsdc, avaxFeeWei);
        const ccipSignRequest = buildBridgeSignRequest(ccipId, ccipTx, signerAddress, nonce2);

        const ccipSignedPromise = waitForSignedTxOnce(45000);
        loadPayload(ccipSignRequest);
        const ccipSignedJson = await ccipSignedPromise;

        if (cancelled) return;

        const ccipSigned = parseSignedTxMessage(ccipSignedJson);
        if (ccipSigned.id !== ccipId) {
          throw new Error('CCIP send signature ID mismatch. Please retry.');
        }

        setStage('broadcasting_send');
        const { txHash, messageId } = await broadcastCcipSendOnFuji(ccipSigned.signature);
        if (cancelled) return;

        setCcipResult({ ccipTxHash: txHash, messageId });
        navigation.replace('BridgeSuccess');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Bridge failed unexpectedly.';
        setLocalError(message);
        setError(message);
      }
    };

    void runFlow();

    return () => {
      cancelled = true;
      clearSignedTxListener();
    };
  }, [
    clearSignedTxListener,
    loadPayload,
    navigation,
    resetTransferState,
    runNonce,
    setApproveHash,
    setCcipResult,
    setError,
    setStage,
    state.amountUsdc,
    state.avaxFeeWei,
    state.receiver,
    wallet?.address,
    waitForSignedTxOnce,
  ]);

  const onRetry = () => {
    startedRef.current = false;
    resetTransferState();
    setLocalError(null);
    setRunNonce((v) => v + 1);
  };

  const onCancel = () => {
    clearSignedTxListener();
    resetTransferState();
    navigation.replace('BridgeReview');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        {/* Step indicator */}
        <View style={s.stepRow}>
          <View style={[s.stepDot, stepConfig.step >= 1 && s.stepDotActive]}>
            <Text style={[s.stepDotText, stepConfig.step >= 1 && s.stepDotTextActive]}>1</Text>
          </View>
          <View style={[s.stepLine, stepConfig.step >= 2 && s.stepLineActive]} />
          <View style={[s.stepDot, stepConfig.step >= 2 && s.stepDotActive]}>
            <Text style={[s.stepDotText, stepConfig.step >= 2 && s.stepDotTextActive]}>2</Text>
          </View>
        </View>

        <Text style={s.stepLabel}>
          Step {stepConfig.step} of 2 — {stepConfig.label}
        </Text>

        <Text style={s.title}>Sign with Better Wallet</Text>
        <Text style={s.subtitle}>
          {stepConfig.hint}
          {'\n'}Hold your Better Wallet near the back of your phone.
        </Text>

        {isBroadcasting ? (
          <View style={s.phaseCard}>
            <Text style={s.phaseTitle}>{stepConfig.label}</Text>
            <Text style={s.phaseHint}>
              {state.stage === 'broadcasting_approve'
                ? 'Waiting for approval transaction to confirm on Avalanche Fuji…'
                : 'Submitting CCIP message to the router on Avalanche Fuji…'}
            </Text>
            <ActivityIndicator color="#c8f323" size="large" style={s.spinner} />
          </View>
        ) : (
          <NfcTransferOverlay
            phase={transferPhase}
            progress={transferProgress}
            error={
              localError
                ? `${nfcError?.title ?? 'NFC error'}\n${nfcError?.guidance ?? localError}`
                : null
            }
            onRetry={onRetry}
            retryLabel={nfcError?.actionLabel ?? 'Retry'}
            onClose={onCancel}
            closeLabel="Cancel"
          />
        )}

        {localError && isBroadcasting ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Error</Text>
            <Text style={s.errorBody}>{localError}</Text>
          </View>
        ) : null}

        <View style={s.footer}>
          {localError ? (
            <Pressable style={s.primaryButton} onPress={onRetry}>
              <Text style={s.primaryButtonText}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable style={s.secondaryButton} onPress={onCancel}>
            <Text style={s.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#131313' },
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 36 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1d1d1d',
    borderWidth: 2,
    borderColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: '#c8f323',
    backgroundColor: 'rgba(200,243,35,0.12)',
  },
  stepDotText: { color: '#555', fontWeight: '700', fontSize: 14 },
  stepDotTextActive: { color: '#c8f323' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#2a2a2a', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#c8f323' },

  stepLabel: {
    color: '#c8f323',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 20,
  },
  title: { color: '#e5e2e1', fontSize: 28, fontWeight: '700' },
  subtitle: {
    marginTop: 10,
    color: '#a8a8a8',
    fontSize: 15,
    lineHeight: 24,
  },

  phaseCard: {
    marginTop: 28,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 18,
    padding: 20,
  },
  phaseTitle: { color: '#c8f323', fontSize: 22, fontWeight: '700' },
  phaseHint: { marginTop: 10, color: '#d4d4d4', fontSize: 14, lineHeight: 21 },
  spinner: { marginTop: 18 },

  errorCard: {
    marginTop: 20,
    backgroundColor: '#2a1717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    padding: 14,
    gap: 6,
  },
  errorTitle: { color: '#ffb4ab', fontWeight: '700', fontSize: 15 },
  errorBody: { color: '#ffd8d3', fontSize: 14, lineHeight: 20 },

  footer: { marginTop: 'auto', gap: 10, paddingBottom: 26 },
  primaryButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: { color: '#1a2400', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#1a1a1a',
  },
  secondaryButtonText: { color: '#c6c6c7', fontWeight: '600', fontSize: 15 },
});
