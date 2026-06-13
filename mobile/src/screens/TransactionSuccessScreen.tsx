import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSendFlow } from '../state/sendFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

function shortHash(hash: string): string {
  if (hash.length < 20) {
    return hash;
  }
  return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

export function TransactionSuccessScreen({ navigation }: Props) {
  const { state, reset } = useSendFlow();
  const result = state.result;
  const review = state.review;

  if (!result || !review) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.title}>No transaction result found.</Text>
          <Pressable
            style={s.button}
            onPress={() => {
              reset();
              navigation.reset({ index: 0, routes: [{ name: 'Assets' }] });
            }}
          >
            <Text style={s.buttonText}>Back to Assets</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>
        <View style={s.checkWrap}>
          <Text style={s.check}>✓</Text>
        </View>

        <Text style={s.title}>Transaction Sent</Text>
        <Text style={s.subtitle}>
          Your {review.amountEth} ETH transaction is now in flight on Ethereum.
        </Text>

        <View style={s.card}>
          <Text style={s.label}>Transaction Hash</Text>
          <Text style={s.hash}>{shortHash(result.txHash)}</Text>
          <Text style={s.meta}>{result.simulated ? 'Simulated broadcast hash (mock signer)' : 'Broadcast confirmed to RPC'}</Text>
        </View>

        <Pressable style={s.linkButton} onPress={() => Linking.openURL(result.explorerUrl)}>
          <Text style={s.linkText}>View on Explorer</Text>
        </Pressable>

        <View style={s.footer}>
          <Pressable
            style={s.button}
            onPress={() => {
              reset();
              navigation.reset({ index: 0, routes: [{ name: 'Assets' }] });
            }}
          >
            <Text style={s.buttonText}>Done</Text>
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
    paddingTop: 48,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  checkWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#c8f323',
    justifyContent: 'center',
    alignItems: 'center',
  },
  check: {
    color: '#263300',
    fontSize: 56,
    fontWeight: '700',
  },
  title: {
    marginTop: 26,
    fontSize: 34,
    color: '#f2f2f2',
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#adadad',
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    marginTop: 24,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#323232',
    backgroundColor: '#1a1a1a',
    padding: 16,
    gap: 8,
  },
  label: {
    color: '#9a9a9a',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hash: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: '#8d8d8d',
    fontSize: 13,
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkText: {
    color: '#c8f323',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    width: '100%',
    paddingBottom: 24,
  },
  button: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 18,
  },
});
