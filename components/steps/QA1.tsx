'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'si',
    label: '<strong>Sí</strong> — es un vinculado económico',
    desc: 'El vendedor es una empresa del mismo grupo empresarial, matriz, filial o subsidiaria de X',
  },
  {
    value: 'no',
    label: '<strong>No</strong> — no es un vinculado económico',
    desc: 'El vendedor es un tercero independiente sin relación de vinculación con X',
  },
];

interface QA1Props {
  companyName: string;
  initialValue?: string;
  onContinue: (value: string) => void;
}

export default function QA1({ companyName, initialValue, onContinue }: QA1Props) {
  const [selected, setSelected] = useState(initialValue ?? '');
  const label = companyName || 'X';

  const opts = OPTIONS.map((o) => ({
    ...o,
    label: o.label.replace(/\bX\b/g, label),
    desc:  o.desc.replace(/\bX\b/g, label),
  }));

  return (
    <QuestionCard
      stepLabel="Rama Compra · Paso A1"
      question={`¿El vendedor de energía a ${label} es una empresa vinculada económicamente?`}
      hint="Se entiende por vinculado económico una empresa del mismo grupo empresarial, matriz, filial, subsidiaria o con participación cruzada de capital."
    >
      {opts.map((opt) => (
        <AnswerButton
          key={opt.value}
          label={opt.label}
          description={opt.desc}
          selected={selected === opt.value}
          onClick={() => setSelected(opt.value)}
        />
      ))}
      <ContinueButton onClick={() => onContinue(selected)} disabled={!selected} />
    </QuestionCard>
  );
}
