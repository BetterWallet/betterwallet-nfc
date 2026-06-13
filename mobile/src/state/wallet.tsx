import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isValidWalletProfile } from '../services/pairing';
import type { WalletProfile } from '../types/wallet';

const WALLET_STORAGE_KEY = 'betterwallet.pairedWallet.v1';

interface WalletContextValue {
  wallet: WalletProfile | null;
  isBootstrapping: boolean;
  saveWallet: (wallet: WalletProfile) => Promise<void>;
  clearWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        if (!raw || !mounted) {
          return;
        }
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!isValidWalletProfile(parsed)) {
            await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
            setWallet(null);
            return;
          }
          setWallet(parsed);
        } catch {
          await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
          setWallet(null);
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };
    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const saveWallet = useCallback(async (nextWallet: WalletProfile) => {
    await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(nextWallet));
    setWallet(nextWallet);
  }, []);

  const clearWallet = useCallback(async () => {
    await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
    setWallet(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      isBootstrapping,
      saveWallet,
      clearWallet,
    }),
    [wallet, isBootstrapping, saveWallet, clearWallet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used inside WalletProvider.');
  }
  return context;
}
