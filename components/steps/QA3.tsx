'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'si',
    label: '<strong>Sí</strong> — X es el único consumidor',
    desc: 'Toda la energía comprada es consumida exclusivamente por X; no existe distribución a terceros',
  },
  {
    value: 'no',
    label: '<strong>No</strong> — hay otros consumidores',
    desc: 'La energía comprada es consumida por X y también por otros consumidores (empleados, arrendatarios, filiales, etc.)',
  },
];

interface QA3Props {
  companyName: string;
  initialValue?: string;
  initialConsumers?: string;
  onContinue: (value: string, otherConsumers: string) => void;
}

export default function QA3({ companyName, initialValue, initialConsumers = '', onContinue }: QA3Props) {
  const [selected, setSelected]   = useState(initialValue ?? '');
  const [consumers, setConsumers] = useState(initialConsumers);

  const label = companyName || 'X';

  const opts = OPTIONS.map((o) => ({
    ...o,
    label: o.label.replace(/\bX\b/g, label),
    desc:  o.desc.replace(/\bX\b/g, label),
  }));

  return (
    <QuestionCard
      stepLabel="Rama Compra · Paso A3"
      question={`¿${label} es el único consumidor de la energía que adquiere?`}
      hint="Se refiere a si la energía comprada se destina exclusivamente al consumo de X, o si también es distribuida o compartida con terceros."
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

      {selected === 'no' && (
        <div style={{ marginTop: '14px' }}>
          <label className="field-label" htmlFor="consumers-field">
            ¿Quiénes son los otros consumidores? (opcional)
          </label>
          <textarea
            id="consumers-field"
            className="text-input"
            placeholder={`Ej: empleados de ${label}, arrendatarios del inmueble, empresas del grupo...`}
            value={consumers}
            onChange={(e) => setConsumers(e.target.value)}
            rows={3}
          />
        </div>
      )}

      <ContinueButton
        onClick={() => onContinue(selected, consumers)}
        disabled={!selected}
      />
    </QuestionCard>
  );
}
