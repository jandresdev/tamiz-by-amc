'use client';

import { useState } from 'react';
import QuestionCard from '@/components/ui/QuestionCard';
import AnswerButton from '@/components/ui/AnswerButton';
import UploadZone from '@/components/ui/UploadZone';
import ContinueButton from '@/components/ui/ContinueButton';

const OPTIONS = [
  {
    value: 'propia',
    label: 'Frontera <strong>propia</strong> / EC registrada en RUT de X',
    desc: 'Los equipos de conexión (frontera comercial) son de propiedad de X o aparecen en su RUT como activos fijos',
  },
  {
    value: 'tercero',
    label: 'Frontera o registro a nombre de un <strong>tercero</strong>',
    desc: 'Los equipos de conexión son propiedad de otro operador o el registro SIC/frontera está a nombre de tercero',
  },
];

interface QB1Props {
  companyName: string;
  initialValue?: string;
  initialFile?: File | null;
  onContinue: (value: string, file: File | null) => void;
}

export default function QB1({ companyName, initialValue, initialFile, onContinue }: QB1Props) {
  const [selected, setSelected] = useState(initialValue ?? '');
  const [file, setFile]         = useState<File | null>(initialFile ?? null);

  const label = companyName || 'X';

  const opts = OPTIONS.map((o) => ({
    ...o,
    label: o.label.replace(/\bX\b/g, label),
    desc:  o.desc.replace(/\bX\b/g, label),
  }));

  return (
    <QuestionCard
      stepLabel="Rama Produce · Paso B1"
      question={`¿La frontera comercial de ${label} es de propiedad propia o de un tercero?`}
      hint="La frontera comercial es el punto de medición y conexión al sistema eléctrico. Su titularidad es clave para determinar el esquema regulatorio aplicable."
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
        label="Adjuntar documentación de la frontera (opcional)"
        subtitle="Registro SIC, escritura, RUT — PDF, Word, Excel o imagen · Máx. 10 MB"
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
