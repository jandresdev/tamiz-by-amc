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
  answers: TamizAnswers;
  activeSchemes: RegulatoryScheme[];
  preliminaryScheme: RegulatoryScheme | null;
  history: TamizStep[];
  files: Record<string, File>;
}

export interface TimeoutWarning {
  active: boolean;
  minutesLeft: number;
}

const INITIAL_STATE: SessionState = {
  sessionId: null,
  companyName: '',
  contactEmail: '',
  currentStep: 'q0',   // Starts directly at q0 — auth handles identification
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

      // Only act when user has started the questionnaire
      if (state.currentStep === 'q0') return;

      if (elapsed >= SESSION_TIMEOUT_MINUTES) {
        // Full timeout → silent reset
        setTimeoutWarning({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
        setState(prev => ({ ...INITIAL_STATE, companyName: prev.companyName, contactEmail: prev.contactEmail }));
        lastActivityRef.current = Date.now();
      } else if (elapsed >= SESSION_TIMEOUT_MINUTES - TIMEOUT_WARN_MINUTES_BEFORE) {
        const minutesLeft = Math.ceil(SESSION_TIMEOUT_MINUTES - elapsed);
        setTimeoutWarning((prev) =>
          prev.active ? prev : { active: true, minutesLeft }
        );
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [state.currentStep]);

  const reset = useCallback((keepUser = true) => {
    setState(prev => ({
      ...INITIAL_STATE,
      // Preserve user identity across resets
      companyName:  keepUser ? prev.companyName  : '',
      contactEmail: keepUser ? prev.contactEmail : '',
    }));
    setTimeoutWarning({ active: false, minutesLeft: TIMEOUT_WARN_MINUTES_BEFORE });
    lastActivityRef.current = Date.now();
  }, []);

  const extendSession = useCallback(() => { touch(); }, [touch]);

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
   * Initialise session identity from the authenticated user profile.
   * Called once when the questionnaire page mounts.
   */
  const initFromUser = useCallback((companyName: string, contactEmail: string, sessionId?: string) => {
    setState((prev) => ({
      ...prev,
      companyName,
      contactEmail,
      sessionId: sessionId ?? prev.sessionId,
    }));
    touch();
  }, [touch]);

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

  const setSessionId = useCallback((id: string) => {
    setState(prev => ({ ...prev, sessionId: id }));
  }, []);

  return {
    state,
    reset,
    goBack,
    advanceTo,
    initFromUser,
    setSessionId,
    setFile,
    extendSession,
    timeoutWarning,
    canGoBack:     state.history.length > 0,
    isOnFirstStep: state.currentStep === 'q0',
  };
}
