import { createClient } from './supabase.server';
import type {
  TamizSession,
  TamizFile,
  TamizDiagnostico,
  RegulatoryScheme,
  TamizAnswers,
} from './types';

// ============================================================================
// TAMIZ SESSIONS
// ============================================================================

export async function createSession(email: string, companyName: string = 'Sin nombre'): Promise<TamizSession> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_sessions')
    .insert({
      contact_email: email,
      company_name: companyName,
      contact_name: 'Sin nombre',
      status: 'active',
      current_step: 'q0',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data;
}

export async function getSession(sessionId: string): Promise<TamizSession> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) throw new Error(`Failed to get session: ${error.message}`);
  return data;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<TamizSession>
): Promise<TamizSession> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update session: ${error.message}`);
  return data;
}

export async function setVerifyToken(
  sessionId: string,
  token: string,
  expiryMinutes: number = 10
): Promise<void> {
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);

  await updateSession(sessionId, {
    verify_token: token,
    verify_expiry: expiryTime.toISOString(),
    verify_attempts: 0,
  } as Partial<TamizSession>);
}

export async function verifyEmailToken(
  sessionId: string,
  token: string
): Promise<boolean> {
  const session = await getSession(sessionId);

  if (!session.verify_token || !session.verify_expiry) {
    return false;
  }

  // Check expiry
  const now = new Date();
  const expiry = new Date(session.verify_expiry);
  if (now > expiry) {
    return false;
  }

  // Check attempts
  if (session.verify_attempts >= 5) {
    return false;
  }

  // Check token
  if (session.verify_token !== token) {
    await updateSession(sessionId, {
      verify_attempts: session.verify_attempts + 1,
    } as Partial<TamizSession>);
    return false;
  }

  // Token is valid - mark as verified
  await updateSession(sessionId, {
    email_verified: true,
    verify_token: null,
    verify_expiry: null,
  } as Partial<TamizSession>);

  return true;
}

export async function updateSessionAnswer(
  sessionId: string,
  step: string,
  answer: string | string[]
): Promise<void> {
  const session = await getSession(sessionId);
  const answers = session.answers_json || {};

  (answers as Record<string, string | string[]>)[step] = answer;

  await updateSession(sessionId, {
    answers_json: answers,
  } as Partial<TamizSession>);
}

export async function updateActiveSchemes(
  sessionId: string,
  schemes: RegulatoryScheme[]
): Promise<void> {
  // SINSOP should never be removed
  const active = new Set(schemes);
  active.add('SINSOP');

  await updateSession(sessionId, {
    active_schemes: Array.from(active) as RegulatoryScheme[],
  } as Partial<TamizSession>);
}

export async function moveToStep(
  sessionId: string,
  step: string
): Promise<void> {
  const session = await getSession(sessionId);
  const history = session.history_json || [];

  // Add current step to history
  if (session.current_step && session.current_step !== step) {
    history.push(session.current_step);
  }

  await updateSession(sessionId, {
    current_step: step,
    history_json: history,
    last_activity: new Date().toISOString(),
  } as Partial<TamizSession>);
}

export async function checkSessionTimeout(
  sessionId: string,
  timeoutMinutes: number = 30
): Promise<boolean> {
  const session = await getSession(sessionId);
  const now = new Date();
  const lastActivity = new Date(session.last_activity);
  const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

  return diffMinutes > timeoutMinutes;
}

// ============================================================================
// TAMIZ FILES
// ============================================================================

export async function createFileRecord(
  sessionId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  supabasePath: string,
  expiryDays: number = 7
): Promise<TamizFile> {
  const client = await createClient();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  const { data, error } = await client
    .from('tamiz_files')
    .insert({
      session_id: sessionId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      supabase_path: supabasePath,
      expires_at: expiryDate.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create file record: ${error.message}`);
  return data;
}

export async function getSessionFiles(sessionId: string): Promise<TamizFile[]> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_files')
    .select('*')
    .eq('session_id', sessionId);

  if (error) throw new Error(`Failed to get files: ${error.message}`);
  return data || [];
}

export async function deleteFileRecord(fileId: string): Promise<void> {
  const client = await createClient();
  const { error } = await client
    .from('tamiz_files')
    .delete()
    .eq('id', fileId);

  if (error) throw new Error(`Failed to delete file record: ${error.message}`);
}

// ============================================================================
// TAMIZ DIAGNOSTICOS
// ============================================================================

export async function createDiagnostico(
  sessionId: string,
  companyName: string,
  email: string,
  initialIntuition: string,
  diagnosedScheme: RegulatoryScheme,
  allAnswers: TamizAnswers
): Promise<TamizDiagnostico> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_diagnosticos')
    .insert({
      session_id: sessionId,
      company_name: companyName,
      contact_email: email,
      initial_intuition: initialIntuition,
      diagnosed_scheme: diagnosedScheme,
      all_answers: allAnswers,
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create diagnostico: ${error.message}`);
  return data;
}

export async function getDiagnostico(
  diagnosticoId: string
): Promise<TamizDiagnostico> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_diagnosticos')
    .select('*')
    .eq('id', diagnosticoId)
    .single();

  if (error) throw new Error(`Failed to get diagnostico: ${error.message}`);
  return data;
}

export async function getDiagnosticoBySession(
  sessionId: string
): Promise<TamizDiagnostico | null> {
  const client = await createClient();
  const { data, error } = await client
    .from('tamiz_diagnosticos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get diagnostico: ${error.message}`);
  }

  return data || null;
}

export async function markDiagnosticoSent(
  diagnosticoId: string,
  sentToOps: boolean = false,
  sentToUser: boolean = false,
  opsResponseId?: string,
  userResponseId?: string
): Promise<void> {
  const client = await createClient();
  const { error } = await client
    .from('tamiz_diagnosticos')
    .update({
      sent_to_ops: sentToOps,
      sent_to_user: sentToUser,
      ops_response_id: opsResponseId || null,
      user_response_id: userResponseId || null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', diagnosticoId);

  if (error) throw new Error(`Failed to update diagnostico: ${error.message}`);
}

// ============================================================================
// UTILITIES
// ============================================================================

export async function cleanupExpiredFiles(): Promise<number> {
  const client = await createClient();
  const now = new Date().toISOString();

  const { data: expiredFiles, error: fetchError } = await client
    .from('tamiz_files')
    .select('id, supabase_path')
    .lte('expires_at', now);

  if (fetchError) {
    console.error('Failed to fetch expired files:', fetchError);
    return 0;
  }

  let deletedCount = 0;

  for (const file of expiredFiles || []) {
    // Delete from storage
    if (file.supabase_path) {
      await client.storage
        .from('tamiz-files')
        .remove([file.supabase_path])
        .catch((err: unknown) => console.error('Storage delete error:', err));
    }

    // Delete record
    await deleteFileRecord(file.id);
    deletedCount++;
  }

  return deletedCount;
}
