import type { RegulatoryScheme, TamizStep, TamizAnswers } from './types';

/**
 * Returns the next step and which schemes to keep active,
 * based on current step and the answer chosen.
 * SINSOP is always kept — never discarded.
 */
export function routeNextStep(
  currentStep: TamizStep,
  answer: string,
  currentAnswers: TamizAnswers
): {
  nextStep: TamizStep;
  keepSchemes: RegulatoryScheme[];
  preliminaryScheme: RegulatoryScheme | null;
} {
  const ALL: RegulatoryScheme[] = ['AUTOGEN', 'PMARG', 'SUMIN', 'VENTAEXC', 'SINSOP'];

  switch (currentStep) {
    case 'q1':
      if (answer === 'compra') {
        return { nextStep: 'qA1', keepSchemes: ['PMARG', 'SUMIN', 'SINSOP'], preliminaryScheme: null };
      } else {
        return { nextStep: 'qB1', keepSchemes: ['AUTOGEN', 'PMARG', 'VENTAEXC', 'SINSOP'], preliminaryScheme: null };
      }

    case 'qA1':
      if (answer === 'si') {
        return { nextStep: 'qA3', keepSchemes: ['PMARG', 'SINSOP'], preliminaryScheme: 'PMARG' };
      } else {
        return { nextStep: 'qA2', keepSchemes: ['PMARG', 'SUMIN', 'SINSOP'], preliminaryScheme: null };
      }

    case 'qA2':
      if (answer === 'si') {
        return { nextStep: 'qA3', keepSchemes: ['SUMIN', 'SINSOP'], preliminaryScheme: 'SUMIN' };
      } else {
        return { nextStep: 'qA3', keepSchemes: ['SINSOP'], preliminaryScheme: 'SINSOP' };
      }

    case 'qA3': {
      let scheme: RegulatoryScheme = (currentAnswers.qA1 === 'si' ? 'PMARG' :
                                       currentAnswers.qA2 === 'si' ? 'SUMIN' : 'SINSOP') as RegulatoryScheme;
      // If there are other consumers and scheme is SUMIN or PMARG, fall back to SINSOP
      if (answer === 'no' && (scheme === 'SUMIN' || scheme === 'PMARG')) {
        scheme = 'SINSOP';
      }
      return { nextStep: 'resultFinal', keepSchemes: [scheme], preliminaryScheme: scheme };
    }

    case 'qB1':
      if (answer === 'propia') {
        return { nextStep: 'resultFinal', keepSchemes: ['AUTOGEN', 'SINSOP'], preliminaryScheme: 'AUTOGEN' };
      } else {
        return { nextStep: 'qB2', keepSchemes: ['PMARG', 'VENTAEXC', 'SINSOP'], preliminaryScheme: null };
      }

    case 'qB2':
      if (answer === 'vinc') {
        return { nextStep: 'resultFinal', keepSchemes: ['PMARG', 'SINSOP'], preliminaryScheme: 'PMARG' };
      } else if (answer === 'sinvinc') {
        return { nextStep: 'resultFinal', keepSchemes: ['VENTAEXC', 'SINSOP'], preliminaryScheme: 'VENTAEXC' };
      } else {
        return { nextStep: 'resultFinal', keepSchemes: ['SINSOP'], preliminaryScheme: 'SINSOP' };
      }

    default:
      return { nextStep: currentStep, keepSchemes: ALL, preliminaryScheme: null };
  }
}

/**
 * Determines the "tone" of the result card.
 */
export function getResultTone(scheme: RegulatoryScheme | null): 'match' | 'no-match' | 'stop' {
  if (!scheme) return 'stop';
  if (scheme === 'SINSOP') return 'no-match';
  return 'match';
}

/**
 * Compares initial intuition vs diagnosed scheme.
 */
export function compareIntuition(
  initial: string | undefined,
  diagnosed: RegulatoryScheme | null
): { match: boolean; neutral: boolean; bannerClass: 'match' | 'mismatch' | 'neutral'; message: string } {
  const SCHEME_NAMES: Record<string, string> = {
    AUTOGEN:  'Autogeneración Remota',
    PMARG:    'Producción Marginal Remota',
    SUMIN:    'Suministro de Energía',
    VENTAEXC: 'Venta de Excedentes de Autogeneración',
    SINSOP:   'Operación sin soporte regulatorio',
    NOSE:     'No estaba seguro',
  };
  const diagName = diagnosed ? (SCHEME_NAMES[diagnosed] ?? diagnosed) : 'Análisis pausado';

  if (!initial || initial === 'NOSE') {
    return { match: false, neutral: true, bannerClass: 'neutral', message: `No tenía una hipótesis inicial. El diagnóstico arroja: ${diagName}.` };
  }
  if (initial === diagnosed) {
    return { match: true, neutral: false, bannerClass: 'match', message: 'Su intuición inicial coincide con el diagnóstico.' };
  }
  return { match: false, neutral: false, bannerClass: 'mismatch', message: 'Su intuición inicial difiere del diagnóstico. Esta diferencia conviene revisarla con el equipo de AMC Principal.' };
}

/**
 * Human-readable labels for each question/answer pair in the summary.
 */
export const ANSWER_LABELS: Record<string, Record<string, string>> = {
  q1:  { produce: 'Produce la energía', compra: 'Compra la energía' },
  qA1: { si: 'Sí — vinculado económico', no: 'No — no es vinculado económico' },
  qA2: { si: 'Sí — Empresa de Servicios Públicos', no: 'No — no es ESP' },
  qA3: { si: 'Sí — único consumidor', no: 'No — hay más consumidores' },
  qB1: { propia: 'Frontera propia / EC en RUT, registrada ante XM', tercero: 'Frontera/registro a nombre de un tercero' },
  qB2: { vinc: 'Usuario con vinculación económica', sinvinc: 'Sin vinculación económica', varios: 'Frontera atiende varios usuarios' },
};

export const QUESTION_LABELS: Record<string, string> = {
  q1:  '¿Produce o compra?',
  qA1: '¿Vendedor vinculado económico?',
  qA2: '¿Vendedor es ESP?',
  qA3: '¿Único consumidor?',
  qB1: 'Naturaleza de la Frontera',
  qB2: 'Vinculación del usuario de la Frontera',
};
