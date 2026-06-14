import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type NetworkKey = 'eth-sepolia' | 'avax-fuji' | 'base-mainnet';

export interface NetworkOption {
  key: NetworkKey;
  label: string;
  color: string;
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  { key: 'eth-sepolia', label: 'Ethereum Sepolia', color: '#627eea' },
  { key: 'avax-fuji', label: 'Avalanche Fuji', color: '#E84142' },
  { key: 'base-mainnet', label: 'Base Mainnet', color: '#0052ff' },
];

interface NetworkContextValue {
  selectedNetwork: NetworkKey;
  setSelectedNetwork: (key: NetworkKey) => void;
  networkOption: NetworkOption;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [selectedNetwork, setSelectedNetworkState] = useState<NetworkKey>('eth-sepolia');

  const setSelectedNetwork = useCallback((key: NetworkKey) => {
    setSelectedNetworkState(key);
  }, []);

  const networkOption = useMemo(
    () => NETWORK_OPTIONS.find((n) => n.key === selectedNetwork) ?? NETWORK_OPTIONS[0],
    [selectedNetwork],
  );

  const value = useMemo<NetworkContextValue>(
    () => ({ selectedNetwork, setSelectedNetwork, networkOption }),
    [selectedNetwork, setSelectedNetwork, networkOption],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used inside NetworkProvider');
  }
  return ctx;
}
