import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAddress } from 'ethers';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { estimateCcipFee, formatAvaxFee } from '../services/ccip';
import { useBridgeFlow } from '../state/bridgeFlow';
import { useWallet } from '../state/wallet';

type Props = NativeStackScreenProps<RootStackParamList, 'Bridge'>;

function AvalancheLogo({ size = 28 }: { size?: number }) {
  return (
    <View
      style={[
        logo.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[logo.letter, { fontSize: size * 0.45 }]}>A</Text>
    </View>
  );
}

function EthereumLogo({ size = 28 }: { size?: number }) {
  return (
    <View
      style={[
        logo.ethWrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[logo.letter, { fontSize: size * 0.45 }]}>Ξ</Text>
    </View>
  );
}

const logo = StyleSheet.create({
  wrap: {
    backgroundColor: '#E84142',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ethWrap: {
    backgroundColor: '#627EEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#fff',
    fontWeight: '800',
  },
});

export function BridgeScreen({ navigation }: Props) {
  const { state, setAmount, setReceiver, setFee, setStage, reset } = useBridgeFlow();
  const { wallet } = useWallet();

  const [localAmount, setLocalAmount] = useState(state.amountUsdc);
  const [localReceiver, setLocalReceiver] = useState(
    state.receiver || wallet?.address || '',
  );
  const [estimating, setEstimating] = useState(false);
  const [feeLabel, setFeeLabel] = useState<string | null>(null);

  const handleEstimate = useCallback(async () => {
    const receiver = localReceiver.trim();
    if (!receiver || !isAddress(receiver)) {
      Alert.alert('Invalid address', 'Please enter a valid receiver address on Ethereum Sepolia.');
      return;
    }
    const amount = localAmount.trim();
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a USDC amount greater than 0.');
      return;
    }
    setEstimating(true);
    setFeeLabel(null);
    try {
      const fee = await estimateCcipFee(receiver, amount);
      setFeeLabel(`${parseFloat(formatAvaxFee(fee)).toFixed(6)} AVAX`);
      setFee(fee);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fee estimation failed.';
      Alert.alert('Estimation failed', msg);
    } finally {
      setEstimating(false);
    }
  }, [localAmount, localReceiver, setFee]);

  const handlePreview = useCallback(() => {
    const receiver = localReceiver.trim();
    const amount = localAmount.trim();

    if (!receiver || !isAddress(receiver)) {
      Alert.alert('Invalid address', 'Please enter a valid receiver address on Ethereum Sepolia.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a USDC amount greater than 0.');
      return;
    }
    if (!state.avaxFeeWei) {
      Alert.alert('Estimate first', 'Tap "Estimate Fee" before previewing the transfer.');
      return;
    }

    setAmount(amount);
    setReceiver(receiver);
    setStage('review');
    navigation.navigate('BridgeReview');
  }, [
    localAmount,
    localReceiver,
    navigation,
    setAmount,
    setReceiver,
    setStage,
    state.avaxFeeWei,
  ]);

  const handleBack = () => {
    reset();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.topBar}>
            <Pressable style={s.backButton} onPress={handleBack}>
              <Text style={s.backText}>← Back</Text>
            </Pressable>
          </View>

          <Text style={s.title}>Bridge USDC</Text>
          <Text style={s.subtitle}>Cross-chain via Chainlink CCIP</Text>

          {/* Route card */}
          <View style={s.routeCard}>
            <View style={s.chainPill}>
              <AvalancheLogo size={26} />
              <View>
                <Text style={s.chainPillLabel}>FROM</Text>
                <Text style={s.chainPillName}>Avalanche Fuji</Text>
              </View>
            </View>

            <View style={s.routeArrow}>
              <Text style={s.routeArrowText}>→</Text>
            </View>

            <View style={s.chainPill}>
              <EthereumLogo size={26} />
              <View>
                <Text style={s.chainPillLabel}>TO</Text>
                <Text style={s.chainPillName}>Ethereum Sepolia</Text>
              </View>
            </View>
          </View>

          {/* CCIP badge */}
          <View style={s.ccipBadge}>
            <Text style={s.ccipBadgeText}>⛓ Powered by Chainlink CCIP</Text>
          </View>

          {/* Amount input */}
          <Text style={s.fieldLabel}>USDC Amount</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={localAmount}
              onChangeText={(v) => {
                setLocalAmount(v);
                setFeeLabel(null);
              }}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="#555"
              selectionColor="#c8f323"
            />
            <View style={s.inputToken}>
              <Text style={s.inputTokenText}>USDC</Text>
            </View>
          </View>

          {/* Receiver input */}
          <Text style={s.fieldLabel}>Receiver Address (Ethereum Sepolia)</Text>
          <TextInput
            style={[s.input, s.addressInput]}
            value={localReceiver}
            onChangeText={setLocalReceiver}
            placeholder="0x..."
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor="#c8f323"
          />
          {wallet?.address && localReceiver === wallet.address ? (
            <Text style={s.selfNote}>Your wallet address (same key, different chain)</Text>
          ) : null}

          {/* Fee estimate */}
          <Pressable
            style={[s.estimateButton, estimating && s.estimateButtonDisabled]}
            onPress={() => void handleEstimate()}
            disabled={estimating}
          >
            {estimating ? (
              <ActivityIndicator color="#c8f323" size="small" />
            ) : (
              <Text style={s.estimateButtonText}>Estimate Fee</Text>
            )}
          </Pressable>

          {feeLabel ? (
            <View style={s.feeCard}>
              <Text style={s.feeLabel}>Estimated CCIP Fee</Text>
              <Text style={s.feeValue}>{feeLabel}</Text>
              <Text style={s.feeNote}>Paid in native AVAX on Avalanche Fuji</Text>
            </View>
          ) : null}

          <View style={s.infoCard}>
            <Text style={s.infoTitle}>How it works</Text>
            <Text style={s.infoBody}>
              1. Approve USDC on Fuji (tap card once){'\n'}
              2. Send via CCIP router (tap card again){'\n'}
              3. USDC arrives on Ethereum Sepolia in 5–30 min
            </Text>
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={s.footer}>
          <Pressable
            style={[s.cta, !state.avaxFeeWei && s.ctaDisabled]}
            onPress={handlePreview}
            disabled={!state.avaxFeeWei}
          >
            <Text style={s.ctaText}>Preview Transfer</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#131313' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  topBar: { marginTop: 8, marginBottom: 4 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: '#a8a8a8', fontSize: 15, fontWeight: '600' },
  title: { color: '#e5e2e1', fontSize: 30, fontWeight: '700', marginTop: 12 },
  subtitle: { color: '#a8a8a8', fontSize: 15, marginTop: 6, marginBottom: 24 },

  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    gap: 8,
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  chainPillLabel: {
    color: '#6a6a6a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  chainPillName: {
    color: '#e5e2e1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  routeArrow: {
    paddingHorizontal: 6,
  },
  routeArrowText: {
    color: '#c8f323',
    fontSize: 22,
    fontWeight: '700',
  },

  ccipBadge: {
    marginTop: 10,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3d10',
    backgroundColor: 'rgba(200,243,35,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ccipBadgeText: {
    color: '#c8f323',
    fontSize: 12,
    fontWeight: '600',
  },

  fieldLabel: {
    color: '#9a9a9a',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: '#f2f2f2',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputToken: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a2a',
  },
  inputTokenText: { color: '#c8f323', fontWeight: '700', fontSize: 14 },
  addressInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
    fontSize: 13,
    paddingVertical: 14,
  },
  selfNote: {
    color: '#6a6a6a',
    fontSize: 12,
    marginTop: 6,
  },

  estimateButton: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    alignItems: 'center',
  },
  estimateButtonDisabled: { opacity: 0.5 },
  estimateButtonText: { color: '#c6c6c7', fontWeight: '600', fontSize: 15 },

  feeCard: {
    marginTop: 14,
    backgroundColor: 'rgba(200,243,35,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,243,35,0.2)',
    padding: 14,
    gap: 4,
  },
  feeLabel: { color: '#a8a8a8', fontSize: 12, fontWeight: '600' },
  feeValue: { color: '#c8f323', fontSize: 22, fontWeight: '700' },
  feeNote: { color: '#6a6a6a', fontSize: 12 },

  infoCard: {
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
    gap: 8,
  },
  infoTitle: { color: '#e5e2e1', fontSize: 14, fontWeight: '700' },
  infoBody: { color: '#9a9a9a', fontSize: 13, lineHeight: 22 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },
  cta: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: { color: '#1a2400', fontWeight: '700', fontSize: 16 },
});
