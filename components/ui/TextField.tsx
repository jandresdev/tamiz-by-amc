'use client';

import React from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text' | 'email';
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}

export default function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  disabled = false,
  autoFocus = false,
  autoComplete,
}: TextFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`text-input${error ? ' input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
      />
      {error && (
        <p className="field-error visible" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
