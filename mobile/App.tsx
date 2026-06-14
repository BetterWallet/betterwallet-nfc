import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import React from 'react';
import { RootNavigator } from './src/navigation/RootNavigator';
import { BridgeFlowProvider } from './src/state/bridgeFlow';
import { NetworkProvider } from './src/state/network';
import { SendFlowProvider } from './src/state/sendFlow';
import { WalletProvider } from './src/state/wallet';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#131313',
    card: '#131313',
    border: '#131313',
  },
};

export default function App() {
  return (
    <WalletProvider>
      <NetworkProvider>
        <SendFlowProvider>
          <BridgeFlowProvider>
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          </BridgeFlowProvider>
        </SendFlowProvider>
      </NetworkProvider>
    </WalletProvider>
  );
}
