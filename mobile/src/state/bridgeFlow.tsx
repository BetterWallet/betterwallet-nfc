import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

export type BridgeStage =
  | 'compose'
  | 'review'
  | 'nfc_approve'
  | 'broadcasting_approve'
  | 'nfc_send'
  | 'broadcasting_send'
  | 'success'
  | 'error';

export interface BridgeFlowState {
  stage: BridgeStage;
  amountUsdc: string;
  receiver: string;
  avaxFeeWei: bigint | null;
  approveTxHash: string | null;
  ccipTxHash: string | null;
  messageId: string | null;
  error: string | null;
}

type BridgeFlowAction =
  | { type: 'SET_STAGE'; payload: BridgeStage }
  | { type: 'SET_AMOUNT'; payload: string }
  | { type: 'SET_RECEIVER'; payload: string }
  | { type: 'SET_FEE'; payload: bigint }
  | { type: 'SET_APPROVE_HASH'; payload: string }
  | { type: 'SET_CCIP_RESULT'; payload: { ccipTxHash: string; messageId: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' };

interface BridgeFlowContextValue {
  state: BridgeFlowState;
  setStage: (stage: BridgeStage) => void;
  setAmount: (amount: string) => void;
  setReceiver: (receiver: string) => void;
  setFee: (fee: bigint) => void;
  setApproveHash: (hash: string) => void;
  setCcipResult: (result: { ccipTxHash: string; messageId: string }) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const initialState: BridgeFlowState = {
  stage: 'compose',
  amountUsdc: '1.0',
  receiver: '',
  avaxFeeWei: null,
  approveTxHash: null,
  ccipTxHash: null,
  messageId: null,
  error: null,
};

const BridgeFlowContext = createContext<BridgeFlowContextValue | undefined>(undefined);

function reducer(state: BridgeFlowState, action: BridgeFlowAction): BridgeFlowState {
  switch (action.type) {
    case 'SET_STAGE':
      return { ...state, stage: action.payload, error: null };
    case 'SET_AMOUNT':
      return { ...state, amountUsdc: action.payload };
    case 'SET_RECEIVER':
      return { ...state, receiver: action.payload };
    case 'SET_FEE':
      return { ...state, avaxFeeWei: action.payload };
    case 'SET_APPROVE_HASH':
      return { ...state, approveTxHash: action.payload };
    case 'SET_CCIP_RESULT':
      return {
        ...state,
        ccipTxHash: action.payload.ccipTxHash,
        messageId: action.payload.messageId,
        stage: 'success',
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, stage: 'error', error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function BridgeFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setStage = useCallback((stage: BridgeStage) => {
    dispatch({ type: 'SET_STAGE', payload: stage });
  }, []);
  const setAmount = useCallback((amount: string) => {
    dispatch({ type: 'SET_AMOUNT', payload: amount });
  }, []);
  const setReceiver = useCallback((receiver: string) => {
    dispatch({ type: 'SET_RECEIVER', payload: receiver });
  }, []);
  const setFee = useCallback((fee: bigint) => {
    dispatch({ type: 'SET_FEE', payload: fee });
  }, []);
  const setApproveHash = useCallback((hash: string) => {
    dispatch({ type: 'SET_APPROVE_HASH', payload: hash });
  }, []);
  const setCcipResult = useCallback(
    (result: { ccipTxHash: string; messageId: string }) => {
      dispatch({ type: 'SET_CCIP_RESULT', payload: result });
    },
    [],
  );
  const setError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<BridgeFlowContextValue>(
    () => ({
      state,
      setStage,
      setAmount,
      setReceiver,
      setFee,
      setApproveHash,
      setCcipResult,
      setError,
      reset,
    }),
    [reset, setAmount, setApproveHash, setCcipResult, setError, setFee, setReceiver, setStage, state],
  );

  return <BridgeFlowContext.Provider value={value}>{children}</BridgeFlowContext.Provider>;
}

export function useBridgeFlow() {
  const context = useContext(BridgeFlowContext);
  if (!context) {
    throw new Error('useBridgeFlow must be used inside BridgeFlowProvider.');
  }
  return context;
}
