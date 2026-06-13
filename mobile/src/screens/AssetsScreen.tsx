import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSendFlow } from '../state/sendFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Assets'>;

const assets = [
  { symbol: 'BTC', name: 'Bitcoin', balance: '0.124 BTC', usd: '$5,241.12', delta: '+2.4%' },
  { symbol: 'ETH', name: 'Ethereum', balance: '1.42 ETH', usd: '$2,940.05', delta: '+5.1%' },
  { symbol: 'NEO', name: 'Neo', balance: '24.5 NEO', usd: '$308.11', delta: '-0.8%' },
];

export function AssetsScreen({ navigation }: Props) {
  const { reset } = useSendFlow();

  const goToSend = () => {
    reset();
    navigation.navigate('Send');
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Pressable style={s.iconButton}>
            <Text style={s.icon}>☰</Text>
          </Pressable>
          <View style={s.walletPill}>
            <Text style={s.walletPillText}>0x2489...4903</Text>
          </View>
          <Pressable style={s.iconButton}>
            <Text style={s.icon}>⚙</Text>
          </Pressable>
        </View>

        <View style={s.balanceHero}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          <Text style={s.balanceAmount}>$8,489.28</Text>
          <View style={s.deltaPill}>
            <Text style={s.deltaText}>+28.43% ($1,872.10)</Text>
          </View>
        </View>

        <View style={s.actionsWrap}>
          <Pressable style={s.actionButton} onPress={goToSend}>
            <Text style={s.actionText}>Send</Text>
          </Pressable>
          <Pressable style={s.mainAction} onPress={goToSend}>
            <Text style={s.mainActionText}>+</Text>
          </Pressable>
          <Pressable style={s.actionButton}>
            <Text style={s.actionText}>Receive</Text>
          </Pressable>
        </View>

        <View style={s.listHeader}>
          <Text style={s.listTitle}>My Assets</Text>
          <Pressable>
            <Text style={s.seeAll}>See all</Text>
          </Pressable>
        </View>

        <View style={s.listWrap}>
          {assets.map((asset) => (
            <Pressable key={asset.symbol} style={s.assetCard}>
              <View>
                <Text style={s.assetName}>{asset.name}</Text>
                <Text style={s.assetBalance}>{asset.balance}</Text>
              </View>
              <View style={s.assetRight}>
                <Text style={s.assetUsd}>{asset.usd}</Text>
                <Text style={[s.assetDelta, asset.delta.startsWith('-') ? s.down : s.up]}>
                  {asset.delta}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={s.bottomNav}>
        <View style={s.bottomItemActive}>
          <Text style={s.bottomItemActiveText}>Assets</Text>
        </View>
        <Text style={s.bottomItem}>Market</Text>
        <Text style={s.bottomItem}>Alerts</Text>
        <Text style={s.bottomItem}>Profile</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  topBar: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#c9c9c9',
    fontSize: 18,
  },
  walletPill: {
    backgroundColor: '#1c1b1b',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#272727',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletPillText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceHero: {
    marginTop: 30,
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    color: '#9a9a9a',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '700',
  },
  deltaPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(200,243,35,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deltaText: {
    color: '#c8f323',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsWrap: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1c1b1b',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  actionButton: {
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  actionText: {
    color: '#d0d0d0',
    fontSize: 13,
    fontWeight: '600',
  },
  mainAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#c8f323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionText: {
    color: '#1d2800',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  listHeader: {
    marginTop: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  seeAll: {
    color: '#c8f323',
    fontSize: 13,
    fontWeight: '600',
  },
  listWrap: {
    marginTop: 12,
    gap: 10,
  },
  assetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: 'rgba(19,19,19,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  assetName: {
    color: '#f3f3f3',
    fontSize: 17,
    fontWeight: '700',
  },
  assetBalance: {
    color: '#9a9a9a',
    marginTop: 4,
    fontSize: 13,
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetUsd: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  assetDelta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  up: {
    color: '#c8f323',
  },
  down: {
    color: '#ffb4ab',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    paddingHorizontal: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: 'rgba(14,14,14,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bottomItemActive: {
    backgroundColor: 'rgba(200,243,35,0.14)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bottomItemActiveText: {
    color: '#c8f323',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomItem: {
    color: '#868686',
    fontSize: 12,
    fontWeight: '600',
  },
});
