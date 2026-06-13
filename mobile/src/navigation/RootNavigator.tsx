import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AssetsScreen } from '../screens/AssetsScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { ScanCardScreen } from '../screens/ScanCardScreen';
import { SendScreen } from '../screens/SendScreen';
import { TransactionSuccessScreen } from '../screens/TransactionSuccessScreen';

export type RootStackParamList = {
  Assets: undefined;
  Send: undefined;
  Review: undefined;
  Scan: undefined;
  Success: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Scan" component={ScanCardScreen} />
      <Stack.Screen name="Success" component={TransactionSuccessScreen} />
    </Stack.Navigator>
  );
}
