'use client';

import { useEffect, useCallback } from 'react';
import BrandHeader from '@/components/ui/BrandHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import SchemePills from '@/components/ui/SchemePills';
import NavButtons from '@/components/ui/NavButtons';
import QName from '@/components/steps/QName';
import QVerify from '@/components/steps/QVerify';
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
import type { RegulatoryScheme } from '@/lib/types';

export default function QuestionnairePage() {
  const { state, reset, goBack, advanceTo, setVerified, setFile, extendSession, timeoutWarning, canGoBack, isOnFirstStep } = useTamizSession();

  // Init security on mount
  useEffect(() => {
    const cleanup = initSecurityMeasures();
    return cleanup;
  }, []);

  // Warn before unload/refresh when session has progress
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (state.currentStep !== 'qName' && state.currentStep !== 'resultFinal') {
        e.preventDefault();
        // Modern browsers show a generic message; the string is ignored
        return '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [state.currentStep]);

  // ── File upload helper (fire-and-forget) ────────────────────────────────────
  /**
   * Uploads a file to Supabase Storage in the background.
   * Updates files_json in the DB session record.
   * Non-blocking: user advances to next step immediately.
   */
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Step 1: qName → qVerify */
  const handleQName = async (companyName: string, email: string) => {
    // Call API to create session (with email + company to avoid temp placeholder)
    const sessRes = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, companyName }),
    });
    const sessData = await sessRes.json();
    if (!sessData.ok) throw new Error('No se pudo crear la sesión.');

    const tokenRes = await fetch('/api/send-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessData.sessionId, email, companyName }),
    });
    if (!tokenRes.ok) throw new Error('Error al enviar el código.');

    // Save in local state and advance
    setVerified(email, companyName, sessData.sessionId);
    advanceTo('qVerify', {});
  };

  /** Step 2: qVerify → q0 */
  const handleVerify = async (token: string): Promise<boolean> => {
    const res = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, token }),
    });
    const data = await res.json();
    if (data.ok && data.verified) {
      advanceTo('q0', {});
      return true;
    }
    return false;
  };

  const handleResend = async () => {
    await fetch('/api/send-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, email: state.contactEmail, companyName: state.companyName }),
    });
  };

  /** Step 3: q0 → q1 */
  const handleQ0 = (value: string) => {
    advanceTo('q1', { q0: value });
  };

  /** Step 4: q1 → qA1 or qB1 */
  const handleQ1 = (value: string, file: File | null) => {
    if (file) {
      setFile('q1', file);
      uploadFileAsync('q1', file); // uploads in background, non-blocking
    }
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('q1', value, state.answers);
    advanceTo(nextStep, { q1: value }, keepSchemes, preliminaryScheme);
  };

  /** Branch A steps */
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

  /** Branch B steps */
  const handleQB1 = (value: string, file: File | null) => {
    if (file) {
      setFile('qB1', file);
      uploadFileAsync('qB1', file); // uploads in background, non-blocking
    }
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qB1', value, state.answers);
    advanceTo(nextStep, { qB1: value }, keepSchemes, preliminaryScheme);
  };

  const handleQB2 = (value: string) => {
    const { nextStep, keepSchemes, preliminaryScheme } = routeNextStep('qB2', value, state.answers);
    advanceTo(nextStep, { qB2: value }, keepSchemes, preliminaryScheme);
  };

  /** Result actions */
  const handleSendReport = async (normativaText?: string) => {
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, normativaText }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Error al enviar el diagnóstico.');
  };

  // ── Render current step ──────────────────────────────────────────────────

  const renderStep = () => {
    const { currentStep, companyName, contactEmail, answers, activeSchemes, preliminaryScheme, files } = state;

    switch (currentStep) {
      case 'qName':
        return (
          <QName
            initialName={companyName}
            initialEmail={contactEmail}
            onContinue={handleQName}
          />
        );

      case 'qVerify':
        return (
          <QVerify
            email={contactEmail}
            onVerify={handleVerify}
            onResend={handleResend}
          />
        );

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
        return (
          <QA1
            companyName={companyName}
            initialValue={answers.qA1}
            onContinue={handleQA1}
          />
        );

      case 'qA2':
        return (
          <QA2
            companyName={companyName}
            initialValue={answers.qA2}
            onContinue={handleQA2}
          />
        );

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
        return (
          <QB2
            companyName={companyName}
            initialValue={answers.qB2}
            onContinue={handleQB2}
          />
        );

      case 'resultFinal':
        return (
          <Result
            companyName={companyName}
            contactEmail={contactEmail}
            diagnosedScheme={preliminaryScheme}
            answers={answers}
            files={Object.fromEntries(Object.entries(files).map(([k, f]) => [k, { name: f.name }]))}
            onSendReport={handleSendReport}
            onNewDiagnosis={reset}
          />
        );

      default:
        return null;
    }
  };

  const showSchemes = !['qName', 'qVerify'].includes(state.currentStep);
  const showNav     = !isOnFirstStep;

  return (
    <div id="amc-app">
      <div className="container">
        <BrandHeader />

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
              <li>Comprar o producir energía son negocios jurídicos diferentes y mutuamente excluyentes. Establecer cuál es el aplicable depende de la realidad de las relaciones jurídicas, económicas y operativas existentes.</li>
              <li>Esta herramienta tiene en cuenta la posibilidad de operar con equipos de propiedad de terceros conforme a la ley vigente y aplicable.</li>
            </ul>
            <h4>Avisos legales</h4>
            <p className="legal">Esta versión no constituye una revisión exhaustiva de cumplimiento regulatorio; es solo un <em>tamiz inicial</em> (smell test) orientativo.</p>
            <p className="legal">Esta herramienta no constituye asesoría jurídica ni de ninguna naturaleza.</p>
            <p className="legal">El uso de la herramienta es responsabilidad del usuario, quien debe contar con autorización previa, expresa y escrita de AMC Principal para su uso.</p>
            <p className="legal">Tamiz | by AMC Principal · v2.0 · Todos los derechos reservados. Prohibida su reproducción, modificación y cualquier uso no autorizado.</p>
          </div>
        </details>

        {showSchemes && (
          <SchemePills
            activeSchemes={state.activeSchemes}
            confirmedScheme={state.currentStep === 'resultFinal' ? state.preliminaryScheme : null}
          />
        )}

        {showSchemes && <ProgressBar currentStep={state.currentStep} />}

        {renderStep()}

        {showNav && (
          <NavButtons
            onBack={canGoBack ? goBack : undefined}
            onReset={reset}
            showBack={canGoBack}
            showReset={!isOnFirstStep}
          />
        )}

        <p className="footer">AMC Principal specialized services platform · Bogotá · Cali · Miami · Palo Alto</p>
      </div>

      {/* Session timeout warning modal */}
      {timeoutWarning.active && (
        <SessionTimeoutModal
          minutesLeft={timeoutWarning.minutesLeft}
          onExtend={extendSession}
          onEnd={reset}
        />
      )}
    </div>
  );
}
