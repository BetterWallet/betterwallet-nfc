import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, NativeModules } from 'react-native';

const { HCEModule } = NativeModules;

type SignedPayloadCallback = (json: string) => void;
export type HceSessionState = 'idle' | 'active';
export type NfcTransferDirection = 'toWallet' | 'fromWallet';
export type NfcTransferPhase =
  | 'idle'
  | 'waiting_for_tap'
  | 'transferring_to_wallet'
  | 'waiting_for_rescan'
  | 'transferring_from_wallet'
  | 'complete';

export interface NfcTransferProgress {
  direction: NfcTransferDirection;
  bytesTransferred: number;
  totalBytes: number | null;
  ratio: number | null;
}

interface NativeTransferProgressPayload {
  direction?: NfcTransferDirection;
  bytesTransferred?: number;
  totalBytes?: number | null;
}

const hceLog = (...args: unknown[]) => {
  if (__DEV__) console.log('[HCE]', ...args);
};

export function useHCE() {
  const listenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);
  const sessionListenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);
  const progressListenerRef = useRef<ReturnType<typeof DeviceEventEmitter.addListener> | null>(null);
  const awaitingSignedPayloadRef = useRef(false);
  const activationCountRef = useRef(0);
  const [transferPhase, setTransferPhase] = useState<NfcTransferPhase>('idle');
  const [sessionState, setSessionState] = useState<HceSessionState>('idle');
  const [transferProgress, setTransferProgress] = useState<NfcTransferProgress | null>(null);

  const resetTransferState = useCallback(() => {
    awaitingSignedPayloadRef.current = false;
    activationCountRef.current = 0;
    setSessionState('idle');
    setTransferPhase('idle');
    setTransferProgress(null);
  }, []);

  const startTransferState = useCallback(() => {
    awaitingSignedPayloadRef.current = true;
    activationCountRef.current = 0;
    setTransferProgress(null);
    setTransferPhase('waiting_for_tap');
  }, []);

  const loadPayload = useCallback((payload: object) => {
    const serialised = JSON.stringify(payload);
    hceLog('loadPayload — bytes:', serialised.length, 'preview:', serialised.slice(0, 80));
    startTransferState();
    HCEModule.setPayload(serialised);
  }, [startTransferState]);

  const applyTransferProgress = useCallback((payload: NativeTransferProgressPayload) => {
    if (!awaitingSignedPayloadRef.current) {
      return;
    }
    if (payload.direction !== 'toWallet' && payload.direction !== 'fromWallet') {
      return;
    }
    if (typeof payload.bytesTransferred !== 'number' || payload.bytesTransferred < 0) {
      return;
    }

    const totalBytes =
      typeof payload.totalBytes === 'number' && payload.totalBytes > 0
        ? payload.totalBytes
        : null;
    const ratio = totalBytes ? Math.min(payload.bytesTransferred / totalBytes, 1) : null;

    setTransferProgress({
      direction: payload.direction,
      bytesTransferred: payload.bytesTransferred,
      totalBytes,
      ratio,
    });

    if (payload.direction === 'toWallet') {
      setTransferPhase('transferring_to_wallet');
      return;
    }
    setTransferPhase('transferring_from_wallet');
  }, []);

  const onSignedPayload = useCallback(() => {
    hceLog('HCE_SIGNED_TX received — marking complete');
    awaitingSignedPayloadRef.current = false;
    setTransferPhase('complete');
    setTransferProgress((current) => {
      if (!current || !current.totalBytes) {
        return current;
      }
      return { ...current, bytesTransferred: current.totalBytes, ratio: 1 };
    });
  }, []);

  const waitForSignedPayload = useCallback((callback: SignedPayloadCallback) => {
    hceLog('registering HCE_SIGNED_TX listener');
    listenerRef.current?.remove();
    listenerRef.current = DeviceEventEmitter.addListener('HCE_SIGNED_TX', (json: string) => {
      hceLog('HCE_SIGNED_TX fired — payload length:', json.length);
      listenerRef.current?.remove();
      onSignedPayload();
      callback(json);
    });
  }, [onSignedPayload]);

  const clearSignedTxListener = useCallback(() => {
    listenerRef.current?.remove();
    listenerRef.current = null;
  }, []);

  const waitForSignedPayloadOnce = useCallback(
    (timeoutMs = 30000, timeoutMessage = 'Timed out waiting for signed payload over NFC.'): Promise<string> => {
    return new Promise((resolve, reject) => {
      hceLog(`waitForSignedPayloadOnce — timeout=${timeoutMs}ms`);
      const timeout = setTimeout(() => {
        hceLog('✗ NFC wait timed out after', timeoutMs, 'ms');
        awaitingSignedPayloadRef.current = false;
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
    sessionListenerRef.current = DeviceEventEmitter.addListener(
      'HCE_NFC_SESSION',
      (rawState: HceSessionState) => {
        hceLog('HCE_NFC_SESSION:', rawState, '— awaiting:', awaitingSignedPayloadRef.current, 'activations:', activationCountRef.current);
        if (rawState !== 'active' && rawState !== 'idle') {
          hceLog('unexpected session state value:', rawState);
          return;
        }
        setSessionState(rawState);

        if (!awaitingSignedPayloadRef.current) {
          return;
        }

        if (rawState === 'active') {
          activationCountRef.current += 1;
          hceLog('tap #' + activationCountRef.current, '→', activationCountRef.current <= 1 ? 'transferring_to_wallet' : 'transferring_from_wallet');
          if (activationCountRef.current <= 1) {
            setTransferPhase('transferring_to_wallet');
          } else {
            setTransferPhase('transferring_from_wallet');
          }
          return;
        }

        if (activationCountRef.current === 1) {
          hceLog('first tap ended — entering waiting_for_rescan');
          setTransferPhase('waiting_for_rescan');
        }
      },
    );

    progressListenerRef.current = DeviceEventEmitter.addListener(
      'HCE_TRANSFER_PROGRESS',
      (payload: string | NativeTransferProgressPayload) => {
        if (typeof payload === 'string') {
          try {
            const parsed = JSON.parse(payload) as NativeTransferProgressPayload;
            hceLog('HCE_TRANSFER_PROGRESS (string):', parsed.direction, parsed.bytesTransferred, '/', parsed.totalBytes ?? '?');
            applyTransferProgress(parsed);
          } catch {
            hceLog('HCE_TRANSFER_PROGRESS — failed to parse string payload:', payload);
          }
          return;
        }

        hceLog('HCE_TRANSFER_PROGRESS (object):', payload.direction, payload.bytesTransferred, '/', payload.totalBytes ?? '?');
        applyTransferProgress(payload);
      },
    );

    return () => {
      clearSignedTxListener();
      sessionListenerRef.current?.remove();
      sessionListenerRef.current = null;
      progressListenerRef.current?.remove();
      progressListenerRef.current = null;
      resetTransferState();
    };
  }, [applyTransferProgress, clearSignedTxListener, resetTransferState]);

  return {
    loadPayload,
    waitForSignedPayload,
    waitForSignedPayloadOnce,
    waitForSignedTx,
    waitForSignedTxOnce,
    clearSignedTxListener,
    resetTransferState,
    transferPhase,
    transferProgress,
    sessionState,
  };
}
