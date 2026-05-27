'use client';

import { useState, useEffect } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import TokenInput from '@/components/ui/TokenInput';
import ContinueButton from '@/components/ui/ContinueButton';
import { useToast, ToastContainer } from '@/components/ui/Toast';

interface QVerifyProps {
  email: string;
  onVerify: (token: string) => Promise<boolean>;
  onResend: () => Promise<void>;
  maxAttempts?: number;
}

const RESEND_COOLDOWN = 60;

export default function QVerify({ email, onVerify, onResend, maxAttempts = 5 }: QVerifyProps) {
  const [token, setToken]       = useState('');
  const [status, setStatus]     = useState<'idle' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const { toasts, dismiss, success: showSuccess, error: showError, loading: showLoading } = useToast();

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    if (token.length !== 6 || loading) return;
    setLoading(true);
    try {
      const ok = await onVerify(token);
      if (ok) {
        setStatus('success');
        showSuccess('Correo verificado correctamente');
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setStatus('error');
        if (nextAttempts >= maxAttempts) {
          setErrorMsg(`Demasiados intentos fallidos. Solicite un nuevo código.`);
        } else {
          setErrorMsg(`Código incorrecto. Verifique e intente de nuevo. (Intento ${nextAttempts} de ${maxAttempts})`);
        }
      }
    } catch {
      setStatus('error');
      setErrorMsg('Error al verificar. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setCooldown(RESEND_COOLDOWN);
    setToken('');
    setStatus('idle');
    setErrorMsg('');
    setAttempts(0);
    const lid = showLoading('Reenviando código...');
    try {
      await onResend();
      dismiss(lid);
      showSuccess(`Código reenviado a ${email}`);
    } catch {
      dismiss(lid);
      showError('No se pudo reenviar el código.');
    }
  };

  const tooManyAttempts = attempts >= maxAttempts;
  const canVerify = token.length === 6 && !loading && !tooManyAttempts && status !== 'success';

  return (
    <>
      <QuestionCard stepLabel="Verificación de identidad" question="Verifique su correo electrónico">
        <div className="verify-wrapper">
          <span className="verify-icon" aria-hidden="true">📧</span>
          <p className="verify-desc">Ingrese el código de verificación de 6 dígitos:</p>
          <span className="verify-email-chip">{email}</span>

          <TokenInput
            value={token}
            onChange={(v) => { setToken(v); setStatus('idle'); setErrorMsg(''); }}
            status={status}
            disabled={loading || status === 'success' || tooManyAttempts}
          />

          {errorMsg && (
            <p className="field-error visible" style={{ textAlign: 'left' }} role="alert">
              {errorMsg}
            </p>
          )}

          {cooldown > 0 ? (
            <p className="verify-timer">
              Puede solicitar un nuevo código en <strong>{cooldown}s</strong>
            </p>
          ) : null}

          {cooldown <= 0 && status !== 'success' && (
            <button
              type="button"
              className="resend-link"
              onClick={handleResend}
              disabled={loading}
            >
              Reenviar código
            </button>
          )}

          <div className="verify-help">
            <strong>¿No recibió el código?</strong> Revise su carpeta de spam o solicite el reenvío.
            Si persiste el problema, comuníquese con <strong>ops@amcprincipal.com</strong>.
          </div>

          <ContinueButton
            label={status === 'success' ? '✓ Verificado' : 'Verificar y continuar'}
            onClick={handleVerify}
            disabled={!canVerify}
            loading={loading}
          />
        </div>
      </QuestionCard>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
