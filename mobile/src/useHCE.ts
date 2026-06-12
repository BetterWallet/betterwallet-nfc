import { useEffect, useRef } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';

const { HCEModule } = NativeModules;

type SignedTxCallback = (json: string) => void;

export function useHCE() {
  const listenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);

  function loadPayload(payload: object) {
    HCEModule.setPayload(JSON.stringify(payload));
  }

  function waitForSignedTx(callback: SignedTxCallback) {
    listenerRef.current?.remove();
    listenerRef.current = DeviceEventEmitter.addListener('HCE_SIGNED_TX', (json: string) => {
      listenerRef.current?.remove();
      callback(json);
    });
  }

  useEffect(() => {
    return () => {
      listenerRef.current?.remove();
    };
  }, []);

  return { loadPayload, waitForSignedTx };
}
