import { useCallback, useEffect, useRef } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';

const { HCEModule } = NativeModules;

type SignedPayloadCallback = (json: string) => void;

export function useHCE() {
  const listenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);

  const loadPayload = useCallback((payload: object) => {
    HCEModule.setPayload(JSON.stringify(payload));
  }, []);

  const waitForSignedPayload = useCallback((callback: SignedPayloadCallback) => {
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

  const waitForSignedPayloadOnce = useCallback(
    (timeoutMs = 30000, timeoutMessage = 'Timed out waiting for signed payload over NFC.'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearSignedTxListener();
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      waitForSignedPayload((json) => {
        clearTimeout(timeout);
        resolve(json);
      });
    });
    },
    [clearSignedTxListener, waitForSignedPayload],
  );

  const waitForSignedTx = useCallback(
    (callback: SignedPayloadCallback) => {
      waitForSignedPayload(callback);
    },
    [waitForSignedPayload],
  );

  const waitForSignedTxOnce = useCallback(
    (timeoutMs = 30000): Promise<string> => {
      return waitForSignedPayloadOnce(timeoutMs, 'Timed out waiting for signed transaction over NFC.');
    },
    [waitForSignedPayloadOnce],
  );

  useEffect(() => {
    return () => {
      clearSignedTxListener();
    };
  }, []);

  return {
    loadPayload,
    waitForSignedPayload,
    waitForSignedPayloadOnce,
    waitForSignedTx,
    waitForSignedTxOnce,
    clearSignedTxListener,
  };
}
