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
    color: '#4A41B2',
    bgColor: '#F5F2FF',
  },
  PMARG: {
    label: 'Producción Marginal Remota',
    description: 'Producción con conexión a red y venta de excedentes',
    color: '#15926A',
    bgColor: '#F0FFF9',
  },
  SUMIN: {
    label: 'Suministro de Energía',
    description: 'Compra de energía a un proveedor regulado',
    color: '#18171A',
    bgColor: '#F5F4F0',
  },
  VENTAEXC: {
    label: 'Venta de Excedentes',
    description: 'Venta de excedentes de autogeneración',
    color: '#E66550',
    bgColor: '#FDEAEA',
  },
  SINSOP: {
    label: 'Sin Soporte Regulatorio',
    description: 'Esquema no soportado por regulación actual',
    color: '#A09C94',
    bgColor: '#EDEAE0',
  },
};

export const COLOR_PALETTE = {
  bg: '#F5F4F0',
  bg2: '#EDEAE0',
  card: '#FFFFFF',
  t1: '#18171A',
  t2: '#5F5C56',
  t3: '#A09C94',
  acc: '#4A41B2',
  grn: '#15926A',
  red: '#E66550',
  redBg: '#FDEAEA',
  grnBg: '#F0FFF9',
  accBg: '#F5F2FF',
  border: '#E0DDD6',
  shadow: 'rgba(0, 0, 0, 0.08)',
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
