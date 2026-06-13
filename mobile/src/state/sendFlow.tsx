import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { getSendDefaults } from '../config/sendDefaults';
import type { FlowStage, ReviewDetails, SendDraft, SignedTxMessage, TxResult } from '../types/send';

interface SendFlowState {
  stage: FlowStage;
  draft: SendDraft;
  review: ReviewDetails | null;
  signedTx: SignedTxMessage | null;
  result: TxResult | null;
  error: string | null;
}

type SendFlowAction =
  | { type: 'SET_DRAFT'; payload: Partial<SendDraft> }
  | { type: 'SET_REVIEW'; payload: ReviewDetails }
  | { type: 'SET_STAGE'; payload: FlowStage }
  | { type: 'SET_SIGNED_TX'; payload: SignedTxMessage }
  | { type: 'SET_RESULT'; payload: TxResult }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

interface SendFlowContextValue {
  state: SendFlowState;
  setDraft: (payload: Partial<SendDraft>) => void;
  setReview: (review: ReviewDetails) => void;
  setStage: (stage: FlowStage) => void;
  setSignedTx: (signedTx: SignedTxMessage) => void;
  setResult: (result: TxResult) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const sendDefaults = getSendDefaults();

const initialState: SendFlowState = {
  stage: 'compose',
  draft: {
    to: sendDefaults.to,
    amountEth: sendDefaults.amountEth,
  },
  review: null,
  signedTx: null,
  result: null,
  error: null,
};

const SendFlowContext = createContext<SendFlowContextValue | undefined>(undefined);

function reducer(state: SendFlowState, action: SendFlowAction): SendFlowState {
  switch (action.type) {
    case 'SET_DRAFT':
      return {
        ...state,
        draft: { ...state.draft, ...action.payload },
      };
    case 'SET_REVIEW':
      return {
        ...state,
        review: action.payload,
        stage: 'review',
        error: null,
      };
    case 'SET_STAGE':
      return {
        ...state,
        stage: action.payload,
      };
    case 'SET_SIGNED_TX':
      return {
        ...state,
        signedTx: action.payload,
        error: null,
      };
    case 'SET_RESULT':
      return {
        ...state,
        result: action.payload,
        stage: 'success',
        error: null,
      };
    case 'SET_ERROR':
      if (!action.payload) {
        return {
          ...state,
          error: null,
        };
      }
      return {
        ...state,
        stage: 'error',
        error: action.payload,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function SendFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const setDraft = useCallback((payload: Partial<SendDraft>) => {
    dispatch({ type: 'SET_DRAFT', payload });
  }, []);
  const setReview = useCallback((review: ReviewDetails) => {
    dispatch({ type: 'SET_REVIEW', payload: review });
  }, []);
  const setStage = useCallback((stage: FlowStage) => {
    dispatch({ type: 'SET_STAGE', payload: stage });
  }, []);
  const setSignedTx = useCallback((signedTx: SignedTxMessage) => {
    dispatch({ type: 'SET_SIGNED_TX', payload: signedTx });
  }, []);
  const setResult = useCallback((result: TxResult) => {
    dispatch({ type: 'SET_RESULT', payload: result });
  }, []);
  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<SendFlowContextValue>(
    () => ({
      state,
      setDraft,
      setReview,
      setStage,
      setSignedTx,
      setResult,
      setError,
      reset,
    }),
    [reset, setDraft, setError, setResult, setReview, setSignedTx, setStage, state],
  );

  return <SendFlowContext.Provider value={value}>{children}</SendFlowContext.Provider>;
}

export function useSendFlow() {
  const context = useContext(SendFlowContext);
  if (!context) {
    throw new Error('useSendFlow must be used inside SendFlowProvider.');
  }

  return context;
}
