'use client';

import type { RegulatoryScheme } from '@/lib/types';
import { SCHEMES } from '@/lib/constants';

interface SchemePillsProps {
  activeSchemes: RegulatoryScheme[];
  confirmedScheme?: RegulatoryScheme | null;
}

const ALL_SCHEMES: RegulatoryScheme[] = ['AUTOGEN', 'PMARG', 'SUMIN', 'VENTAEXC', 'SINSOP'];

export default function SchemePills({ activeSchemes, confirmedScheme }: SchemePillsProps) {
  return (
    <div className="schemes-panel">
      <p className="schemes-label">Esquemas en evaluación</p>
      <div className="schemes-list">
        {ALL_SCHEMES.map((scheme) => {
          const isActive = activeSchemes.includes(scheme);
          const isConfirmed = scheme === confirmedScheme;
          const pillClass = isConfirmed
            ? 'scheme-pill confirmed'
            : isActive
            ? 'scheme-pill'
            : 'scheme-pill discarded';
          return (
            <span key={scheme} className={pillClass} title={SCHEMES[scheme].description}>
              {isConfirmed ? '✓ ' : !isActive ? '✕ ' : ''}
              {SCHEMES[scheme].label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
