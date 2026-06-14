import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { formatTokenAmount, formatUsd } from '../services/portfolioFormatting';
import { getPortfolio } from '../services/portfolio';
import { useSendFlow } from '../state/sendFlow';
import { useWallet } from '../state/wallet';
import type { PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';

type Props = NativeStackScreenProps<RootStackParamList, 'Assets'>;

export function AssetsScreen({ navigation }: Props) {
  const { reset } = useSendFlow();
  const { wallet, clearWallet } = useWallet();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const goToSend = () => {
    reset();
    navigation.navigate('Send');
  };

  const goToSwap = () => {
    reset();
    navigation.navigate('Swap');
  };

  const goToReceive = () => {
    navigation.navigate('Receive');
  };

  const loadPortfolio = useCallback(
    async (refresh = false) => {
      if (!wallet?.address) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const nextPortfolio = await getPortfolio(wallet.address);
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        setPortfolio(nextPortfolio);
        setError(null);
      } catch (err) {
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Unable to load portfolio right now. Please retry.';
        setError(message);
      } finally {
        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }
        if (refresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [wallet?.address],
  );

  useEffect(() => {
    if (!wallet?.address) {
      return;
    }
    setPortfolio(null);
    setError(null);
    void loadPortfolio();
  }, [loadPortfolio, wallet?.address]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const assets = useMemo(
    () => (portfolio?.assets ?? []).filter((asset) => asset.amount > 0),
    [portfolio?.assets],
  );
  const totalBalanceLabel = portfolio ? formatUsd(portfolio.totalUsd) : '--';
  const updatedAtLabel = useMemo(() => {
    if (!portfolio?.updatedAt) {
      return 'Live portfolio';
    }
    const date = new Date(portfolio.updatedAt);
    return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }, [portfolio?.updatedAt]);

  if (!wallet) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>No paired wallet profile found.</Text>
          <Pressable style={s.primaryAction} onPress={() => void clearWallet()}>
            <Text style={s.primaryActionText}>Go to Setup</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !portfolio) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#c8f323" size="large" />
          <Text style={s.loadingText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor="#c8f323"
            refreshing={isRefreshing}
            onRefresh={() => {
              void loadPortfolio(true);
            }}
          />
        }
      >
        <View style={s.topBar}>
          <Pressable style={s.iconButton}>
            <Text style={s.icon}>☰</Text>
          </Pressable>
          <View style={s.topBarCenter}>
            <View style={s.walletPill}>
              <Text style={s.walletPillText}>
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </Text>
            </View>
            <Text style={s.networkBadge}>{wallet.networkName}</Text>
          </View>
          <Pressable style={s.iconButton}>
            <Text style={s.icon}>⚙</Text>
          </Pressable>
        </View>

        <View style={s.balanceHero}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          <Text style={s.balanceAmount}>{totalBalanceLabel}</Text>
          <View style={s.deltaPill}>
            <Text style={s.deltaText}>{updatedAtLabel}</Text>
          </View>
        </View>

        <View style={s.actionsWrap}>
          <Pressable style={s.actionButton} onPress={goToSend}>
            <Text style={s.actionText}>Send</Text>
          </Pressable>
          <Pressable style={s.mainAction} onPress={goToSwap}>
            <Text style={s.mainActionText}>⇄</Text>
          </Pressable>
          <Pressable style={s.actionButton} onPress={goToReceive}>
            <Text style={s.actionText}>Receive</Text>
          </Pressable>
        </View>

        <View style={s.listHeader}>
          <Text style={s.listTitle}>My Assets</Text>
          <Text style={s.seeAll}>{assets.length}</Text>
        </View>

        {error ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Portfolio unavailable</Text>
            <Text style={s.errorBody}>{error}</Text>
            <Pressable
              style={s.retryButton}
              onPress={() => {
                void loadPortfolio();
              }}
            >
              <Text style={s.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.listWrap}>
          {assets.length === 0 ? (
            <View style={s.emptyAssetCard}>
              <Text style={s.emptyAssetTitle}>No assets yet</Text>
              <Text style={s.emptyAssetHint}>
                Fund this wallet on Sepolia to see your live token balances.
              </Text>
            </View>
          ) : (
            assets.map((asset) => (
              <Pressable key={asset.symbol} style={s.assetCard}>
                <View style={s.assetLeft}>
                  <TokenIcon asset={asset} />
                  <View>
                    <Text style={s.assetName}>{asset.name}</Text>
                    <Text style={s.assetBalance}>
                      {formatTokenAmount(asset.amount, asset.priceUsd)} {asset.symbol}
                    </Text>
                  </View>
                </View>
                <View style={s.assetRight}>
                  <Text style={s.assetUsd}>{formatUsd(asset.valueUsd)}</Text>
                  <Text style={s.assetPrice}>@ {formatUsd(asset.priceUsd)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <View style={s.bottomNav}>
        <View style={s.bottomItemActive}>
          <Text style={s.bottomItemActiveText}>Assets</Text>
        </View>
        <Text style={s.bottomItem}>Market</Text>
        <Text style={s.bottomItem}>Alerts</Text>
        <Pressable onPress={() => void clearWallet()}>
          <Text style={s.bottomItem}>Unpair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TokenIcon({ asset }: { asset: PortfolioAsset }) {
  if (asset.imageUrl) {
    return <Image source={{ uri: asset.imageUrl }} style={s.assetImage} resizeMode="cover" />;
  }

  return (
    <View style={s.assetFallback}>
      <Text style={s.assetFallbackText}>{asset.symbol.slice(0, 3)}</Text>
    </View>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#d0d0d0',
    fontSize: 14,
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
  topBarCenter: {
    alignItems: 'center',
    gap: 4,
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
  networkBadge: {
    color: '#c8f323',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
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
  uniswapBadge: {
    marginTop: 10,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6f3558',
    backgroundColor: '#2b1724',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  uniswapBadgeText: {
    color: '#f3c5e5',
    fontSize: 12,
    fontWeight: '600',
  },
  listHeader: {
    marginTop: 28,
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
  errorCard: {
    marginTop: 14,
    backgroundColor: '#2a1717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: '#ffb4ab',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBody: {
    color: '#ffd8d3',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ffb4ab',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  retryButtonText: {
    color: '#3a1511',
    fontSize: 12,
    fontWeight: '700',
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
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  assetImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#202020',
  },
  assetFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetFallbackText: {
    color: '#d8d8d8',
    fontSize: 10,
    fontWeight: '700',
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
  assetPrice: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#c8f323',
  },
  emptyAssetCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#171717',
    padding: 16,
    gap: 8,
  },
  emptyAssetTitle: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyAssetHint: {
    color: '#a5a5a5',
    fontSize: 13,
    lineHeight: 19,
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#f0f0f0',
    fontSize: 16,
  },
  primaryAction: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#1a2400',
    fontWeight: '700',
  },
});
