import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatAvaxFee } from '../services/ccip';
import { useBridgeFlow } from '../state/bridgeFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'BridgeReview'>;

function ChainBadge({
  color,
  letter,
  name,
  role,
}: {
  color: string;
  letter: string;
  name: string;
  role: string;
}) {
  return (
    <View style={badge.wrap}>
      <Text style={badge.role}>{role}</Text>
      <View style={badge.row}>
        <View style={[badge.logo, { backgroundColor: color }]}>
          <Text style={badge.logoText}>{letter}</Text>
        </View>
        <Text style={badge.name}>{name}</Text>
      </View>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  role: {
    color: '#6a6a6a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  name: { color: '#e5e2e1', fontSize: 15, fontWeight: '700' },
});

function ReviewRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={row.wrap}>
      <Text style={row.label}>{label}</Text>
      <Text style={[row.value, accent && row.valueAccent]}>{value}</Text>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  label: { color: '#9a9a9a', fontSize: 14 },
  value: { color: '#f2f2f2', fontSize: 14, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  valueAccent: { color: '#c8f323' },
});

export function BridgeReviewScreen({ navigation }: Props) {
  const { state, setStage } = useBridgeFlow();

  const receiverShort = state.receiver
    ? `${state.receiver.slice(0, 8)}...${state.receiver.slice(-6)}`
    : '—';

  const feeLabel = state.avaxFeeWei
    ? `${parseFloat(formatAvaxFee(state.avaxFeeWei)).toFixed(6)} AVAX`
    : '—';

  const handleConfirm = () => {
    setStage('nfc_approve');
    navigation.navigate('BridgeScan');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.topBar}>
          <Pressable style={s.backButton} onPress={handleBack}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        </View>

        <Text style={s.title}>Review Bridge</Text>
        <Text style={s.subtitle}>Confirm the details before signing</Text>

        {/* Route */}
        <View style={s.routeCard}>
          <ChainBadge color="#E84142" letter="A" name="Avalanche Fuji" role="From" />
          <View style={s.routeSep}>
            <Text style={s.routeArrow}>→</Text>
          </View>
          <ChainBadge color="#627EEA" letter="Ξ" name="Ethereum Sepolia" role="To" />
        </View>

        {/* Details */}
        <View style={s.detailCard}>
          <ReviewRow label="Token" value="USDC" />
          <ReviewRow label="Amount" value={`${state.amountUsdc} USDC`} />
          <ReviewRow label="Receiver" value={receiverShort} />
          <ReviewRow label="Fee (AVAX)" value={feeLabel} accent />
          <ReviewRow label="Protocol" value="Chainlink CCIP" />
          <View style={[row.wrap, { borderBottomWidth: 0 }]}>
            <Text style={row.label}>Estimated time</Text>
            <Text style={row.value}>5 – 30 minutes</Text>
          </View>
        </View>

        {/* Warning */}
        <View style={s.warningCard}>
          <Text style={s.warningTitle}>⚠ Two wallet scans required</Text>
          <Text style={s.warningBody}>
            You will need to tap your Better Wallet card twice — once to approve USDC and once to
            send the cross-chain message.
          </Text>
        </View>

        {/* CCIP badge */}
        <View style={s.ccipBadge}>
          <Text style={s.ccipBadgeText}>⛓ Powered by Chainlink CCIP</Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={s.cta} onPress={handleConfirm}>
          <Text style={s.ctaText}>Confirm & Sign</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#131313' },
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
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    marginBottom: 16,
  },
  routeSep: { paddingHorizontal: 8 },
  routeArrow: { color: '#c8f323', fontSize: 20, fontWeight: '700' },

  detailCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
  },

  warningCard: {
    marginTop: 14,
    backgroundColor: '#261e12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a3a1a',
    padding: 14,
    gap: 6,
  },
  warningTitle: { color: '#f0c060', fontSize: 14, fontWeight: '700' },
  warningBody: { color: '#d4b87a', fontSize: 13, lineHeight: 20 },

  ccipBadge: {
    marginTop: 16,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3d10',
    backgroundColor: 'rgba(200,243,35,0.07)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ccipBadgeText: { color: '#c8f323', fontSize: 12, fontWeight: '600' },

  footer: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },
  cta: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
  },
  ctaText: { color: '#1a2400', fontWeight: '700', fontSize: 16 },
});
