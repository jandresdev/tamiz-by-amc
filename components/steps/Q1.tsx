'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import UploadZone from '@/components/ui/UploadZone';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'produce',
    label: '<strong>Produce</strong> la energía',
    desc: 'X genera su propia energía (planta solar, eólica, hidro, etc.) mediante equipos propios o de terceros',
  },
  {
    value: 'compra',
    label: '<strong>Compra</strong> la energía',
    desc: 'X adquiere la energía a través de un contrato de compraventa con un tercero',
  },
];

interface Q1Props {
  companyName: string;
  initialValue?: string;
  initialFile?: File | null;
  onContinue: (value: string, file: File | null) => void;
}

export default function Q1({ companyName, initialValue, initialFile, onContinue }: Q1Props) {
  const [selected, setSelected] = useState(initialValue ?? '');
  const [file, setFile]         = useState<File | null>(initialFile ?? null);

  const label = companyName || 'X';

  // Replace X with company name in descriptions
  const opts = OPTIONS.map((o) => ({
    ...o,
    label: o.label.replace(/\bX\b/g, label),
    desc:  o.desc.replace(/\bX\b/g, label),
  }));

  return (
    <QuestionCard
      stepLabel="Paso 1 · Origen de la energía"
      question={`¿${label} produce o compra la energía que utiliza o comercializa?`}
      hint="Comprar o producir energía son negocios jurídicos diferentes y mutuamente excluyentes. La respuesta depende de la realidad de las relaciones jurídicas, económicas y operativas existentes."
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

      <UploadZone
        label="Adjuntar contrato o documentación relevante (opcional)"
        subtitle="PDF, Word, Excel o imagen · Máx. 10 MB"
        onChange={setFile}
        currentFile={file ? { name: file.name, size: file.size, type: file.type, file } : null}
      />

      <ContinueButton
        onClick={() => onContinue(selected, file)}
        disabled={!selected}
      />
    </QuestionCard>
  );
}
