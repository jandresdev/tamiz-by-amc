// ============================================================================
// email.ts — Tamiz v2.0
//
// Todo el flujo de comunicación es 100% Supabase:
//   - Verificación OTP:   Supabase Auth (signInWithOtp / verifyOtp)
//   - Diagnósticos:       Guardados en tamiz_diagnosticos (Supabase DB)
//
// No se usan servicios externos (sin Brevo, sin Web3Forms).
// Ops consulta los diagnósticos desde el dashboard de Supabase.
// ============================================================================

export interface DiagnosticReportPayload {
  diagnosticoId: string;
  companyName: string;
  contactEmail: string;
  initialIntuition: string;
  diagnosedScheme: string;
  diagnosedSchemeLabel: string;
  initialIntuitionLabel: string;
  isMatch: boolean;
  answers: Record<string, string | string[]>;
  normativaText?: string;
}

/**
 * "Enviar diagnóstico" — el registro ya fue guardado en Supabase DB
 * por el route handler antes de llamar aquí.
 * Esta función es un stub que retorna ok: true para mantener
 * la interfaz compatible con send-report/route.ts.
 */
export async function sendDiagnosticReport(_payload: DiagnosticReportPayload): Promise<{
  ok: boolean;
  opsResponseId?: string;
  userResponseId?: string;
}> {
  // El diagnóstico se persiste en tamiz_diagnosticos vía Supabase.
  // Ops lo consulta en: Supabase Dashboard → Table Editor → tamiz_diagnosticos
  return { ok: true };
}
