import { Buffer } from 'buffer';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useHCE } from './src/useHCE';

type AppState = 'idle' | 'tap1_ready' | 'tap2_ready' | 'done';

function createFakeTx(size = 7500) {
  return Buffer.from('x'.repeat(size), 'utf8').toString('base64');
}

export default function App() {
  const { loadPayload, waitForSignedTx } = useHCE();
  const [state, setState] = useState<AppState>('idle');
  const [signedTx, setSignedTx] = useState('');

  const startDemo = () => {
    const fakeTx = createFakeTx();
    loadPayload({
      type: 'sign_request',
      id: `tx-${Date.now()}`,
      tx: fakeTx,
    });
    setState('tap1_ready');

    setTimeout(() => {
      setState('tap2_ready');
      waitForSignedTx((json) => {
        try {
          const parsed = JSON.parse(json);
          setSignedTx(parsed.signature ?? json);
        } catch {
          setSignedTx(json);
        }
        setState('done');
      });
    }, 3000);
  };

  const reset = () => {
    setState('idle');
    setSignedTx('');
  };

  return (
    <SafeAreaView style={s.root}>
      {state === 'idle' && (
        <TouchableOpacity style={s.button} onPress={startDemo}>
          <Text style={s.buttonText}>Start Demo</Text>
        </TouchableOpacity>
      )}

      {state === 'tap1_ready' && (
        <View style={s.center}>
          <Text style={s.title}>TAP 1</Text>
          <Text style={s.subtitle}>Hold phone to Pi to send transaction...</Text>
        </View>
      )}

      {state === 'tap2_ready' && (
        <View style={s.center}>
          <Text style={s.title}>TAP 2</Text>
          <Text style={s.subtitle}>Hold phone to Pi to receive signed tx...</Text>
        </View>
      )}

      {state === 'done' && (
        <View style={s.center}>
          <Text style={s.title}>Done</Text>
          <Text style={s.mono} numberOfLines={8}>
            {signedTx}
          </Text>
          <TouchableOpacity style={s.button} onPress={reset}>
            <Text style={s.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  mono: {
    marginTop: 16,
    maxWidth: 340,
    fontSize: 11,
    color: '#4eff91',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#4eff91',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
});
