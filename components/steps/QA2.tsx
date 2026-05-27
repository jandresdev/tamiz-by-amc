'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'si',
    label: '<strong>Sí</strong> — el vendedor es una ESP',
    desc: 'La empresa vendedora está constituida como Empresa de Servicios Públicos y cuenta con registro ante la SSPD',
  },
  {
    value: 'no',
    label: '<strong>No</strong> — el vendedor no es una ESP',
    desc: 'La empresa vendedora no está constituida como ESP o no cuenta con registro ante la SSPD',
  },
];

interface QA2Props {
  companyName: string;
  initialValue?: string;
  onContinue: (value: string) => void;
}

export default function QA2({ companyName, initialValue, onContinue }: QA2Props) {
  const [selected, setSelected] = useState(initialValue ?? '');
  const label = companyName || 'X';

  return (
    <QuestionCard
      stepLabel="Rama Compra · Paso A2"
      question={`¿La empresa que vende la energía a ${label} es una Empresa de Servicios Públicos (ESP)?`}
      hint="Una ESP tiene objeto social exclusivo para prestar servicios públicos domiciliarios y debe estar registrada ante la Superintendencia de Servicios Públicos Domiciliarios (SSPD)."
    >
      {OPTIONS.map((opt) => (
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
