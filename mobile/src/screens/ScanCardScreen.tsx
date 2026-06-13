import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JsonRpcProvider } from 'ethers';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NfcTransferOverlay } from '../components/NfcTransferOverlay';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { parseSignedTxMessage, broadcastSignedResult } from '../services/broadcast';
import { buildSignRequest } from '../services/ethTransaction';
import { describeNfcError } from '../services/nfcError';
import { useSendFlow } from '../state/sendFlow';
import { useWallet } from '../state/wallet';
import { useHCE } from '../useHCE';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

export function ScanCardScreen({ navigation }: Props) {
  const { state, setStage, setSignedTx, setResult, setError } = useSendFlow();
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

  const phaseLabel = useMemo(() => {
    if (state.stage === 'nfc') {
      return 'Signing';
    }
    if (state.stage === 'broadcasting') {
      return 'Broadcasting';
    }
    return 'Preparing';
  }, [state.stage]);

  const phaseHint = useMemo(() => {
    if (state.stage === 'nfc') {
      return 'NFC transfer in progress.';
    }
    if (state.stage === 'broadcasting') {
      return 'Submitting transaction to the network.';
    }
    return 'Getting ready to sign over NFC.';
  }, [state.stage]);

  const nfcError = useMemo(() => {
    if (!localError) {
      return null;
    }
    return describeNfcError(localError, transferPhase);
  }, [localError, transferPhase]);

  useEffect(() => {
    if (startedRef.current || !state.review) {
      return;
    }
    startedRef.current = true;
    let cancelled = false;

    const runFlow = async () => {
      try {
        const review = state.review;
        if (!review) {
          throw new Error('No transaction available for signing.');
        }

        const signerAddress = wallet?.address;
        if (!signerAddress) {
          throw new Error('No paired wallet address available for nonce lookup.');
        }

        const provider = new JsonRpcProvider(DEFAULT_RPC_URL);
        const nonce = await provider.getTransactionCount(signerAddress, 'pending');

        const signRequest = buildSignRequest(review, signerAddress, nonce);
        const signedPayloadPromise = waitForSignedTxOnce(45000);
        setStage('nfc');
        loadPayload(signRequest);

        const signedJson = await signedPayloadPromise;
        if (cancelled) {
          return;
        }

        const parsedSigned = parseSignedTxMessage(signedJson);
        if (parsedSigned.id !== review.requestId) {
          throw new Error('Signed response ID mismatch. Please retry the scan flow.');
        }
        setSignedTx(parsedSigned);

        setStage('broadcasting');
        const result = await broadcastSignedResult(parsedSigned, review);
        if (cancelled) {
          return;
        }

        setResult(result);
        navigation.replace('Success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scan failed unexpectedly.';
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
    runNonce,
    setError,
    setResult,
    setSignedTx,
    setStage,
    state.review,
    wallet?.address,
    waitForSignedTxOnce,
  ]);

  const onRetry = () => {
    startedRef.current = false;
    resetTransferState();
    setLocalError(null);
    setError(null);
    setStage('nfc');
    setRunNonce((value) => value + 1);
  };

  const onCancel = () => {
    clearSignedTxListener();
    resetTransferState();
    setStage('review');
    navigation.replace('Review');
  };

  if (!state.review) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.title}>No transaction to sign.</Text>
          <Pressable style={s.secondaryButton} onPress={onCancel}>
            <Text style={s.secondaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        <Text style={s.title}>Sign with Better Wallet</Text>
        <Text style={s.subtitle}>
          Hold your Better Wallet near the back of your phone to sign this transaction.
        </Text>

        {state.stage === 'broadcasting' ? (
          <View style={s.phaseCard}>
            <Text style={s.phase}>{phaseLabel}</Text>
            <Text style={s.phaseHint}>{phaseHint}</Text>
            <ActivityIndicator color="#c8f323" size="large" style={s.spinner} />
          </View>
        ) : (
          <NfcTransferOverlay
            phase={transferPhase}
            progress={transferProgress}
            error={localError ? `${nfcError?.title ?? 'NFC error'}\n${nfcError?.guidance ?? localError}` : null}
            onRetry={onRetry}
            retryLabel={nfcError?.actionLabel ?? 'Retry'}
            onClose={onCancel}
            closeLabel="Cancel"
          />
        )}

        {localError && state.stage === 'broadcasting' ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>NFC error</Text>
            <Text style={s.errorBody}>{localError}</Text>
            <Text style={s.errorRetryHint}>
              Hold your wallet near your phone and tap Retry to try again.
            </Text>
          </View>
        ) : null}

        <View style={s.footer}>
          {localError && state.stage === 'broadcasting' ? (
            <Pressable style={s.primaryButton} onPress={onRetry}>
              <Text style={s.primaryButtonText}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable style={s.secondaryButton} onPress={onCancel}>
            <Text style={s.secondaryButtonText}>Cancel Transaction</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#e5e2e1',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 10,
    color: '#a8a8a8',
    fontSize: 16,
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
  phase: {
    color: '#c8f323',
    fontSize: 24,
    fontWeight: '700',
  },
  phaseHint: {
    marginTop: 12,
    color: '#d4d4d4',
    fontSize: 15,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 18,
  },
  errorCard: {
    marginTop: 20,
    backgroundColor: '#2a1717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: '#ffb4ab',
    fontWeight: '700',
    fontSize: 15,
  },
  errorBody: {
    color: '#ffd8d3',
    fontSize: 14,
    lineHeight: 20,
  },
  errorRetryHint: {
    color: '#d4a8a4',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    marginTop: 'auto',
    gap: 10,
    paddingBottom: 26,
  },
  primaryButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#1a1a1a',
  },
  secondaryButtonText: {
    color: '#c6c6c7',
    fontWeight: '600',
    fontSize: 15,
  },
});
