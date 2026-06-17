'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BrandHeader from '@/components/ui/BrandHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import SchemePills from '@/components/ui/SchemePills';
import NavButtons from '@/components/ui/NavButtons';
import Q0 from '@/components/steps/Q0';
import Q1 from '@/components/steps/Q1';
import QA1 from '@/components/steps/QA1';
import QA2 from '@/components/steps/QA2';
import QA3 from '@/components/steps/QA3';
import QB1 from '@/components/steps/QB1';
import QB2 from '@/components/steps/QB2';
import Result from '@/components/steps/Result';
import SessionTimeoutModal from '@/components/ui/SessionTimeoutModal';
import { useTamizSession } from '@/hooks/useTamizSession';
import { routeNextStep } from '@/lib/logic';
import { initSecurityMeasures } from '@/lib/security';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';
import type { RegulatoryScheme } from '@/lib/types';

export default function QuestionnairePage() {
  const router = useRouter();
  const {
    state, reset, goBack, advanceTo, initFromUser, setSessionId,
    setFile, extendSession, timeoutWarning, canGoBack, isOnFirstStep,
  } = useTamizSession();

  // ── Init: load user profile & create a DB session ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      console.log('[questionnaire] auth.getUser:', user?.id ?? null, userErr?.message ?? null);
      if (!user || cancelled) return;

      // Get profile for company name
      const { data: profile, error: profileErr } = await supabase
        .from('tamiz_user_profiles')
        .select('company_name, contact_email')
        .eq('id', user.id)
        .single();

      console.log('[questionnaire] profile:', profile, profileErr?.message ?? null);
      if (!profile || cancelled) return;

      // Create or recover a tamiz_session for this user
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.contact_email,
          companyName: profile.company_name,
          userId: user.id,
        }),
      });
      const sessData = await res.json().catch(() => ({}));
      const sessionId = sessData.sessionId ?? null;
      console.log('[questionnaire] sessionId:', sessionId, sessData);

      if (!cancelled) {
        initFromUser(profile.company_name, profile.contact_email, sessionId ?? undefined);
        if (sessionId) setSessionId(sessionId);
      }
    }

    loadUser();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Security measures ────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = initSecurityMeasures();
    return cleanup;
  }, []);

  // ── Warn before unload ───────────────────────────────────────────────────────
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (state.currentStep !== 'q0' && state.currentStep !== 'resultFinal') {
        e.preventDefault();
        return '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [state.currentStep]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/access');
  }, [router]);

  // ── File upload helper ───────────────────────────────────────────────────────
  const uploadFileAsync = useCallback(async (stepKey: string, file: File) => {
    if (!state.sessionId) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sessionId', state.sessionId);
      fd.append('stepKey', stepKey);
      const res = await fetch('/api/upload-file', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[upload] File upload failed:', data.error);
      }
    } catch (e) {
      console.warn('[upload] Non-critical upload error:', e);
    }
  }, [state.sessionId]);

  // ── Step handlers ────────────────────────────────────────────────────────────

  const handleQ0 = (value: string) => {
    advanceTo('q1', { q0: value });
  };

  const handleQ1 = (value: string, file: File | null) => {
    if (file) { setFile('q1', file); uploadFileAsync('q1', file); }
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('q1', value, state.answers);
    advanceTo(nextStep, { q1: value }, keepSchemes, preliminaryScheme);
  };

  const handleQA1 = (value: string) => {
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qA1', value, state.answers);
    advanceTo(nextStep, { qA1: value }, keepSchemes, preliminaryScheme);
  };

  const handleQA2 = (value: string) => {
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qA2', value, { ...state.answers, qA2: value });
    advanceTo(nextStep, { qA2: value }, keepSchemes, preliminaryScheme);
  };

  const handleQA3 = (value: string, consumers: string) => {
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qA3', value, state.answers);
    advanceTo(nextStep, { qA3: value, qA3consumers: consumers }, keepSchemes, preliminaryScheme);
  };

  const handleQB1 = (value: string, file: File | null) => {
    if (file) { setFile('qB1', file); uploadFileAsync('qB1', file); }
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qB1', value, state.answers);
    advanceTo(nextStep, { qB1: value }, keepSchemes, preliminaryScheme);
  };

  const handleQB2 = (value: string) => {
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qB2', value, state.answers);
    advanceTo(nextStep, { qB2: value }, keepSchemes, preliminaryScheme);
  };

  const handleSendReport = async (normativaText?: string) => {
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        normativaText,
        preliminaryScheme: state.preliminaryScheme,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Error al enviar el diagnóstico.');
  };

  // ── Render current step ──────────────────────────────────────────────────────
  const renderStep = () => {
    const { currentStep, companyName, contactEmail, answers, files } = state;

    switch (currentStep) {
      case 'q0':
        return (
          <Q0
            companyName={companyName}
            initialValue={answers.q0}
            onContinue={handleQ0}
          />
        );
      case 'q1':
        return (
          <Q1
            companyName={companyName}
            initialValue={answers.q1}
            initialFile={files.q1 ?? null}
            onContinue={handleQ1}
          />
        );
      case 'qA1':
        return <QA1 companyName={companyName} initialValue={answers.qA1} onContinue={handleQA1} />;
      case 'qA2':
        return <QA2 companyName={companyName} initialValue={answers.qA2} onContinue={handleQA2} />;
      case 'qA3':
        return (
          <QA3
            companyName={companyName}
            initialValue={answers.qA3}
            initialConsumers={answers.qA3consumers}
            onContinue={handleQA3}
          />
        );
      case 'qB1':
        return (
          <QB1
            companyName={companyName}
            initialValue={answers.qB1}
            initialFile={files.qB1 ?? null}
            onContinue={handleQB1}
          />
        );
      case 'qB2':
        return <QB2 companyName={companyName} initialValue={answers.qB2} onContinue={handleQB2} />;
      case 'resultFinal':
        return (
          <Result
            sessionId={state.sessionId}
            companyName={companyName}
            contactEmail={contactEmail}
            diagnosedScheme={state.preliminaryScheme}
            answers={answers}
            files={Object.fromEntries(Object.entries(files).map(([k, f]) => [k, { name: f.name }]))}
            onSendReport={handleSendReport}
            onNewDiagnosis={() => reset(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div id="amc-app">
      <div className="container">
        <BrandHeader onLogout={handleLogout} userLabel={state.companyName || state.contactEmail} />

        {/* Legal accordion */}
        <details className="info-block">
          <summary>
            <span>Instructivo y avisos legales</span>
            <span className="chevron">▾</span>
          </summary>
          <div className="info-content">
            <h4>Instructivo</h4>
            <ul>
              <li><strong>X</strong> es la empresa que se evalúa para efectos de determinar la categoría regulatoria en la cual opera.</li>
              <li>Comprar o producir energía son negocios jurídicos diferentes y mutuamente excluyentes.</li>
              <li>Esta herramienta tiene en cuenta la posibilidad de operar con equipos de propiedad de terceros.</li>
            </ul>
            <h4>Avisos legales</h4>
            <p className="legal">Esta versión no constituye una revisión exhaustiva de cumplimiento regulatorio; es solo un <em>tamiz inicial</em> orientativo.</p>
            <p className="legal">Esta herramienta no constituye asesoría jurídica ni de ninguna naturaleza.</p>
            <p className="legal">El uso de la herramienta es responsabilidad del usuario, quien debe contar con autorización previa, expresa y escrita de AMC Principal.</p>
            <p className="legal">Tamiz | by AMC Principal · v2.0 · Todos los derechos reservados.</p>
          </div>
        </details>

        <SchemePills
          activeSchemes={state.activeSchemes}
          confirmedScheme={state.currentStep === 'resultFinal' ? state.preliminaryScheme : null}
        />
        <ProgressBar currentStep={state.currentStep} />

        {renderStep()}

        {!isOnFirstStep && (
          <NavButtons
            onBack={canGoBack ? goBack : undefined}
            onReset={() => reset(true)}
            showBack={canGoBack}
            showReset={!isOnFirstStep}
          />
        )}

        <p className="footer">AMC Principal specialized services platform · Bogotá · Cali · Miami · Palo Alto</p>
      </div>

      {timeoutWarning.active && (
        <SessionTimeoutModal
          minutesLeft={timeoutWarning.minutesLeft}
          onExtend={extendSession}
          onEnd={() => reset(true)}
        />
      )}
    </div>
  );
}
