'use client';

import type { ReactNode } from 'react';

interface QuestionCardProps {
  stepLabel?: string;       // e.g. "Paso 1 · Empresa"
  question: string;
  hint?: string;
  children: ReactNode;      // answer buttons, inputs, etc.
}

export default function QuestionCard({ stepLabel, question, hint, children }: QuestionCardProps) {
  return (
    <div className="question-card">
      {stepLabel && <p className="q-label">{stepLabel}</p>}
      <p className="q-text">{question}</p>
      {hint && <p className="q-hint">{hint}</p>}
      {children}
    </div>
  );
}
