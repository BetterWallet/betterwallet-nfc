import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AssetsScreen } from '../screens/AssetsScreen';
import { BridgeReviewScreen } from '../screens/BridgeReviewScreen';
import { BridgeScanScreen } from '../screens/BridgeScanScreen';
import { BridgeScreen } from '../screens/BridgeScreen';
import { BridgeSuccessScreen } from '../screens/BridgeSuccessScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { ScanCardScreen } from '../screens/ScanCardScreen';
import { SendScreen } from '../screens/SendScreen';
import { SetupWalletScreen } from '../screens/SetupWalletScreen';
import { SwapScreen } from '../screens/SwapScreen';
import { TransactionSuccessScreen } from '../screens/TransactionSuccessScreen';
import { useWallet } from '../state/wallet';

export type RootStackParamList = {
  Setup: undefined;
  Assets: undefined;
  Send: undefined;
  Swap: undefined;
  Receive: undefined;
  Review: undefined;
  Scan: undefined;
  Success: undefined;
  Bridge: undefined;
  BridgeReview: undefined;
  BridgeScan: undefined;
  BridgeSuccess: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { wallet, isBootstrapping } = useWallet();

  if (isBootstrapping) {
    return (
      <View style={s.bootRoot}>
        <ActivityIndicator color="#c8f323" size="large" />
        <Text style={s.bootText}>Loading wallet profile...</Text>
      </View>
    );
  }

  if (!wallet) {
    return (
      <Stack.Navigator
        initialRouteName="Setup"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#131313' },
        }}
      >
        <Stack.Screen name="Setup" component={SetupWalletScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName="Assets"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#131313' },
      }}
    >
      <Stack.Screen name="Assets" component={AssetsScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="Swap" component={SwapScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Scan" component={ScanCardScreen} />
      <Stack.Screen name="Success" component={TransactionSuccessScreen} />
      <Stack.Screen name="Bridge" component={BridgeScreen} />
      <Stack.Screen name="BridgeReview" component={BridgeReviewScreen} />
      <Stack.Screen name="BridgeScan" component={BridgeScanScreen} />
      <Stack.Screen name="BridgeSuccess" component={BridgeSuccessScreen} />
    </Stack.Navigator>
  );
}

const s = StyleSheet.create({
  bootRoot: {
    flex: 1,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bootText: {
    color: '#d0d0d0',
    fontSize: 14,
  },
});
