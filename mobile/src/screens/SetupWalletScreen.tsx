import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildPairRequest, parsePairResponse } from '../services/pairing';
import { useWallet } from '../state/wallet';
import { useHCE } from '../useHCE';

type PairPhase = 'idle' | 'pairing' | 'saving';

interface NetworkOption {
  id: string;
  label: string;
  sublabel: string;
}

const NETWORKS: NetworkOption[] = [
  { id: 'ethereum', label: 'Ethereum Sepolia', sublabel: 'Chain ID 11155111' },
  { id: 'solana', label: 'Solana Devnet', sublabel: 'Cluster devnet' },
];

export function SetupWalletScreen() {
  const { saveWallet } = useWallet();
  const { loadPayload, waitForSignedTxOnce, clearSignedTxListener } = useHCE();
  const [phase, setPhase] = useState<PairPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(NETWORKS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isRunningRef = useRef(false);

  const phaseLabel = useMemo(() => {
    if (phase === 'pairing') return 'Pairing';
    if (phase === 'saving') return 'Saving';
    return null;
  }, [phase]);

  const phaseHint = useMemo(() => {
    if (phase === 'pairing') {
      return 'Keep your Better Wallet near your phone until pairing finishes.';
    }
    if (phase === 'saving') return 'Saving wallet profile to this device.';
    return null;
  }, [phase]);

  const isActive = phase !== 'idle';

  const runPairing = async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setError(null);
    clearSignedTxListener();

    try {
      const request = buildPairRequest();
      setPhase('pairing');
      loadPayload(request);

      const responseJson = await waitForSignedTxOnce(45000);
      const profile = parsePairResponse(responseJson);

      setPhase('saving');
      await saveWallet(profile);
      // RootNavigator switches to the wallet stack once saveWallet updates state.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to pair wallet over NFC.';
      setError(message);
      setPhase('idle');
    } finally {
      clearSignedTxListener();
      isRunningRef.current = false;
    }
  };

  const selectNetwork = (option: NetworkOption) => {
    setSelectedNetwork(option);
    setDropdownOpen(false);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.wrap}>

        <Text style={s.title}>Pair Hardware Wallet</Text>
        <Text style={s.subtitle}>
          Hold your Better Wallet near the back of your phone to pair via NFC.
        </Text>

        {/* Network dropdown trigger */}
        <View style={s.dropdownWrap}>
          <Text style={s.dropdownLabel}>Network</Text>
          <Pressable
            style={[s.dropdownTrigger, dropdownOpen && s.dropdownTriggerOpen]}
            onPress={() => setDropdownOpen((v) => !v)}
          >
            <View style={s.dropdownTriggerLeft}>
              <Text style={s.dropdownTriggerNetwork}>{selectedNetwork.label}</Text>
              <Text style={s.dropdownTriggerSub}>{selectedNetwork.sublabel}</Text>
            </View>
            <Text style={[s.dropdownChevron, dropdownOpen && s.dropdownChevronUp]}>›</Text>
          </Pressable>

          {/* Inline dropdown menu */}
          {dropdownOpen && (
            <>
              <Pressable style={s.dropdownBackdrop} onPress={() => setDropdownOpen(false)} />
              <View style={s.dropdownMenu}>
                {NETWORKS.map((option, index) => (
                  <Pressable
                    key={option.id}
                    style={[
                      s.dropdownOption,
                      index < NETWORKS.length - 1 && s.dropdownOptionBorder,
                    ]}
                    onPress={() => selectNetwork(option)}
                  >
                    <View style={s.dropdownOptionLeft}>
                      <Text style={s.dropdownOptionLabel}>{option.label}</Text>
                      <Text style={s.dropdownOptionSub}>{option.sublabel}</Text>
                    </View>
                    {selectedNetwork.id === option.id && (
                      <Text style={s.dropdownCheck}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {!isActive && (
          <View style={s.stepsCard}>
            <View style={s.step}>
              <View style={s.stepIconWrap}>
                <Text style={s.stepIcon}>◎</Text>
              </View>
              <View style={s.stepText}>
                <Text style={s.stepTitle}>Tap your hardware wallet</Text>
                <Text style={s.stepHint}>
                  Bring your Better Wallet to the back of your phone and keep it there until
                  pairing completes.
                </Text>
              </View>
            </View>
          </View>
        )}

        {isActive && (
          <View style={s.phaseCard}>
            <Text style={s.phase}>{phaseLabel}</Text>
            <Text style={s.phaseHint}>{phaseHint}</Text>
            <ActivityIndicator color="#c8f323" size="large" style={s.spinner} />
          </View>
        )}

        {error ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>NFC error</Text>
            <Text style={s.errorBody}>{error}</Text>
            <Text style={s.errorRetryHint}>
              Hold your wallet near your phone and tap Retry to try again.
            </Text>
          </View>
        ) : null}

        <View style={s.footer}>
          {!isActive && (
            <Pressable style={s.primaryButton} onPress={runPairing}>
              <Text style={s.primaryButtonText}>
                {error ? 'Retry Pairing' : 'Pair Hardware Wallet'}
              </Text>
            </Pressable>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  title: {
    color: '#e5e2e1',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 10,
    color: '#a8a8a8',
    fontSize: 16,
    lineHeight: 24,
  },

  // Dropdown
  dropdownWrap: {
    marginTop: 24,
    zIndex: 10,
  },
  dropdownLabel: {
    color: '#9a9a9a',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownTriggerOpen: {
    borderColor: '#c8f323',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownTriggerLeft: {
    gap: 2,
  },
  dropdownTriggerNetwork: {
    color: '#e5e2e1',
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownTriggerSub: {
    color: '#9a9a9a',
    fontSize: 12,
  },
  dropdownChevron: {
    color: '#9a9a9a',
    fontSize: 20,
    transform: [{ rotate: '90deg' }],
    lineHeight: 22,
  },
  dropdownChevronUp: {
    transform: [{ rotate: '-90deg' }],
    color: '#c8f323',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: -24,
    right: -24,
    bottom: -2000,
    zIndex: 9,
  },
  dropdownMenu: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#c8f323',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
    zIndex: 10,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  dropdownOptionLeft: {
    gap: 2,
  },
  dropdownOptionLabel: {
    color: '#e5e2e1',
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownOptionSub: {
    color: '#9a9a9a',
    fontSize: 12,
  },
  dropdownCheck: {
    color: '#c8f323',
    fontSize: 16,
    fontWeight: '700',
  },

  // Steps
  stepsCard: {
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 18,
    padding: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(200,243,35,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepIcon: {
    color: '#c8f323',
    fontSize: 16,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: '#e5e2e1',
    fontSize: 15,
    fontWeight: '600',
  },
  stepHint: {
    marginTop: 3,
    color: '#9a9a9a',
    fontSize: 13,
    lineHeight: 19,
  },

  // Phase card
  phaseCard: {
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 18,
    padding: 20,
  },
  phase: {
    color: '#c8f323',
    fontSize: 24,
    fontWeight: '700',
  },
  phaseHint: {
    marginTop: 12,
    color: '#d4d4d4',
    fontSize: 15,
    lineHeight: 22,
  },
  spinner: {
    marginTop: 18,
  },

  // Error
  errorCard: {
    marginTop: 20,
    backgroundColor: '#2a1717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    padding: 14,
    gap: 8,
  },
  errorTitle: {
    color: '#ffb4ab',
    fontWeight: '700',
    fontSize: 15,
  },
  errorBody: {
    color: '#ffd8d3',
    fontSize: 14,
    lineHeight: 20,
  },
  errorRetryHint: {
    color: '#d4a8a4',
    fontSize: 13,
    lineHeight: 19,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingBottom: 26,
  },
  primaryButton: {
    backgroundColor: '#c8f323',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#1a2400',
    fontWeight: '700',
    fontSize: 16,
  },
});
