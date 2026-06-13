import { useCallback, useEffect, useRef } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';

const { HCEModule } = NativeModules;

type SignedTxCallback = (json: string) => void;

export function useHCE() {
  const listenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);

  const loadPayload = useCallback((payload: object) => {
    HCEModule.setPayload(JSON.stringify(payload));
  }, []);

  const waitForSignedTx = useCallback((callback: SignedTxCallback) => {
    listenerRef.current?.remove();
    listenerRef.current = DeviceEventEmitter.addListener('HCE_SIGNED_TX', (json: string) => {
      listenerRef.current?.remove();
      callback(json);
    });
  }, []);

  const clearSignedTxListener = useCallback(() => {
    listenerRef.current?.remove();
    listenerRef.current = null;
  }, []);

  const waitForSignedTxOnce = useCallback((timeoutMs = 30000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearSignedTxListener();
        reject(new Error('Timed out waiting for signed transaction over NFC.'));
      }, timeoutMs);

      waitForSignedTx((json) => {
        clearTimeout(timeout);
        resolve(json);
      });
    });
  }, [clearSignedTxListener, waitForSignedTx]);

  useEffect(() => {
    return () => {
      clearSignedTxListener();
    };
  }, []);

  return { loadPayload, waitForSignedTx, waitForSignedTxOnce, clearSignedTxListener };
}
