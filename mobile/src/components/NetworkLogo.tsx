import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { NetworkKey } from '../state/network';

const LOGOS: Record<NetworkKey, ReturnType<typeof require>> = {
  'eth-sepolia': require('../../assets/logos/ethereum.png'),
  'avax-fuji': require('../../assets/logos/avalanche.png'),
  'base-mainnet': require('../../assets/logos/base.png'),
};

interface Props {
  network: NetworkKey;
  size?: number;
}

export function NetworkLogo({ network, size = 28 }: Props) {
  return (
    <Image
      source={LOGOS[network]}
      style={[styles.logo, { width: size, height: size, borderRadius: size / 2 }]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: 'transparent',
  },
});
