// ============================================================================
// EMAIL INTEGRATIONS
// Brevo API for verification tokens + Web3Forms for diagnostic reports
// Mirrors original Tamiz v1.0 email integrations exactly
// ============================================================================

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

// ============================================================================
// BREVO - Verification Email
// ============================================================================

/**
 * Send 6-digit verification token to user's email via Brevo API.
 * HTML template matches original Tamiz v1.0 Brevo template.
 */
export async function sendVerificationEmail(
  toEmail: string,
  companyName: string,
  token: string
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[email] BREVO_API_KEY not configured');
    return false;
  }

  const senderName = process.env.BREVO_SENDER_NAME || 'Tamiz | AMC Principal';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@amcprincipal.com';

  const htmlContent = buildVerificationEmailHtml(companyName, token);
  const textContent = buildVerificationEmailText(companyName, token);

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: companyName }],
    subject: `${token} — Código de verificación Tamiz`,
    htmlContent,
    textContent,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[email] Brevo API error:', response.status, errorData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Failed to send verification email:', err);
    return false;
  }
}

// ============================================================================
// WEB3FORMS - Register verification request (ops log)
// ============================================================================

/**
 * Register a verification email request to ops via Web3Forms.
 * Used for audit trail of email sends.
 */
export async function registerVerificationRequest(
  companyName: string,
  email: string,
  token: string
): Promise<void> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.warn('[email] WEB3FORMS_ACCESS_KEY not configured, skipping ops registration');
    return;
  }

  try {
    await fetch(WEB3FORMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `[Tamiz] Verificación de email — ${companyName}`,
        empresa: companyName,
        email_destinatario: email,
        token_enviado: token,
        timestamp: new Date().toISOString(),
        tipo: 'verificacion_email',
      }),
    });
  } catch (err) {
    // Non-critical — don't throw
    console.warn('[email] Failed to register verification request:', err);
  }
}

// ============================================================================
// WEB3FORMS + BREVO - Diagnostic Report
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
 * Send diagnostic report:
 * 1. To ops email (ops@amcprincipal.com) via Web3Forms
 * 2. To user email via Brevo
 */
export async function sendDiagnosticReport(payload: DiagnosticReportPayload): Promise<{
  ok: boolean;
  opsResponseId?: string;
  userResponseId?: string;
  error?: string;
}> {
  const [opsResult, userResult] = await Promise.allSettled([
    sendReportToOps(payload),
    sendReportToUser(payload),
  ]);

  const opsOk = opsResult.status === 'fulfilled' && opsResult.value.ok;
  const opsResponseId = opsResult.status === 'fulfilled' ? opsResult.value.responseId : undefined;

  const userOk = userResult.status === 'fulfilled' && userResult.value.ok;
  const userResponseId =
    userResult.status === 'fulfilled' ? userResult.value.responseId : undefined;

  if (!opsOk) {
    console.error('[email] Failed to send report to ops:', opsResult);
  }
  if (!userOk) {
    console.error('[email] Failed to send report to user:', userResult);
  }

  return {
    ok: opsOk || userOk, // Consider OK if at least one succeeded
    opsResponseId,
    userResponseId,
  };
}

// ============================================================================
// Internal: Send report to ops via Web3Forms
// ============================================================================

async function sendReportToOps(
  payload: DiagnosticReportPayload
): Promise<{ ok: boolean; responseId?: string }> {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('[email] WEB3FORMS_ACCESS_KEY not configured');
    return { ok: false };
  }

  const opsEmail = process.env.OPS_EMAIL || 'ops@amcprincipal.com';
  const answersFormatted = formatAnswersForEmail(payload.answers);

  try {
    const response = await fetch(WEB3FORMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `[Tamiz] Diagnóstico — ${payload.companyName} → ${payload.diagnosedSchemeLabel}`,
        to: opsEmail,
        diagnostico_id: payload.diagnosticoId,
        empresa: payload.companyName,
        email_contacto: payload.contactEmail,
        intuicion_inicial: payload.initialIntuitionLabel,
        esquema_diagnosticado: payload.diagnosedSchemeLabel,
        coincidencia: payload.isMatch ? 'Sí' : 'No',
        respuestas: answersFormatted,
        normativa_adicional: payload.normativaText || '(no especificado)',
        timestamp: new Date().toISOString(),
        tipo: 'diagnostico_completo',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[email] Web3Forms error:', response.status, errorText);
      return { ok: false };
    }

    const data = await response.json();
    return { ok: true, responseId: data.submission_id || data.id };
  } catch (err) {
    console.error('[email] Failed to send to ops:', err);
    return { ok: false };
  }
}

// ============================================================================
// Internal: Send report to user via Brevo
// ============================================================================

async function sendReportToUser(
  payload: DiagnosticReportPayload
): Promise<{ ok: boolean; responseId?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[email] BREVO_API_KEY not configured');
    return { ok: false };
  }

  const senderName = process.env.BREVO_SENDER_NAME || 'Tamiz | AMC Principal';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@amcprincipal.com';

  const htmlContent = buildDiagnosticEmailHtml(payload);
  const textContent = buildDiagnosticEmailText(payload);

  const emailPayload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: payload.contactEmail, name: payload.companyName }],
    subject: `Diagnóstico Tamiz — ${payload.companyName} | ${payload.diagnosedSchemeLabel}`,
    htmlContent,
    textContent,
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[email] Brevo API error (user report):', response.status, errorData);
      return { ok: false };
    }

    const data = await response.json();
    return { ok: true, responseId: data.messageId || data.id };
  } catch (err) {
    console.error('[email] Failed to send report to user:', err);
    return { ok: false };
  }
}

// ============================================================================
// HTML Email Templates (matching original Tamiz v1.0 style)
// ============================================================================

function buildVerificationEmailHtml(companyName: string, token: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verificación Tamiz</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#4A41B2;padding:28px 40px;">
              <p style="margin:0;color:#FFFFFF;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">AMC PRINCIPAL</p>
              <p style="margin:6px 0 0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Tamiz</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;color:#5F5C56;font-size:14px;">Empresa: <strong style="color:#18171A;">${escapeHtml(companyName)}</strong></p>
              <p style="margin:0 0 32px;color:#5F5C56;font-size:14px;">Usa el siguiente código para verificar tu correo electrónico:</p>
              <!-- Token box -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#F5F4F0;border:2px solid #4A41B2;border-radius:12px;padding:20px 40px;text-align:center;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#4A41B2;font-variant-numeric:tabular-nums;">${token}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#5F5C56;font-size:13px;">⏱ Este código es válido por <strong>10 minutos</strong>.</p>
              <p style="margin:0;color:#A09C94;font-size:12px;">Si no solicitaste este código, puedes ignorar este mensaje.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F5F4F0;padding:20px 40px;border-top:1px solid #EDEAE0;">
              <p style="margin:0;color:#A09C94;font-size:11px;">Tamiz es una herramienta propietaria de diagnóstico regulatorio de AMC Principal. No compartir.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationEmailText(companyName: string, token: string): string {
  return `TAMIZ | AMC PRINCIPAL
Verificación de correo electrónico

Empresa: ${companyName}

Tu código de verificación es: ${token}

Este código es válido por 10 minutos.

Si no solicitaste este código, ignora este mensaje.

---
Tamiz es una herramienta propietaria de diagnóstico regulatorio de AMC Principal.`;
}

function buildDiagnosticEmailHtml(payload: DiagnosticReportPayload): string {
  const matchBadge = payload.isMatch
    ? `<span style="background:#D1F5EA;color:#15926A;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">✓ Coincide con tu intuición</span>`
    : `<span style="background:#FEF3C7;color:#D97706;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">↗ Diferente a tu intuición</span>`;

  const answersRows = Object.entries(payload.answers)
    .filter(([key]) => key !== 'q0') // q0 is shown separately
    .map(
      ([key, val]) =>
        `<tr>
      <td style="padding:8px 12px;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;">${escapeHtml(key)}</td>
      <td style="padding:8px 12px;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:500;">${escapeHtml(Array.isArray(val) ? val.join(', ') : val)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Diagnóstico Tamiz</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#4A41B2;padding:28px 40px;">
              <p style="margin:0;color:#FFFFFF;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">AMC PRINCIPAL</p>
              <p style="margin:6px 0 0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Diagnóstico Tamiz</p>
            </td>
          </tr>
          <!-- Company + Result -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0 0 4px;color:#5F5C56;font-size:13px;">Empresa analizada</p>
              <p style="margin:0 0 24px;color:#18171A;font-size:20px;font-weight:700;">${escapeHtml(payload.companyName)}</p>
              <!-- Diagnosed scheme -->
              <table cellpadding="0" cellspacing="0" style="background:#F0EFFC;border-radius:10px;width:100%;margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#4A41B2;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Esquema Diagnosticado</p>
                    <p style="margin:0;color:#18171A;font-size:22px;font-weight:800;">${escapeHtml(payload.diagnosedSchemeLabel)}</p>
                  </td>
                </tr>
              </table>
              <!-- Match indicator -->
              <p style="margin:0 0 4px;color:#5F5C56;font-size:12px;">Intuición inicial: <strong style="color:#18171A;">${escapeHtml(payload.initialIntuitionLabel)}</strong></p>
              ${matchBadge}
            </td>
          </tr>
          <!-- Answers table -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 12px;color:#18171A;font-size:14px;font-weight:600;">Resumen de respuestas</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDEAE0;border-radius:8px;overflow:hidden;">
                ${answersRows}
              </table>
              ${payload.normativaText ? `<p style="margin:16px 0 0;color:#5F5C56;font-size:13px;"><strong>Normativa adicional:</strong> ${escapeHtml(payload.normativaText)}</p>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F5F4F0;padding:20px 40px;border-top:1px solid #EDEAE0;">
              <p style="margin:0;color:#A09C94;font-size:11px;">Tamiz es una herramienta propietaria de diagnóstico regulatorio de AMC Principal. Este documento es confidencial.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildDiagnosticEmailText(payload: DiagnosticReportPayload): string {
  const answersText = Object.entries(payload.answers)
    .filter(([key]) => key !== 'q0')
    .map(([key, val]) => `  ${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
    .join('\n');

  return `TAMIZ | AMC PRINCIPAL
Diagnóstico Regulatorio

Empresa: ${payload.companyName}
Email: ${payload.contactEmail}

ESQUEMA DIAGNOSTICADO: ${payload.diagnosedSchemeLabel}
Intuición inicial: ${payload.initialIntuitionLabel}
Coincidencia: ${payload.isMatch ? 'Sí' : 'No'}

RESPUESTAS:
${answersText}

${payload.normativaText ? `Normativa adicional:\n${payload.normativaText}` : ''}

---
Tamiz es una herramienta propietaria de diagnóstico regulatorio de AMC Principal.
Documento confidencial.`;
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAnswersForEmail(answers: Record<string, string | string[]>): string {
  return Object.entries(answers)
    .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
    .join('\n');
}
