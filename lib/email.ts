// ============================================================================
// EMAIL — Tamiz v2.0
//
// Verificación de email: gestionada 100% por Supabase Auth OTP.
//   → Configura la plantilla en: Supabase Dashboard → Auth → Email Templates
//   → Configura SMTP propio en:  Supabase Dashboard → Project Settings → Auth → SMTP
//
// Reporte de diagnóstico a ops: Web3Forms → ops@amcprincipal.com
// ============================================================================

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

// ============================================================================
// Tipos públicos
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

// ============================================================================
// Reporte de diagnóstico → ops (Web3Forms)
// ============================================================================

/**
 * Envía el diagnóstico completo a ops@amcprincipal.com vía Web3Forms.
 * La verificación de email ya no pasa por aquí — la maneja Supabase Auth OTP.
 */
export async function sendDiagnosticReport(payload: DiagnosticReportPayload): Promise<{
  ok: boolean;
  opsResponseId?: string;
  userResponseId?: string;
  error?: string;
}> {
  const result = await sendReportToOps(payload);
  return {
    ok: result.ok,
    opsResponseId: result.responseId,
    userResponseId: undefined, // ya no se envía copia al usuario por email
  };
}

// ============================================================================
// Interno: envío a ops vía Web3Forms
// ============================================================================

async function sendReportToOps(
  payload: DiagnosticReportPayload
): Promise<{ ok: boolean; responseId?: string }> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('[email] WEB3FORMS_ACCESS_KEY no configurado');
    return { ok: false };
  }

  const answersFormatted = formatAnswers(payload.answers);

  try {
    const res = await fetch(WEB3FORMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key:           accessKey,
        subject:              `[Tamiz] Diagnóstico — ${payload.companyName} → ${payload.diagnosedSchemeLabel}`,
        diagnostico_id:       payload.diagnosticoId,
        empresa:              payload.companyName,
        email_contacto:       payload.contactEmail,
        intuicion_inicial:    payload.initialIntuitionLabel,
        esquema_diagnosticado: payload.diagnosedSchemeLabel,
        coincidencia:         payload.isMatch ? 'Sí' : 'No',
        respuestas:           answersFormatted,
        normativa_adicional:  payload.normativaText || '(no especificado)',
        timestamp:            new Date().toISOString(),
        tipo:                 'diagnostico_completo',
      }),
    });

    if (!res.ok) {
      console.error('[email] Web3Forms error:', res.status, await res.text());
      return { ok: false };
    }

    const data = await res.json();
    return { ok: true, responseId: data.submission_id ?? data.id };
  } catch (err) {
    console.error('[email] Error enviando a ops:', err);
    return { ok: false };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatAnswers(answers: Record<string, string | string[]>): string {
  return Object.entries(answers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
}
