import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildPairRequest, parsePairResponse } from '../services/pairing';
import { useWallet } from '../state/wallet';
import { useHCE } from '../useHCE';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Setup'>;
type PairPhase = 'idle' | 'tap1' | 'tap2' | 'saving';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SetupWalletScreen({ navigation }: Props) {
  const { saveWallet } = useWallet();
  const { loadPayload, waitForSignedTxOnce, clearSignedTxListener } = useHCE();
  const [phase, setPhase] = useState<PairPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const isRunningRef = useRef(false);

  const phaseText = useMemo(() => {
    if (phase === 'tap1') {
      return 'Tap 1: send pair request to hardware wallet.';
    }
    if (phase === 'tap2') {
      return 'Tap 2: receive paired wallet metadata.';
    }
    if (phase === 'saving') {
      return 'Saving paired wallet to this device.';
    }
    return 'Pair your Better Wallet by tapping your NFC hardware wallet.';
  }, [phase]);

  const runPairing = async () => {
    if (isRunningRef.current) {
      return;
    }
    isRunningRef.current = true;
    setError(null);
    clearSignedTxListener();

    try {
      const request = buildPairRequest();
      setPhase('tap1');
      loadPayload(request);

      await wait(2200);
      setPhase('tap2');
      const responseJson = await waitForSignedTxOnce(45000);
      const profile = parsePairResponse(responseJson);

      setPhase('saving');
      await saveWallet(profile);
      navigation.reset({ index: 0, routes: [{ name: 'Assets' }] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to pair wallet over NFC.';
      setError(message);
      setPhase('idle');
    } finally {
      clearSignedTxListener();
      isRunningRef.current = false;
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        <Text style={s.title}>Set up Better Wallet</Text>
        <Text style={s.subtitle}>EVM pairing only (Sepolia, chainId 11155111)</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>NFC Pairing Protocol</Text>
          <Text style={s.cardBody}>
            Mobile sends `pair_request` with chain `evm` and chainId `11155111`. Hardware should return
            `pair_response` with minimal fields only: `address`, `chain`, `chainId`,
            `protocolVersion`, `type`.
          </Text>
        </View>

        <View style={s.statusCard}>
          <Text style={s.statusLabel}>Status</Text>
          <Text style={s.statusText}>{phaseText}</Text>
          {phase !== 'idle' ? <ActivityIndicator color="#c8f323" style={s.spinner} /> : null}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.footer}>
          <Pressable style={s.primary} onPress={runPairing}>
            <Text style={s.primaryText}>{phase === 'idle' ? 'Pair Hardware Wallet' : 'Retry Pairing'}</Text>
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
    paddingTop: 30,
  },
  title: {
    color: '#f0f0f0',
    fontSize: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9d9d9d',
    marginTop: 8,
    fontSize: 14,
  },
  card: {
    marginTop: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    backgroundColor: '#1a1a1a',
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: '#c8f323',
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    color: '#d0d0d0',
    fontSize: 14,
    lineHeight: 21,
  },
  statusCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  statusLabel: {
    color: '#9d9d9d',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontSize: 11,
  },
  statusText: {
    color: '#f0f0f0',
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  error: {
    marginTop: 14,
    color: '#ffb4ab',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 30,
  },
  primary: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryText: {
    color: '#1a2400',
    fontSize: 17,
    fontWeight: '700',
  },
});
