import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  fetchSepoliaSwapTokens,
  filterTokens,
  findTokenByAddress,
  SEPOLIA_SWAP_TOKENS,
  SWAP_NETWORK,
  truncateAddress,
  type SwapTokenOption,
} from '../config/swapTokens';
import { resolveSepoliaToken } from '../services/tokenMetadata';

type Props = {
  visible: boolean;
  side: 'sell' | 'buy';
  selectedToken: SwapTokenOption;
  excludeToken: SwapTokenOption;
  iconBySymbol: Record<string, string>;
  onClose: () => void;
  onSelect: (token: SwapTokenOption) => void;
};

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function TokenSelectModal({
  visible,
  side,
  selectedToken,
  excludeToken,
  iconBySymbol,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const [tokens, setTokens] = useState<SwapTokenOption[]>(SEPOLIA_SWAP_TOKENS);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<SwapTokenOption | null>(null);
  const [isResolvingToken, setIsResolvingToken] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setTokens(SEPOLIA_SWAP_TOKENS);
      setIsLoadingTokens(false);
      setResolvedToken(null);
      setResolveError(null);
      setIsResolvingToken(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    setIsLoadingTokens(true);

    void fetchSepoliaSwapTokens()
      .then((nextTokens) => {
        if (!cancelled && nextTokens.length > 0) {
          setTokens(nextTokens);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTokens(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!ADDRESS_PATTERN.test(trimmedQuery)) {
      setResolvedToken(null);
      setResolveError(null);
      setIsResolvingToken(false);
      return;
    }

    let cancelled = false;
    setIsResolvingToken(true);
    setResolveError(null);

    const timer = setTimeout(() => {
      void resolveSepoliaToken(trimmedQuery)
        .then((token) => {
          if (cancelled) {
            return;
          }
          setResolvedToken(token);
          if (!token) {
            setResolveError('Token not found on Sepolia.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsResolvingToken(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const filteredTokens = useMemo(() => {
    const filtered = filterTokens(query, tokens);
    if (!resolvedToken) {
      return filtered;
    }
    if (findTokenByAddress(resolvedToken.address, filtered)) {
      return filtered;
    }
    return [resolvedToken, ...filtered];
  }, [query, resolvedToken, tokens]);

  const onPressToken = (token: SwapTokenOption) => {
    if (token.address.toLowerCase() === excludeToken.address.toLowerCase()) {
      return;
    }
    onSelect(token);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Select a token</Text>
            <Pressable style={s.closeButton} onPress={onClose}>
              <Text style={s.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <Text style={s.sideHint}>Selecting for {side === 'sell' ? 'Sell' : 'Buy'}</Text>

          <View style={s.searchRow}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tokens or address"
              placeholderTextColor="#828282"
              style={s.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={s.networkChip}>
              <Text style={s.networkChipText}>{SWAP_NETWORK.shortLabel}</Text>
              <Text style={s.networkChipArrow}>▾</Text>
            </View>
          </View>

          <Text style={s.sectionLabel}>Tokens on Sepolia</Text>
          {isLoadingTokens ? (
            <View style={s.inlineStatus}>
              <ActivityIndicator color="#c8f323" size="small" />
              <Text style={s.inlineStatusText}>Loading Uniswap token list...</Text>
            </View>
          ) : null}
          {isResolvingToken ? (
            <View style={s.inlineStatus}>
              <ActivityIndicator color="#c8f323" size="small" />
              <Text style={s.inlineStatusText}>Looking up token address...</Text>
            </View>
          ) : null}
          {resolveError ? <Text style={s.errorText}>{resolveError}</Text> : null}

          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {filteredTokens.map((token) => {
              const isDisabled = token.address.toLowerCase() === excludeToken.address.toLowerCase();
              const isSelected = token.address.toLowerCase() === selectedToken.address.toLowerCase();
              return (
                <Pressable
                  key={`${token.chainId}-${token.address}`}
                  style={[s.tokenRow, isDisabled && s.tokenRowDisabled]}
                  onPress={() => onPressToken(token)}
                  disabled={isDisabled}
                >
                  <TokenAvatar symbol={token.symbol} iconBySymbol={iconBySymbol} />
                  <View style={s.tokenInfo}>
                    <Text style={s.tokenName}>{token.name}</Text>
                    <Text style={s.tokenMeta}>
                      {token.symbol} {truncateAddress(token.address)}
                    </Text>
                  </View>
                  {isSelected ? <Text style={s.checkmark}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TokenAvatar({ symbol, iconBySymbol }: { symbol: string; iconBySymbol: Record<string, string> }) {
  const uri = iconBySymbol[symbol];
  if (uri) {
    return <Image source={{ uri }} style={s.avatar} />;
  }
  return (
    <View style={s.avatarFallback}>
      <Text style={s.avatarFallbackText}>{symbol.slice(0, 1)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    height: '85%',
    backgroundColor: '#171717',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1b1b',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  closeButtonText: {
    color: '#cfcfcf',
    fontSize: 24,
    lineHeight: 25,
  },
  sideHint: {
    marginTop: 4,
    color: '#8f8f8f',
    fontSize: 12,
  },
  searchRow: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#272727',
    backgroundColor: '#1c1b1b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 54,
    gap: 8,
  },
  searchIcon: {
    color: '#969696',
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    color: '#ededed',
    fontSize: 16,
  },
  networkChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#141414',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  networkChipText: {
    color: '#f2f2f2',
    fontSize: 12,
    fontWeight: '600',
  },
  networkChipArrow: {
    color: '#8f8f8f',
    fontSize: 11,
  },
  quickRow: {
    marginTop: 14,
    gap: 10,
    paddingRight: 12,
  },
  quickToken: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1c1b1b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  quickTokenText: {
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: 18,
    color: '#b0b0b0',
    fontSize: 15,
    fontWeight: '600',
  },
  inlineStatus: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineStatusText: {
    color: '#adadad',
    fontSize: 13,
  },
  errorText: {
    marginTop: 10,
    color: '#ff938d',
    fontSize: 13,
  },
  list: {
    marginTop: 10,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  tokenRowDisabled: {
    opacity: 0.35,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenName: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
  },
  tokenMeta: {
    marginTop: 2,
    color: '#8c8c8c',
    fontSize: 14,
  },
  checkmark: {
    color: '#c8f323',
    fontSize: 16,
    fontWeight: '700',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#e9e9e9',
    fontSize: 13,
    fontWeight: '700',
  },
});
