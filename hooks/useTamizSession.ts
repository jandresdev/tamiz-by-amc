'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TamizStep, RegulatoryScheme, TamizAnswers } from '@/lib/types';
import { SESSION_TIMEOUT_MINUTES } from '@/lib/constants';

// Warn the user this many minutes before the session expires
const TIMEOUT_WARN_MINUTES_BEFORE = 5;

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

export interface TimeoutWarning {
  active: boolean;
  minutesLeft: number; // remaining minutes at warning time
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
  const [state, setState]                   = useState<SessionState>(INITIAL_STATE);
  const [timeoutWarning, setTimeoutWarning] = useState<TimeoutWarning>({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
  const lastActivityRef                     = useRef<number>(Date.now());

  // Touch activity timestamp — clears any active timeout warning
  const touch = useCallback(() => {
    lastActivityRef.current = Date.now();
    setTimeoutWarning({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
  }, []);

  // Session timeout check — runs on a 30-second tick
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 60_000; // minutes

      // Only act outside the first step (qName has no saved data to lose)
      if (state.currentStep === 'qName') return;

      if (elapsed >= SESSION_TIMEOUT_MINUTES) {
        // Full timeout → silent reset
        setTimeoutWarning({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
        setState(INITIAL_STATE);
        lastActivityRef.current = Date.now();
      } else if (elapsed >= SESSION_TIMEOUT_MINUTES - TIMEOUT_WARN_MINUTES_BEFORE) {
        // Approaching timeout → show warning if not already shown
        const minutesLeft = Math.ceil(SESSION_TIMEOUT_MINUTES - elapsed);
        setTimeoutWarning((prev) =>
          prev.active ? prev : { active: true, minutesLeft }
        );
      }
    }, 30_000); // check every 30 seconds

    return () => clearInterval(interval);
  }, [state.currentStep]); // only re-register when step changes

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setTimeoutWarning({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
    lastActivityRef.current = Date.now();
  }, []);

  /** Dismiss the timeout warning and reset the inactivity clock. */
  const extendSession = useCallback(() => {
    touch();
  }, [touch]);

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
    extendSession,
    timeoutWarning,
    canGoBack: state.history.length > 0,
    isOnFirstStep: state.currentStep === 'qName',
  };
}
