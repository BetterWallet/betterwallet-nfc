import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSendFlow } from '../state/sendFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

function maskAddress(address: string) {
  if (address.length < 12) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function ReviewScreen({ navigation }: Props) {
  const { state, setStage, setError } = useSendFlow();

  if (!state.review) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>No transaction ready for review.</Text>
          <Pressable style={s.secondaryButton} onPress={() => navigation.replace('Send')}>
            <Text style={s.secondaryButtonText}>Back to Send</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { review } = state;

  const onConfirm = () => {
    setError(null);
    setStage('nfc');
    navigation.navigate('Scan');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        <Text style={s.title}>Confirm Transaction</Text>

        <View style={s.card}>
          <Text style={s.label}>To Address</Text>
          <Text style={s.value}>{maskAddress(review.to)}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Network</Text>
          <Text style={s.value}>Ethereum</Text>
        </View>

        <View style={s.summary}>
          <Row label="Amount" value={`${review.amountEth} ETH`} />
          <Row label="Amount (USD)" value={`$${review.amountUsd}`} />
          <Row label="Estimated Fee" value={`${review.estimatedFeeEth} ETH`} />
          <Row label="Network Fee (USD)" value={`$${review.estimatedFeeUsd}`} />
          <Row label="Total" value={`${review.totalEth} ETH`} strong />
          <Row label="Total (USD)" value={`$${review.totalUsd}`} strong />
        </View>

        <View style={s.footer}>
          <Pressable style={s.primaryButton} onPress={onConfirm}>
            <Text style={s.primaryButtonText}>Confirm &amp; Sign</Text>
          </Pressable>
          <Pressable style={s.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={s.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, strong && s.strong]}>{label}</Text>
      <Text style={[s.rowValue, strong && s.strong]}>{value}</Text>
    </View>
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
    paddingTop: 24,
  },
  title: {
    fontSize: 30,
    color: '#e5e2e1',
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1d1d1d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: '#919191',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    color: '#f2f2f2',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: {
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: '#aaaaaa',
    fontSize: 14,
  },
  rowValue: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '600',
  },
  strong: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 28,
    gap: 10,
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
    fontSize: 17,
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
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    color: '#e5e2e1',
    fontSize: 16,
    textAlign: 'center',
  },
});
