// Type definitions for Tamiz application

export type RegulatoryScheme =
  | 'AUTOGEN'
  | 'PMARG'
  | 'SUMIN'
  | 'VENTAEXC'
  | 'SINSOP';

export type TamizStep =
  | 'q0'
  | 'q1'
  | 'qA1'
  | 'qA2'
  | 'qA3'
  | 'qB1'
  | 'qB2'
  | 'resultFinal';

export interface TamizAnswers {
  q0?: string; // Intuición inicial
  q1?: string; // ¿Produce o Compra?
  qA1?: string; // Rama A: ¿Vendedor vinculado?
  qA2?: string; // Rama A: ¿Vendedor es ESP?
  qA3?: string; // Rama A: ¿Único consumidor?
  qA3consumers?: string; // Rama A: Otros consumidores
  qB1?: string; // Rama B: Naturaleza frontera
  qB2?: string; // Rama B: Vinculación usuario
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface DiagnosticAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface FilesJson {
  [key: string]: FileMetadata;
}

export interface TamizSession {
  id: string;
  company_name: string | null;
  contact_email: string;
  user_id: string | null;          // Supabase Auth user ID (if authenticated)
  current_step: TamizStep;
  email_verified: boolean;
  verify_token: string | null;
  verify_expiry: string | null;
  verify_attempts: number;
  last_activity: string;
  answers_json: TamizAnswers;
  preliminary_scheme: RegulatoryScheme | null;
  active_schemes: RegulatoryScheme[];
  history_json: TamizStep[];
  files_json: FilesJson;
  normativa_user_text: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TamizFile {
  id: string;
  session_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  supabase_path: string;
  uploaded_at: string;
  expires_at: string | null;
}

export interface TamizDiagnostico {
  id: string;
  session_id: string;
  company_name: string;
  contact_email: string;
  initial_intuition: string;
  diagnosed_scheme: RegulatoryScheme;
  all_answers: TamizAnswers;
  sent_to_ops: boolean;
  sent_to_user: boolean;
  ops_response_id: string | null;
  user_response_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SendTokenRequest {
  sessionId: string;
  email: string;
  companyName: string;
}

export interface VerifyEmailRequest {
  sessionId: string;
  token: string;
}

export interface SaveAnswerRequest {
  sessionId: string;
  step: TamizStep;
  answer: string | string[];
  activeSchemes: RegulatoryScheme[];
  nextStep: TamizStep;
}

export interface SendReportRequest {
  sessionId: string;
}
