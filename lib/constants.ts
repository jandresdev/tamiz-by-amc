import type { RegulatoryScheme } from './types';

export const SCHEMES: Record<RegulatoryScheme, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  AUTOGEN: {
    label: 'Autogeneración Remota',
    description: 'Producción de energía para uso propio desde fuente remota',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.10)',
  },
  PMARG: {
    label: 'Producción Marginal Remota',
    description: 'Producción con conexión a red y venta de excedentes',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.10)',
  },
  SUMIN: {
    label: 'Suministro de Energía',
    description: 'Compra de energía a un proveedor regulado',
    color: '#e8f5e9',
    bgColor: 'rgba(232, 245, 233, 0.08)',
  },
  VENTAEXC: {
    label: 'Venta de Excedentes',
    description: 'Venta de excedentes de autogeneración',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.10)',
  },
  SINSOP: {
    label: 'Sin Soporte Regulatorio',
    description: 'Esquema no soportado por regulación actual',
    color: '#4a6b52',
    bgColor: 'rgba(74, 107, 82, 0.08)',
  },
};

export const COLOR_PALETTE = {
  bg: '#0a0f0d',
  bg2: '#0e1613',
  card: 'rgba(16, 32, 25, 0.55)',
  t1: '#e8f5e9',
  t2: '#8fae96',
  t3: '#4a6b52',
  acc: '#22c55e',
  grn: '#22c55e',
  red: '#ef4444',
  redBg: 'rgba(239, 68, 68, 0.10)',
  grnBg: 'rgba(34, 197, 94, 0.10)',
  accBg: 'rgba(34, 197, 94, 0.10)',
  border: 'rgba(34, 197, 94, 0.12)',
  shadow: 'rgba(0, 0, 0, 0.4)',
};

export const QUESTIONS = {
  q0: {
    title: '¿Cuál crees que es tu esquema?',
    subtitle: 'Selecciona tu intuición inicial (puedes cambiarla después)',
  },
  q1: {
    title: '¿Tu empresa produce o compra energía?',
    subtitle: 'Esta pregunta determinará el camino a seguir',
  },
  qA1: {
    title: '¿El vendedor es tu empresa vinculada económicamente?',
    subtitle: 'Rama: Compra de energía',
  },
  qA2: {
    title: '¿El vendedor es un Empresa de Servicios Públicos (ESP)?',
    subtitle: 'Rama: Compra sin vinculación directa',
  },
  qA3: {
    title: '¿Eres el único consumidor?',
    subtitle: 'Última pregunta antes del resultado',
  },
  qB1: {
    title: '¿La frontera es de propiedad propia o de terceros?',
    subtitle: 'Rama: Producción de energía',
  },
  qB2: {
    title: '¿Cuál es tu vinculación como usuario?',
    subtitle: 'Última pregunta antes del resultado',
  },
};

export const SESSION_TIMEOUT_MINUTES = 30;
export const EMAIL_VERIFY_EXPIRY_MINUTES = 10;
export const MAX_VERIFY_ATTEMPTS = 5;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_FILES_SIZE = 50 * 1024 * 1024; // 50MB for session

export const FILE_EXPIRY_DAYS = 7;

export const STEP_ORDER: Record<string, number> = {
  q0: 1,
  q1: 2,
  qA1: 3,
  qA2: 4,
  qA3: 5,
  qB1: 3,
  qB2: 4,
  resultFinal: 6,
};
