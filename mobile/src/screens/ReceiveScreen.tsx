import { useBlinkMobileDeposit } from '@swype-org/deposit-mobile/react-native'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { useCallback, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BLINK_CALLBACK_SCHEME,
  BLINK_CHAIN_ID,
  BLINK_SIGNER_URL,
  BLINK_TOKEN,
} from '../config/blink'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useNetwork } from '../state/network'
import { useWallet } from '../state/wallet'

type Props = NativeStackScreenProps<RootStackParamList, 'Receive'>

export function ReceiveScreen({ navigation }: Props) {
  const { wallet } = useWallet()
  const { networkOption } = useNetwork()

  const { status, result, displayMessage, requestDeposit, handleDeepLink } =
    useBlinkMobileDeposit({
      signer: BLINK_SIGNER_URL,
      callbackScheme: BLINK_CALLBACK_SCHEME,
      openUrl: (url) => WebBrowser.openBrowserAsync(url).then(() => {}),
    })

  // Register deep-link listener before any requestDeposit call.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })
    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url)
    })
    return () => sub.remove()
  }, [handleDeepLink])

  // Show error alert whenever displayMessage is set.
  useEffect(() => {
    if (displayMessage) {
      Alert.alert('Deposit error', displayMessage)
    }
  }, [displayMessage])

  // Navigate back on success.
  useEffect(() => {
    if (result) {
      navigation.goBack()
    }
  }, [result, navigation])

  const handleDeposit = useCallback(() => {
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
  }, [wallet?.address, requestDeposit])

  const isLoading = status === 'signer-loading' || status === 'browser-active'

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backButton}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>Receive</Text>
        <View style={s.backButton} />
      </View>

      <View style={s.body}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Deposit USDC</Text>
          <Text style={s.cardSubtitle}>Fund your {networkOption.label} wallet via Blink</Text>

          {wallet?.address ? (
            <View style={s.addressWrap}>
              <Text style={s.addressLabel}>Destination</Text>
              <Text style={s.addressText}>
                {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
              </Text>
            </View>
          ) : null}

          <Text style={[s.networkNote, { color: networkOption.color }]}>Network: {networkOption.label}</Text>
          <Text style={s.tokenNote}>Token: USDC</Text>
        </View>

        <Pressable
          style={[s.depositButton, isLoading && s.depositButtonDisabled]}
          onPress={handleDeposit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#1a2400" />
          ) : (
            <Text style={s.depositButtonText}>Deposit stablecoins ↗</Text>
          )}
        </Pressable>

        {status === 'error' && displayMessage ? (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{displayMessage}</Text>
          </View>
        ) : null}

        <Text style={s.hint}>
          Tapping the button opens the Blink hosted deposit flow in your browser.
          {'\n'}Return to the app when complete.
        </Text>
      </View>
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
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#1c1b1b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#9a9a9a',
    fontSize: 13,
  },
  addressWrap: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 12,
  },
  addressLabel: {
    color: '#9a9a9a',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addressText: {
    color: '#f3f3f3',
    fontSize: 14,
    fontFamily: 'monospace' as const,
  },
  networkNote: {
    color: '#c8f323',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tokenNote: {
    color: '#9a9a9a',
    fontSize: 12,
  },
  depositButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositButtonDisabled: {
    opacity: 0.6,
  },
  depositButtonText: {
    color: '#1a2400',
    fontSize: 16,
    fontWeight: '700',
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
  hint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
})
