import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useBridgeFlow } from '../state/bridgeFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'BridgeSuccess'>;

export function BridgeSuccessScreen({ navigation }: Props) {
  const { state, reset } = useBridgeFlow();

  const shortMessageId = state.messageId
    ? `${state.messageId.slice(0, 12)}…${state.messageId.slice(-8)}`
    : '—';

  const handleTrack = () => {
    if (!state.messageId) return;
    void Linking.openURL(`https://ccip.chain.link/msg/${state.messageId}`);
  };

  const handleDone = () => {
    reset();
    navigation.replace('Assets');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        {/* Success icon */}
        <View style={s.iconWrap}>
          <View style={s.iconCircle}>
            <Text style={s.iconText}>✓</Text>
          </View>
        </View>

        <Text style={s.title}>Bridge Initiated!</Text>
        <Text style={s.subtitle}>
          Your USDC is on its way from Avalanche Fuji to Ethereum Sepolia via Chainlink CCIP.
        </Text>

        {/* Details card */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>Amount</Text>
            <Text style={s.cardValue}>{state.amountUsdc} USDC</Text>
          </View>
          <View style={s.divider} />
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>From</Text>
            <View style={s.chainTag}>
              <View style={[s.chainDot, { backgroundColor: '#E84142' }]} />
              <Text style={s.cardValue}>Avalanche Fuji</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>To</Text>
            <View style={s.chainTag}>
              <View style={[s.chainDot, { backgroundColor: '#627EEA' }]} />
              <Text style={s.cardValue}>Ethereum Sepolia</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>Message ID</Text>
            <Text style={[s.cardValue, s.cardValueMono]}>{shortMessageId}</Text>
          </View>
        </View>

        <View style={s.timeCard}>
          <Text style={s.timeText}>
            ⏱ USDC typically arrives within 5–30 minutes. Track your transfer below.
          </Text>
        </View>

        <View style={s.footer}>
          <Pressable style={s.trackButton} onPress={handleTrack}>
            <Text style={s.trackButtonText}>Track on CCIP Explorer ↗</Text>
          </Pressable>
          <Pressable style={s.doneButton} onPress={handleDone}>
            <Text style={s.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#131313' },
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  iconWrap: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(200,243,35,0.15)',
    borderWidth: 2,
    borderColor: '#c8f323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#c8f323', fontSize: 40, fontWeight: '700', lineHeight: 48 },

  title: {
    color: '#e5e2e1',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#9a9a9a',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },

  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  cardLabel: { color: '#9a9a9a', fontSize: 14 },
  cardValue: { color: '#f2f2f2', fontSize: 14, fontWeight: '600' },
  cardValueMono: { fontSize: 12 },
  divider: { height: 1, backgroundColor: '#222' },
  chainTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chainDot: { width: 8, height: 8, borderRadius: 4 },

  timeCard: {
    marginTop: 14,
    backgroundColor: 'rgba(200,243,35,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,243,35,0.18)',
    padding: 14,
  },
  timeText: { color: '#c8f323', fontSize: 13, lineHeight: 20, fontWeight: '600' },

  footer: {
    marginTop: 'auto',
    gap: 10,
    paddingBottom: 28,
  },
  trackButton: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#1a1a1a',
  },
  trackButtonText: { color: '#c8f323', fontWeight: '700', fontSize: 15 },
  doneButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
  },
  doneButtonText: { color: '#1a2400', fontWeight: '700', fontSize: 16 },
});
