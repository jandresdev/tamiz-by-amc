'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  { value: 'AUTOGEN',  label: 'Autogeneración Remota',              desc: 'Produzco mi propia energía con fuente remota para consumo propio' },
  { value: 'PMARG',    label: 'Producción Marginal Remota',          desc: 'Produzco energía con vinculación económica al usuario final' },
  { value: 'SUMIN',    label: 'Suministro de Energía',               desc: 'Compro energía a un proveedor (ESP u otro)' },
  { value: 'VENTAEXC', label: 'Venta de Excedentes de Autogeneración', desc: 'Vendo los excedentes de mi autogeneración al mercado' },
  { value: 'NOSE',     label: 'No estoy seguro',                     desc: 'La herramienta determinará el esquema con base en mis respuestas' },
];

interface Q0Props {
  companyName: string;
  initialValue?: string;
  onContinue: (value: string) => void;
}

export default function Q0({ companyName, initialValue, onContinue }: Q0Props) {
  const [selected, setSelected] = useState(initialValue ?? '');

  const label = companyName ? `${companyName}` : 'la empresa';

  return (
    <QuestionCard
      stepLabel="Intuición inicial"
      question={`¿Cuál crees que es el esquema regulatorio aplicable a ${label}?`}
      hint="Esta es solo tu intuición inicial — la herramienta determinará el esquema con base en tus respuestas. No te preocupes si no estás seguro."
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
      <ContinueButton
        onClick={() => onContinue(selected)}
        disabled={!selected}
      />
    </QuestionCard>
  );
}
