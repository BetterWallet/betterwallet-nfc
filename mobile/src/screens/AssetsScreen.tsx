import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { NETWORK_OPTIONS, useNetwork } from '../state/network';
import { NetworkLogo } from '../components/NetworkLogo';
import type { PortfolioAsset, PortfolioSnapshot } from '../types/portfolio';

type Props = NativeStackScreenProps<RootStackParamList, 'Assets'>;

export function AssetsScreen({ navigation }: Props) {
  const { reset } = useSendFlow();
  const { wallet, clearWallet } = useWallet();
  const { selectedNetwork, setSelectedNetwork, networkOption } = useNetwork();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
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

  const goToBridge = () => {
    navigation.navigate('Bridge');
  };

  const onGearPress = () => {
    Alert.alert('Settings', undefined, [
      {
        text: 'Unpair Wallet',
        style: 'destructive',
        onPress: () => void clearWallet(),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
        const nextPortfolio = await getPortfolio(wallet.address, selectedNetwork);
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
    [wallet?.address, selectedNetwork],
  );

  useEffect(() => {
    if (!wallet?.address) {
      return;
    }
    setPortfolio(null);
    setError(null);
    void loadPortfolio();
  }, [loadPortfolio, wallet?.address, selectedNetwork]);

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
          <View style={s.iconButton} />
          <Pressable style={s.networkPill} onPress={() => setShowNetworkModal(true)}>
            <NetworkLogo network={networkOption.key} size={20} />
            <Text style={s.networkPillText}>{networkOption.label}</Text>
            <Text style={s.networkChevron}>▾</Text>
          </Pressable>
          <Pressable style={s.iconButton} onPress={onGearPress}>
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
          <View style={s.actionDivider} />
          <Pressable style={s.actionButton} onPress={goToSwap}>
            <Text style={s.actionText}>Swap</Text>
          </Pressable>
          <View style={s.actionDivider} />
          <Pressable style={s.actionButton} onPress={goToBridge}>
            <Text style={s.actionText}>Bridge</Text>
          </Pressable>
          <View style={s.actionDivider} />
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
                Fund this wallet on {networkOption.label} to see your live token balances.
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

      <Modal
        visible={showNetworkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowNetworkModal(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Network</Text>
            {NETWORK_OPTIONS.map((option) => {
              const isSelected = option.key === selectedNetwork;
              return (
                <Pressable
                  key={option.key}
                  style={[s.networkOption, isSelected && s.networkOptionSelected]}
                  onPress={() => {
                    setSelectedNetwork(option.key);
                    setShowNetworkModal(false);
                  }}
                >
                  <NetworkLogo network={option.key} size={36} />
                  <Text style={[s.networkOptionText, isSelected && s.networkOptionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected ? <Text style={s.networkCheckmark}>✓</Text> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: 40,
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
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1c1b1b',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#272727',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  networkPillText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
  },
  networkChevron: {
    color: '#888',
    fontSize: 12,
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1c1b1b',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionText: {
    color: '#d0d0d0',
    fontSize: 13,
    fontWeight: '600',
  },
  actionDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#2a2a2a',
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
  // Network selection modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 4,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3a',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  networkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  networkOptionSelected: {
    backgroundColor: 'rgba(200,243,35,0.08)',
  },
  networkOptionText: {
    flex: 1,
    color: '#c0c0c0',
    fontSize: 15,
    fontWeight: '600',
  },
  networkOptionTextSelected: {
    color: '#fff',
  },
  networkCheckmark: {
    color: '#c8f323',
    fontSize: 16,
    fontWeight: '700',
  },
});
