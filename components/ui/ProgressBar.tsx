'use client';

import type { TamizStep } from '@/lib/types';

interface ProgressBarProps {
  currentStep: TamizStep;
}

// Map each step to its visual progress index (1-6)
const STEP_PROGRESS: Record<TamizStep, number> = {
  qName: 1,
  qVerify: 2,
  q0: 3,
  q1: 4,
  qA1: 5,
  qA2: 5,
  qA3: 6,
  qB1: 5,
  qB2: 6,
  resultFinal: 6,
};

const TOTAL_STEPS = 6;

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = STEP_PROGRESS[currentStep] ?? 1;

  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={currentIndex} aria-valuemax={TOTAL_STEPS}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < currentIndex;
        const isActive = stepNum === currentIndex;
        const cls = isDone ? 'progress-step done' : isActive ? 'progress-step active' : 'progress-step';
        return <div key={i} className={cls} aria-label={`Paso ${stepNum} de ${TOTAL_STEPS}`} />;
      })}
    </div>
  );
}
