'use client';

import { useRef } from 'react';

interface TokenInputProps {
  value: string;
  onChange: (val: string) => void;
  status?: 'idle' | 'error' | 'success';
  disabled?: boolean;
}

export default function TokenInput({ value, onChange, status = 'idle', disabled = false }: TokenInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(raw);
  };

  const statusClass =
    status === 'error'   ? ' input-error' :
    status === 'success' ? ' input-success' :
    '';

  return (
    <div className="token-input-wrap">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        className={`token-input${statusClass}`}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Código de verificación de 6 dígitos"
      />
    </div>
  );
}
