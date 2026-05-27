'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TamizStep, RegulatoryScheme, TamizAnswers } from '@/lib/types';
import { SESSION_TIMEOUT_MINUTES } from '@/lib/constants';

export interface SessionState {
  sessionId: string | null;
  companyName: string;
  contactEmail: string;
  currentStep: TamizStep;
  emailVerified: boolean;
  answers: TamizAnswers;
  activeSchemes: RegulatoryScheme[];
  preliminaryScheme: RegulatoryScheme | null;
  history: TamizStep[];
  files: Record<string, File>;
}

const INITIAL_STATE: SessionState = {
  sessionId: null,
  companyName: '',
  contactEmail: '',
  currentStep: 'qName',
  emailVerified: false,
  answers: {},
  activeSchemes: ['AUTOGEN', 'PMARG', 'SUMIN', 'VENTAEXC', 'SINSOP'],
  preliminaryScheme: null,
  history: [],
  files: {},
};

const ALL_SCHEMES: RegulatoryScheme[] = ['AUTOGEN', 'PMARG', 'SUMIN', 'VENTAEXC', 'SINSOP'];

export function useTamizSession() {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const lastActivityRef   = useRef<number>(Date.now());

  // Touch activity timestamp on any state change
  const touch = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Session timeout check
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 60_000; // minutes
      if (elapsed > SESSION_TIMEOUT_MINUTES && state.currentStep !== 'qName') {
        reset();
      }
    }, 30_000); // check every 30 seconds
    return () => clearInterval(interval);
  });

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    lastActivityRef.current = Date.now();
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) return prev;
      const newHistory = [...prev.history];
      const previousStep = newHistory.pop()!;
      return { ...prev, currentStep: previousStep, history: newHistory };
    });
    touch();
  }, [touch]);

  const discardSchemes = useCallback((keep: RegulatoryScheme[]) => {
    const filtered = keep.filter((s) => ALL_SCHEMES.includes(s));
    if (!filtered.includes('SINSOP')) filtered.push('SINSOP');
    return filtered;
  }, []);

  const advanceTo = useCallback(
    (
      nextStep: TamizStep,
      answerUpdate: Partial<TamizAnswers> = {},
      keep?: RegulatoryScheme[],
      preliminary?: RegulatoryScheme | null
    ) => {
      setState((prev) => ({
        ...prev,
        history: [...prev.history, prev.currentStep],
        currentStep: nextStep,
        answers: { ...prev.answers, ...answerUpdate },
        activeSchemes: keep ? discardSchemes(keep) : prev.activeSchemes,
        preliminaryScheme: preliminary !== undefined ? preliminary : prev.preliminaryScheme,
      }));
      touch();
    },
    [discardSchemes, touch]
  );

  /**
   * Store session info after initial name/email submission.
   * Does NOT mark email as verified — that happens when the token is confirmed.
   */
  const setVerified = useCallback(
    (email: string, company: string, sessionId: string) => {
      setState((prev) => ({
        ...prev,
        sessionId,
        contactEmail: email,
        companyName: company,
        emailVerified: false, // will be set true in advanceTo after token verification
      }));
      touch();
    },
    [touch]
  );

  const setFile = useCallback((step: string, file: File | null) => {
    setState((prev) => {
      const files = { ...prev.files };
      if (file) {
        files[step] = file;
      } else {
        delete files[step];
      }
      return { ...prev, files };
    });
  }, []);

  return {
    state,
    reset,
    goBack,
    advanceTo,
    setVerified,
    setFile,
    canGoBack: state.history.length > 0,
    isOnFirstStep: state.currentStep === 'qName',
  };
}
