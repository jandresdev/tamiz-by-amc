'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'vinc',
    label: 'Usuario con <strong>vinculación económica</strong> a X',
    desc: 'El usuario de la frontera es una empresa del mismo grupo, filial, subsidiaria o vinculado económico de X',
  },
  {
    value: 'sinvinc',
    label: 'Usuario <strong>sin vinculación económica</strong>',
    desc: 'El usuario de la frontera es un tercero independiente sin relación de vinculación con X',
  },
  {
    value: 'varios',
    label: 'La frontera atiende <strong>varios usuarios</strong>',
    desc: 'La frontera sirve a múltiples usuarios (con o sin vinculación), lo que genera una situación mixta',
  },
];

interface QB2Props {
  companyName: string;
  initialValue?: string;
  onContinue: (value: string) => void;
}

export default function QB2({ companyName, initialValue, onContinue }: QB2Props) {
  const [selected, setSelected] = useState(initialValue ?? '');
  const label = companyName || 'X';

  const opts = OPTIONS.map((o) => ({
    ...o,
    label: o.label.replace(/\bX\b/g, label),
    desc:  o.desc.replace(/\bX\b/g, label),
  }));

  return (
    <QuestionCard
      stepLabel="Rama Produce · Paso B2"
      question={`¿Cuál es la vinculación del usuario de la frontera comercial respecto de ${label}?`}
      hint="El tipo de vínculo entre X y el usuario de la frontera determina si aplica Producción Marginal Remota, Venta de Excedentes u otro esquema."
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
