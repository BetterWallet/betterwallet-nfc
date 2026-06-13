import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { parseSignedTxMessage, broadcastSignedResult } from '../services/broadcast';
import { buildSignRequest } from '../services/ethTransaction';
import { useSendFlow } from '../state/sendFlow';
import { useHCE } from '../useHCE';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

const TAP1_HINT_MS = 2200;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ScanCardScreen({ navigation }: Props) {
  const { state, setStage, setSignedTx, setResult, setError, reset } = useSendFlow();
  const { loadPayload, waitForSignedTxOnce, clearSignedTxListener } = useHCE();

  const [localError, setLocalError] = useState<string | null>(null);
  const [runNonce, setRunNonce] = useState(0);
  const startedRef = useRef(false);

  const phaseLabel = useMemo(() => {
    if (state.stage === 'tap1') {
      return 'Tap 1';
    }
    if (state.stage === 'tap2') {
      return 'Tap 2';
    }
    if (state.stage === 'broadcasting') {
      return 'Broadcasting';
    }
    return 'Preparing';
  }, [state.stage]);

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

        const signRequest = buildSignRequest(review);
        const signedPayloadPromise = waitForSignedTxOnce(45000);
        setStage('tap1');
        loadPayload(signRequest);

        await delay(TAP1_HINT_MS);
        if (cancelled) {
          return;
        }

        setStage('tap2');
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
    waitForSignedTxOnce,
  ]);

  const onRetry = () => {
    startedRef.current = false;
    setLocalError(null);
    setError(null);
    setStage('tap1');
    setRunNonce((value) => value + 1);
  };

  const onCancel = () => {
    clearSignedTxListener();
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
        <Text style={s.title}>Ready to Scan</Text>
        <Text style={s.subtitle}>
          Hold your Better Card in the middle of your phone. This Android build uses two NFC taps.
        </Text>

        <View style={s.phaseCard}>
          <Text style={s.phase}>{phaseLabel}</Text>
          <Text style={s.phaseHint}>
            {state.stage === 'tap1' && 'Phone to Pi: sending sign request payload.'}
            {state.stage === 'tap2' && 'Pi to Phone: waiting for signed payload.'}
            {state.stage === 'broadcasting' && 'Submitting transaction result to network.'}
          </Text>
          <ActivityIndicator color="#c8f323" size="large" style={s.spinner} />
        </View>

        {localError ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Flow error</Text>
            <Text style={s.errorBody}>{localError}</Text>
          </View>
        ) : null}

        <View style={s.footer}>
          {localError ? (
            <Pressable style={s.primaryButton} onPress={onRetry}>
              <Text style={s.primaryButtonText}>Retry Scan</Text>
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
