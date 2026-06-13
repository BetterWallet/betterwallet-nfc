import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createReviewDetails, validateAmount, validateRecipientAddress } from '../services/ethTransaction';
import { useSendFlow } from '../state/sendFlow';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Send'>;

export function SendScreen({ navigation }: Props) {
  const { state, setDraft, setReview, setStage } = useSendFlow();
  const [localError, setLocalError] = useState<string | null>(null);

  const usdEstimate = useMemo(() => {
    const amount = Number(state.draft.amountEth || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return '$0.00';
    }
    return `$${(amount * 3400).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [state.draft.amountEth]);

  const onContinue = () => {
    if (!validateRecipientAddress(state.draft.to)) {
      const message = 'Enter a valid Ethereum recipient address.';
      setLocalError(message);
      return;
    }

    if (!validateAmount(state.draft.amountEth)) {
      const message = 'Enter a valid amount greater than 0.';
      setLocalError(message);
      return;
    }

    const review = createReviewDetails(state.draft);
    setReview(review);
    setStage('review');
    setLocalError(null);
    navigation.navigate('Review');
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={s.flex}
      >
        <View style={s.header}>
          <Pressable style={s.backButton} onPress={() => navigation.navigate('Assets')}>
            <Text style={s.backButtonText}>Back</Text>
          </Pressable>
          <Text style={s.title}>Send</Text>
          <Text style={s.subtitle}>Better Wallet</Text>
          <Text style={s.networkBadge}>EVM / Sepolia</Text>
        </View>

        <View style={s.section}>
          <Text style={s.label}>To Recipient</Text>
          <TextInput
            value={state.draft.to}
            onChangeText={(value) => setDraft({ to: value })}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x..."
            placeholderTextColor="#777"
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Amount (ETH)</Text>
          <TextInput
            value={state.draft.amountEth}
            onChangeText={(value) => setDraft({ amountEth: value })}
            style={s.amountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#777"
          />
          <Text style={s.usd}>{usdEstimate}</Text>
        </View>

        {localError ? <Text style={s.error}>{localError}</Text> : null}

        <View style={s.footer}>
          <Pressable style={s.cta} onPress={onContinue}>
            <Text style={s.ctaText}>Review Transaction</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
  },
  flex: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 24,
    marginBottom: 28,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    backgroundColor: '#1a1a1a',
  },
  backButtonText: {
    color: '#d8d8d8',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: '#e5e2e1',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8e8e8e',
    fontSize: 14,
    marginTop: 4,
  },
  networkBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    color: '#c8f323',
    borderColor: '#405000',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 22,
  },
  label: {
    color: '#b2b2b2',
    fontSize: 12,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    color: '#ffffff',
    backgroundColor: '#1d1d1d',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontSize: 15,
  },
  amountInput: {
    color: '#ffffff',
    backgroundColor: '#1d1d1d',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    fontSize: 32,
    fontWeight: '600',
  },
  usd: {
    color: '#8a8a8a',
    marginTop: 10,
    fontSize: 16,
  },
  error: {
    marginTop: 4,
    color: '#ff9188',
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 26,
  },
  cta: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  ctaText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 17,
  },
});
