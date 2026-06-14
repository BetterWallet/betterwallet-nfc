import { useBlinkMobileDeposit } from '@swype-org/deposit-mobile/react-native'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BLINK_CALLBACK_SCHEME,
  BLINK_CHAIN_ID,
  BLINK_SIGNER_URL,
  BLINK_TOKEN,
} from '../config/blink'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { NetworkKey } from '../state/network'
import { useNetwork } from '../state/network'
import { useWallet } from '../state/wallet'

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>

interface TokenOption {
  symbol: string
  name: string
  logo: ReturnType<typeof require>
}

const TOKEN_DEFS: Record<string, TokenOption> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    logo: require('../../assets/logos/ethereum.png'),
  },
  AVAX: {
    symbol: 'AVAX',
    name: 'Avalanche',
    logo: require('../../assets/logos/avalanche.png'),
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    logo: require('../../assets/logos/usdc.png'),
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped ETH',
    logo: require('../../assets/logos/weth.png'),
  },
}

const NETWORK_TOKENS: Record<NetworkKey, string[]> = {
  'eth-sepolia': ['ETH', 'USDC', 'WETH'],
  'avax-fuji': ['AVAX', 'USDC'],
  'base-mainnet': ['ETH', 'USDC'],
}

function defaultToken(network: NetworkKey): string {
  const tokens = NETWORK_TOKENS[network]
  return tokens.includes('USDC') ? 'USDC' : tokens[0]
}

export function ReceiveScreen({ navigation }: Props) {
  const { wallet } = useWallet()
  const { selectedNetwork, networkOption } = useNetwork()

  const tokens = NETWORK_TOKENS[selectedNetwork]
  const [selectedToken, setSelectedToken] = useState(() => defaultToken(selectedNetwork))

  useEffect(() => {
    setSelectedToken(defaultToken(selectedNetwork))
  }, [selectedNetwork])

  const blinkSupported = selectedNetwork === 'base-mainnet' && selectedToken === 'USDC'

  const { status, result, displayMessage, requestDeposit, handleDeepLink } =
    useBlinkMobileDeposit({
      signer: BLINK_SIGNER_URL,
      callbackScheme: BLINK_CALLBACK_SCHEME,
      openUrl: (url) => WebBrowser.openBrowserAsync(url).then(() => {}),
    })

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })
    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url)
    })
    return () => sub.remove()
  }, [handleDeepLink])

  useEffect(() => {
    if (displayMessage) {
      Alert.alert('Deposit error', displayMessage)
    }
  }, [displayMessage])

  useEffect(() => {
    if (result) {
      navigation.goBack()
    }
  }, [result, navigation])

  const handleDeposit = useCallback(() => {
    if (!blinkSupported) {
      Alert.alert(
        'Blink deposits not available',
        'Blink deposits are only supported for USDC on Base Mainnet. Switch network and select USDC to use this feature.',
      )
      return
    }
    if (!wallet?.address) {
      Alert.alert('No wallet', 'Pair a wallet first before depositing.')
      return
    }
    requestDeposit({
      amount: 1,
      chainId: BLINK_CHAIN_ID,
      address: wallet.address,
      token: BLINK_TOKEN,
    })
  }, [blinkSupported, wallet?.address, requestDeposit])

  const handleShare = useCallback(() => {
    if (!wallet?.address) return
    void Share.share({ message: wallet.address })
  }, [wallet?.address])

  const isLoading = status === 'signer-loading' || status === 'browser-active'

  const shortAddress = useMemo(() => {
    if (!wallet?.address) return ''
    return `${wallet.address.slice(0, 10)}...${wallet.address.slice(-8)}`
  }, [wallet?.address])

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Receive</Text>
        <View style={s.backButton} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* QR Code */}
        <View style={s.qrWrap}>
          {wallet?.address ? (
            <QRCode
              value={wallet.address}
              size={200}
              color="#ffffff"
              backgroundColor="#1c1b1b"
            />
          ) : (
            <View style={s.qrPlaceholder}>
              <Text style={s.qrPlaceholderText}>No wallet paired</Text>
            </View>
          )}
        </View>

        {/* Network badge */}
        <View style={[s.networkBadge, { borderColor: networkOption.color }]}>
          <Text style={[s.networkBadgeText, { color: networkOption.color }]}>
            {networkOption.label}
          </Text>
        </View>

        {/* Address */}
        {wallet?.address ? (
          <Pressable style={s.addressRow} onPress={handleShare}>
            <Text style={s.addressText}>{shortAddress}</Text>
            <Text style={s.copyHint}>Tap to share</Text>
          </Pressable>
        ) : null}

        {/* Token selector */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Select Token</Text>
          <View style={s.tokenList}>
            {tokens.map((symbol) => {
              const token = TOKEN_DEFS[symbol]
              const active = selectedToken === symbol
              return (
                <Pressable
                  key={symbol}
                  style={[s.tokenRow, active && s.tokenRowActive]}
                  onPress={() => setSelectedToken(symbol)}
                >
                  <Image source={token.logo} style={s.tokenLogo} resizeMode="cover" />
                  <View style={s.tokenInfo}>
                    <Text style={[s.tokenSymbol, active && s.tokenSymbolActive]}>
                      {token.symbol}
                    </Text>
                    <Text style={s.tokenName}>{token.name}</Text>
                  </View>
                  <View style={[s.radioOuter, active && s.radioOuterActive]}>
                    {active ? <View style={s.radioInner} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Deposit button */}
        <View style={s.depositSection}>
          <Pressable
            style={[
              s.depositButton,
              (!blinkSupported || isLoading) && s.depositButtonDim,
            ]}
            onPress={handleDeposit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#1a2400" />
            ) : (
              <Text style={s.depositButtonText}>Deposit via Blink ↗</Text>
            )}
          </Pressable>
          {!blinkSupported ? (
            <Text style={s.depositNote}>
              Blink deposits require USDC on Base Mainnet
            </Text>
          ) : (
            <Text style={s.depositNote}>
              Opens the Blink hosted deposit flow in your browser
            </Text>
          )}
          {status === 'error' && displayMessage ? (
            <View style={s.errorBanner}>
              <Text style={s.errorText}>{displayMessage}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: '#c8f323',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20,
  },

  qrWrap: {
    backgroundColor: '#1c1b1b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    color: '#555',
    fontSize: 14,
  },

  networkBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  networkBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  addressRow: {
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    color: '#f3f3f3',
    fontSize: 15,
    fontFamily: 'monospace' as const,
    letterSpacing: 0.5,
  },
  copyHint: {
    color: '#555',
    fontSize: 11,
  },

  section: {
    width: '100%',
    gap: 10,
  },
  sectionLabel: {
    color: '#9a9a9a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tokenList: {
    gap: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1c1b1b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 14,
  },
  tokenRowActive: {
    borderColor: '#c8f323',
    backgroundColor: 'rgba(200,243,35,0.06)',
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tokenInfo: {
    flex: 1,
    gap: 2,
  },
  tokenSymbol: {
    color: '#e5e2e1',
    fontSize: 15,
    fontWeight: '700',
  },
  tokenSymbolActive: {
    color: '#c8f323',
  },
  tokenName: {
    color: '#6a6a6a',
    fontSize: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#c8f323',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c8f323',
  },

  depositSection: {
    width: '100%',
    gap: 10,
  },
  depositButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositButtonDim: {
    opacity: 0.35,
  },
  depositButtonText: {
    color: '#1a2400',
    fontSize: 16,
    fontWeight: '700',
  },
  depositNote: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: '#2a1717',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    padding: 14,
  },
  errorText: {
    color: '#ffb4ab',
    fontSize: 14,
    lineHeight: 20,
  },
})
