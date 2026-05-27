'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import TextField from '@/components/ui/TextField';
import ContinueButton from '@/components/ui/ContinueButton';
import { useToast, ToastContainer } from '@/components/ui/Toast';

interface QNameProps {
  initialName?: string;
  initialEmail?: string;
  onContinue: (companyName: string, email: string) => Promise<void>;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export default function QName({ initialName = '', initialEmail = '', onContinue }: QNameProps) {
  const [name, setName]   = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toasts, dismiss, loading: showLoading, success, error } = useToast();

  const emailTouched = email.length > 0;
  const emailValid   = isValidEmail(email);
  const canContinue  = name.trim().length > 0 && emailValid;

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val && !isValidEmail(val)) {
      setEmailError('Ingrese un correo electrónico válido.');
    } else {
      setEmailError('');
    }
  };

  const handleContinue = async () => {
    if (!canContinue || loading) return;
    setLoading(true);
    const loadId = showLoading('Enviando código de verificación...');
    try {
      await onContinue(name.trim(), email.trim());
      dismiss(loadId);
      success('Código enviado a ' + email.trim());
    } catch (err: any) {
      dismiss(loadId);
      error(err?.message ?? 'Error al enviar el código. Intente de nuevo.');
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canContinue) handleContinue();
  };

  return (
    <>
      <QuestionCard
        stepLabel="Identificación"
        question="Indique el nombre de la empresa a evaluar para efectos de determinar la categoría regulatoria en la cual opera"
      >
        <TextField
          label="Razón social o nombre comercial *"
          value={name}
          onChange={setName}
          placeholder="Ej: Energía del Pacífico S.A.S."
          autoFocus
          autoComplete="organization"
        />
        <TextField
          label="Correo electrónico de contacto *"
          value={email}
          onChange={handleEmailChange}
          type="email"
          placeholder="Ej: contacto@empresa.com"
          error={emailTouched && emailError ? emailError : undefined}
          autoComplete="email"
        />
        <ContinueButton
          onClick={handleContinue}
          disabled={!canContinue}
          loading={loading}
        />
      </QuestionCard>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
