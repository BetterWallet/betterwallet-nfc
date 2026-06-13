import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { parseTypedDataSignatureMessage, parseSignedTxMessage, broadcastSignedResult } from '../services/broadcast';
import {
  buildSignRequest,
  buildTypedDataSignRequest,
  createContractReviewDetails,
} from '../services/ethTransaction';
import {
  TOKEN_COINGECKO_IDS,
  SEPOLIA_TOKENS,
  checkApproval,
  fetchTokenMarketData,
  fetchSwapTransaction,
  getQuoteGasUsd,
  getQuoteOutputAmount,
  quoteSwap,
  type ApprovalTx,
  type QuoteResponse,
  type SwapTx,
} from '../services/uniswap';
import { useSendFlow } from '../state/sendFlow';
import { useWallet } from '../state/wallet';
import { useHCE } from '../useHCE';

type Props = NativeStackScreenProps<RootStackParamList, 'Swap'>;

type SwapToken = {
  symbol: keyof typeof TOKEN_COINGECKO_IDS;
  label: string;
};

type NetworkOption = {
  id: 'sepolia';
  label: string;
  valueLabel: string;
};

const TOKENS: SwapToken[] = [
  { symbol: 'ETH', label: 'Ethereum' },
  { symbol: 'USDC', label: 'USD Coin' },
  { symbol: 'WETH', label: 'Wrapped Ether' },
];
const NETWORK_OPTIONS: NetworkOption[] = [
  {
    id: 'sepolia',
    label: 'Ethereum Sepolia',
    valueLabel: 'Sepolia',
  },
];
const TOKEN_DECIMALS: Record<SwapToken['symbol'], number> = {
  ETH: 18,
  USDC: 6,
  WETH: 18,
};
const DEFAULT_MAX_FEE_PER_GAS_WEI = '30000000000';
const DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI = '1500000000';
const FALLBACK_SWAP_GAS_LIMIT = '300000';
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const UNISWAP_LOGO = require('../assets/uniswap-logo.png');

export function SwapScreen({ navigation }: Props) {
  const { wallet } = useWallet();
  const { loadPayload, waitForSignedPayloadOnce, clearSignedTxListener } = useHCE();
  const { setReview, setResult, setStage, setError: setFlowError } = useSendFlow();
  const [amount, setAmount] = useState('');
  const [tokenIn, setTokenIn] = useState<SwapToken>(TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<SwapToken>(TOKENS[1]);
  const [slippage, setSlippage] = useState('1');
  const [quoteHint, setQuoteHint] = useState('Enter an amount and tap Get Quote.');
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [approvalTx, setApprovalTx] = useState<ApprovalTx | null>(null);
  const [expectedOutputAmount, setExpectedOutputAmount] = useState('0');
  const [quoteGasUsd, setQuoteGasUsd] = useState<string | null>(null);
  const [priceBySymbol, setPriceBySymbol] = useState<Record<SwapToken['symbol'], number>>({
    ETH: 0,
    USDC: 0,
    WETH: 0,
  });
  const [iconBySymbol, setIconBySymbol] = useState<Record<SwapToken['symbol'], string>>({
    ETH: '',
    USDC: '',
    WETH: '',
  });
  const [tokenNameBySymbol, setTokenNameBySymbol] = useState<Record<SwapToken['symbol'], string>>({
    ETH: 'Ethereum',
    USDC: 'USD Coin',
    WETH: 'Wrapped Ether',
  });
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signingHint, setSigningHint] = useState<string | null>(null);
  const [error, setLocalError] = useState<string | null>(null);
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(NETWORK_OPTIONS[0]);
  const quoteRequestRef = useRef(0);

  const hasQuote = quoteResponse !== null;
  const canRequestQuote = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) && value > 0 && tokenIn.symbol !== tokenOut.symbol;
  }, [amount, tokenIn.symbol, tokenOut.symbol]);
  const canExecuteSwap = hasQuote && !isLoadingQuote && !isSigning;
  const sellAmountNumber = Number(amount || '0');
  const buyAmountNumber = Number(expectedOutputAmount || '0');
  const sellUsd = useMemo(
    () => sellAmountNumber * (priceBySymbol[tokenIn.symbol] || 0),
    [sellAmountNumber, priceBySymbol, tokenIn.symbol],
  );
  const buyUsd = useMemo(
    () => buyAmountNumber * (priceBySymbol[tokenOut.symbol] || 0),
    [buyAmountNumber, priceBySymbol, tokenOut.symbol],
  );

  const cycleTokenIn = () => {
    const index = TOKENS.findIndex((token) => token.symbol === tokenIn.symbol);
    const next = TOKENS[(index + 1) % TOKENS.length];
    if (next.symbol === tokenOut.symbol) {
      const fallback = TOKENS[(index + 2) % TOKENS.length];
      setTokenIn(fallback);
      return;
    }
    setTokenIn(next);
  };

  const cycleTokenOut = () => {
    const index = TOKENS.findIndex((token) => token.symbol === tokenOut.symbol);
    const next = TOKENS[(index + 1) % TOKENS.length];
    if (next.symbol === tokenIn.symbol) {
      const fallback = TOKENS[(index + 2) % TOKENS.length];
      setTokenOut(fallback);
      return;
    }
    setTokenOut(next);
  };

  const onSwapDirection = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setQuoteResponse(null);
    setExpectedOutputAmount('0');
  };

  const onSelectNetwork = (option: NetworkOption) => {
    setSelectedNetwork(option);
    setNetworkMenuOpen(false);
  };

  const loadMarketData = async () => {
    try {
      const market = await fetchTokenMarketData();
      setPriceBySymbol({
        ETH: market.ETH.priceUsd,
        USDC: market.USDC.priceUsd,
        WETH: market.WETH.priceUsd,
      });
      setIconBySymbol({
        ETH: market.ETH.imageUrl,
        USDC: market.USDC.imageUrl,
        WETH: market.WETH.imageUrl,
      });
      setTokenNameBySymbol({
        ETH: market.ETH.name,
        USDC: market.USDC.name,
        WETH: market.WETH.name,
      });
    } catch {
      // Keep defaults if market data fails.
    }
  };

  const requestQuote = async (): Promise<QuoteResponse | null> => {
    if (!wallet?.address) {
      setLocalError('Pair your wallet first to request a quote.');
      return null;
    }
    if (!canRequestQuote) {
      setLocalError('Choose different tokens and enter a valid amount.');
      return null;
    }

    setLocalError(null);
    setIsLoadingQuote(true);
    setQuoteHint('Fetching quote...');
    setQuoteResponse(null);
    setApprovalTx(null);
    setExpectedOutputAmount('0');
    setQuoteGasUsd(null);
    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;

    try {
      const rawAmount = parseUnits(amount.trim(), TOKEN_DECIMALS[tokenIn.symbol]).toString();
      const approvalToken = tokenIn.symbol === 'ETH' ? SEPOLIA_TOKENS.WETH : SEPOLIA_TOKENS[tokenIn.symbol];
      const approval = await checkApproval({
        walletAddress: wallet.address,
        token: approvalToken,
        amount: rawAmount,
      });
      setApprovalTx(approval);

      const nextQuote = await quoteSwap({
        swapper: wallet.address,
        tokenIn: SEPOLIA_TOKENS[tokenIn.symbol],
        tokenOut: SEPOLIA_TOKENS[tokenOut.symbol],
        amount: rawAmount,
        slippageTolerance: Number(slippage) || 1,
      });

      const outRaw = getQuoteOutputAmount(nextQuote);
      const gasUsd = getQuoteGasUsd(nextQuote);
      if (outRaw) {
        const formatted = formatUnits(outRaw, TOKEN_DECIMALS[tokenOut.symbol]);
        setExpectedOutputAmount(formatted);
      } else {
        setExpectedOutputAmount('0');
      }
      if (quoteRequestRef.current !== requestId) {
        return null;
      }
      setQuoteGasUsd(gasUsd);
      setQuoteResponse(nextQuote);
      setQuoteHint(
        approval
          ? 'Quote ready. Approval is required before swap execution.'
          : 'Quote ready. You can now sign and submit the swap.',
      );
      return nextQuote;
    } catch (err) {
      setQuoteHint('Failed to fetch quote.');
      setLocalError(err instanceof Error ? err.message : 'Failed to fetch quote.');
      return null;
    } finally {
      setIsLoadingQuote(false);
    }
  };

  useEffect(() => {
    void loadMarketData();
  }, []);

  useEffect(() => {
    if (!wallet?.address || !canRequestQuote) {
      return;
    }
    const timer = setTimeout(() => {
      void requestQuote();
    }, 600);
    return () => clearTimeout(timer);
  }, [wallet?.address, tokenIn.symbol, tokenOut.symbol, amount, slippage]);

  const createUnsignedTx = (tx: SwapTx | ApprovalTx) => {
    return {
      to: tx.to,
      valueWei: tx.value ?? '0',
      gasLimit: tx.gasLimit ?? FALLBACK_SWAP_GAS_LIMIT,
      maxFeePerGasWei: DEFAULT_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGasWei: DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI,
      data: tx.data,
    };
  };

  const signAndBroadcastTx = async (
    tx: SwapTx | ApprovalTx,
    nonce: number,
    reviewTitle: string,
    subtitle?: string,
  ) => {
    if (!wallet?.address) {
      throw new Error('No paired wallet for signing.');
    }
    const unsignedTx = createUnsignedTx(tx);
    const review = createContractReviewDetails({
      kind: reviewTitle.startsWith('Approve') ? 'approval' : 'swap',
      title: reviewTitle,
      subtitle,
      unsignedTx,
      amountEth: amount.trim() || '0',
      amountWei: unsignedTx.valueWei,
      amountUsd: '0.00',
      estimatedFeeEth: '0.00000',
      estimatedFeeUsd: quoteGasUsd ?? '0.00',
      totalEth: amount.trim() || '0',
      totalUsd: '0.00',
      swapMeta: {
        provider: 'Uniswap',
        tokenInSymbol: tokenIn.symbol,
        tokenOutSymbol: tokenOut.symbol,
        amountInDisplay: `${amount.trim()} ${tokenIn.symbol}`,
        amountOutDisplay: `${expectedOutputAmount} ${tokenOut.symbol}`,
        slippagePercent: slippage,
        routing: quoteResponse?.routing ?? 'UNKNOWN',
      },
    });
    const signRequest = buildSignRequest(review, wallet.address, nonce);
    loadPayload(signRequest);
    const signedPayload = await waitForSignedPayloadOnce(
      45000,
      'Timed out waiting for signed transaction over NFC.',
    );
    const signed = parseSignedTxMessage(signedPayload);
    if (signed.id !== signRequest.id) {
      throw new Error('Signed transaction response ID mismatch.');
    }
    return broadcastSignedResult(signed, review);
  };

  const signPermitTypedData = async (
    permitData: Record<string, unknown>,
    requestId: string,
  ): Promise<string> => {
    const typedDataRequest = buildTypedDataSignRequest(requestId, permitData);
    loadPayload(typedDataRequest);
    const signedPayload = await waitForSignedPayloadOnce(
      45000,
      'Timed out waiting for typed-data signature over NFC.',
    );
    const signatureResponse = parseTypedDataSignatureMessage(signedPayload);
    if (signatureResponse.id !== requestId) {
      throw new Error('Typed-data signature response ID mismatch.');
    }
    return signatureResponse.signature;
  };

  const onSignAndSwap = async () => {
    if (!wallet?.address) {
      setLocalError('Pair your wallet first.');
      return;
    }
    let activeQuote = quoteResponse;
    if (!activeQuote) {
      const refreshedQuote = await requestQuote();
      if (!refreshedQuote) {
        setLocalError('Unable to fetch quote. Check the amount and retry.');
        return;
      }
      activeQuote = refreshedQuote;
    }

    setLocalError(null);
    setIsSigning(true);
    setSigningHint('Preparing NFC signing...');
    clearSignedTxListener();

    try {
      const provider = new JsonRpcProvider(RPC_URL);
      let nonce = await provider.getTransactionCount(wallet.address, 'pending');

      if (approvalTx) {
        setSigningHint('Sign approval transaction with Better Wallet.');
        await signAndBroadcastTx(
          approvalTx,
          nonce,
          'Approve Token',
          'This one-time approval enables Uniswap router access.',
        );
        nonce += 1;
      }

      let permitSignature: string | undefined;
      if (activeQuote.permitData && typeof activeQuote.permitData === 'object') {
        setSigningHint('Sign Permit2 typed data with Better Wallet.');
        permitSignature = await signPermitTypedData(
          activeQuote.permitData,
          `permit-${Date.now()}`,
        );
      }

      setSigningHint('Building swap transaction...');
      const swapTx = await fetchSwapTransaction(activeQuote, permitSignature);

      setSigningHint('Sign swap transaction with Better Wallet.');
      const swapResult = await signAndBroadcastTx(
        swapTx,
        nonce,
        'Confirm Swap',
        'Swap transaction is ready for network broadcast.',
      );

      const finalReview = createContractReviewDetails({
        kind: 'swap',
        title: 'Confirm Swap',
        subtitle: 'Powered by Uniswap',
        unsignedTx: createUnsignedTx(swapTx),
        amountEth: amount.trim(),
        amountWei: createUnsignedTx(swapTx).valueWei,
        amountUsd: '0.00',
        estimatedFeeEth: '0.00000',
        estimatedFeeUsd: quoteGasUsd ?? '0.00',
        totalEth: amount.trim(),
        totalUsd: '0.00',
        swapMeta: {
          provider: 'Uniswap',
          tokenInSymbol: tokenIn.symbol,
          tokenOutSymbol: tokenOut.symbol,
          amountInDisplay: `${amount.trim()} ${tokenIn.symbol}`,
          amountOutDisplay: `${expectedOutputAmount} ${tokenOut.symbol}`,
          slippagePercent: slippage,
          routing: activeQuote.routing,
        },
      });
      setReview(finalReview);
      setFlowError(null);
      setStage('success');
      setResult(swapResult);
      navigation.navigate('Success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap signing failed.';
      setLocalError(message);
      setFlowError(message);
    } finally {
      clearSignedTxListener();
      setIsSigning(false);
      setSigningHint(null);
    }
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
          <View style={s.logoRow}>
            <Image source={UNISWAP_LOGO} style={s.logoImage} />
            <Text style={s.logoText}>Swap</Text>
          </View>
          <Text style={s.subtitle}>Powered by Uniswap</Text>
        </View>

        <View style={s.swapBox}>
          <View style={s.sellCard}>
            <Text style={s.inputLabel}>Sell</Text>
            <View style={s.row}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                style={s.amountInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#777"
              />
              <Pressable style={s.tokenButton} onPress={cycleTokenIn}>
                <TokenPillIcon symbol={tokenIn.symbol} iconBySymbol={iconBySymbol} />
                <Text style={s.tokenButtonText}>{tokenIn.symbol}</Text>
              </Pressable>
            </View>
            <Text style={s.usdLabel}>{formatUsd(sellUsd)}</Text>
          </View>

          <Pressable style={s.switchButton} onPress={onSwapDirection}>
            <Text style={s.switchButtonText}>↓</Text>
          </Pressable>

          <View style={s.buyCard}>
            <Text style={s.inputLabel}>Buy</Text>
            <View style={s.row}>
              <Text style={s.amountPreview}>{formatAmount(buyAmountNumber)}</Text>
              <Pressable style={s.tokenButton} onPress={cycleTokenOut}>
                <TokenPillIcon symbol={tokenOut.symbol} iconBySymbol={iconBySymbol} />
                <Text style={s.tokenButtonText}>{tokenOut.symbol}</Text>
              </Pressable>
            </View>
            <Text style={s.usdLabel}>{formatUsd(buyUsd)}</Text>
          </View>
        </View>

        <View style={s.optionsCard}>
          <View style={s.optionRow}>
            <Text style={s.optionLabel}>Network</Text>
            <View style={s.networkPickerWrap}>
              <Pressable
                style={[s.networkPicker, networkMenuOpen && s.networkPickerOpen]}
                onPress={() => setNetworkMenuOpen((open) => !open)}
              >
                <Text style={s.networkPickerValue}>{selectedNetwork.valueLabel}</Text>
                <Text style={s.networkPickerChevron}>▾</Text>
              </Pressable>
              {networkMenuOpen ? (
                <View style={s.networkMenu}>
                  {NETWORK_OPTIONS.map((option) => (
                    <Pressable
                      key={option.id}
                      style={s.networkMenuItem}
                      onPress={() => onSelectNetwork(option)}
                    >
                      <Text style={s.networkMenuItemLabel}>{option.label}</Text>
                      {selectedNetwork.id === option.id ? (
                        <Text style={s.networkMenuItemCheck}>✓</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.optionRow}>
            <Text style={s.optionLabel}>Slippage</Text>
            <TextInput
              value={slippage}
              onChangeText={setSlippage}
              style={s.slippageInput}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#777"
            />
          </View>
          <View style={s.quoteRow}>
            <Text style={s.quoteRowLabel}>Route</Text>
            <Text style={s.quoteRowValue}>{quoteResponse?.routing ?? '--'}</Text>
          </View>
          <View style={s.quoteRow}>
            <Text style={s.quoteRowLabel}>Gas</Text>
            <Text style={s.quoteRowValue}>${quoteGasUsd ?? '--'}</Text>
          </View>
          <View style={s.quoteRow}>
            <Text style={s.quoteRowLabel}>Approval</Text>
            <Text style={s.quoteRowValue}>{approvalTx ? 'Required' : hasQuote ? 'Not needed' : '--'}</Text>
          </View>
        </View>

        <Text style={s.quoteHint}>{quoteHint}</Text>
        <Text style={s.tokenHint}>
          {tokenNameBySymbol[tokenIn.symbol]} → {tokenNameBySymbol[tokenOut.symbol]}
        </Text>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {isSigning && signingHint ? (
          <View style={s.signingState}>
            <ActivityIndicator color="#c8f323" size="small" />
            <Text style={s.signingHint}>{signingHint}</Text>
          </View>
        ) : null}

        <View style={s.footer}>
          <Pressable
            style={[s.cta, (!canExecuteSwap || isSigning) && s.ctaDisabled]}
            onPress={onSignAndSwap}
            disabled={!canExecuteSwap || isSigning}
          >
            <Text style={s.ctaText}>{isLoadingQuote ? 'Calculating...' : 'Get started'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '0';
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '$0.00';
  }
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function TokenPillIcon({
  symbol,
  iconBySymbol,
}: {
  symbol: SwapToken['symbol'];
  iconBySymbol: Record<SwapToken['symbol'], string>;
}) {
  const uri = iconBySymbol[symbol];
  if (uri) {
    return <Image source={{ uri }} style={s.tokenIcon} />;
  }
  return (
    <View style={s.tokenIconFallback}>
      <Text style={s.tokenIconFallbackText}>{symbol.slice(0, 1)}</Text>
    </View>
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
    marginBottom: 20,
  },
  logoRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
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
    color: '#c8f323',
    fontSize: 13,
    marginTop: 6,
  },
  swapBox: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    backgroundColor: '#171717',
    marginBottom: 16,
    padding: 8,
  },
  sellCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    backgroundColor: '#0f1115',
    padding: 14,
  },
  buyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2b2b2b',
    backgroundColor: '#232325',
    padding: 14,
  },
  inputLabel: {
    color: '#a8a8a8',
    fontSize: 14,
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  amountInput: {
    flex: 1,
    color: '#f2f2f2',
    fontSize: 36,
    fontWeight: '700',
    paddingVertical: 0,
  },
  amountPreview: {
    flex: 1,
    color: '#f2f2f2',
    fontSize: 36,
    fontWeight: '700',
  },
  usdLabel: {
    marginTop: 6,
    color: '#9b9b9b',
    fontSize: 12,
  },
  tokenButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#464646',
    backgroundColor: '#18181d',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  tokenButtonText: {
    color: '#f8f8f8',
    fontSize: 15,
    fontWeight: '700',
  },
  tokenIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  tokenIconFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#383838',
  },
  tokenIconFallbackText: {
    color: '#f3f3f3',
    fontSize: 11,
    fontWeight: '700',
  },
  switchButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignSelf: 'center',
    marginVertical: -18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#282828',
    backgroundColor: '#1a1a1d',
    zIndex: 2,
  },
  switchButtonText: {
    color: '#c8f323',
    fontSize: 30,
    fontWeight: '700',
  },
  optionsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#171717',
    padding: 14,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    color: '#a9a9a9',
    fontSize: 13,
    fontWeight: '600',
  },
  networkPickerWrap: {
    position: 'relative',
  },
  networkPicker: {
    minWidth: 104,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#353535',
    backgroundColor: '#171717',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  networkPickerOpen: {
    borderColor: '#c8f323',
  },
  networkPickerValue: {
    color: '#f2f2f2',
    fontSize: 13,
    fontWeight: '600',
  },
  networkPickerChevron: {
    color: '#9a9a9a',
    fontSize: 12,
    lineHeight: 14,
  },
  networkMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#1d1d1d',
    minWidth: 168,
    overflow: 'hidden',
    zIndex: 20,
  },
  networkMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  networkMenuItemLabel: {
    color: '#d9d9d9',
    fontSize: 13,
    fontWeight: '500',
  },
  networkMenuItemCheck: {
    color: '#c8f323',
    fontSize: 13,
    fontWeight: '700',
  },
  slippageInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#353535',
    backgroundColor: '#171717',
    color: '#f2f2f2',
    minWidth: 80,
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  quoteHint: {
    marginTop: 10,
    color: '#a1a1a1',
    fontSize: 13,
  },
  tokenHint: {
    marginTop: 4,
    color: '#8f8f8f',
    fontSize: 12,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteRowLabel: {
    color: '#8f8f8f',
    fontSize: 12,
  },
  quoteRowValue: {
    color: '#e8e8e8',
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    marginTop: 12,
    color: '#ff9188',
    fontSize: 14,
  },
  signingState: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signingHint: {
    color: '#d8d8d8',
    fontSize: 13,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 26,
  },
  cta: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#405000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 18,
  },
});
