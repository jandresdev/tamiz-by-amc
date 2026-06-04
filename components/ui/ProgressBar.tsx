'use client';

import type { TamizStep } from '@/lib/types';

interface ProgressBarProps {
  currentStep: TamizStep;
}

// Map each step to its visual progress index (1-4)
const STEP_PROGRESS: Record<TamizStep, number> = {
  q0: 1,
  q1: 2,
  qA1: 3,
  qA2: 3,
  qA3: 4,
  qB1: 3,
  qB2: 4,
  resultFinal: 4,
};

const TOTAL_STEPS = 4;

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
