// ============================================================================
// email.ts — Tamiz v2.0
//
// Verificación OTP  → Supabase Auth (signInWithOtp / verifyOtp)
// Diagnóstico a ops → Resend API con archivos adjuntos de Supabase Storage
// ============================================================================

import { Resend } from 'resend';

const OPS_EMAIL = 'ops@amcprincipal.com';

// ============================================================================
// Tipos públicos
// ============================================================================

export interface DiagnosticAttachment {
  filename: string;
  content: Buffer;   // raw bytes descargados de Supabase Storage
  contentType: string;
}

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
  attachments?: DiagnosticAttachment[];
}

// ============================================================================
// Enviar diagnóstico a ops@amcprincipal.com
// ============================================================================

/**
 * Envía el diagnóstico completo a ops por email usando Resend.
 * Incluye los archivos adjuntos descargados de Supabase Storage.
 */
export async function sendDiagnosticReport(payload: DiagnosticReportPayload): Promise<{
  ok: boolean;
  opsResponseId?: string;
  userResponseId?: string;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY no configurado');
    return { ok: false, error: 'RESEND_API_KEY no configurado' };
  }

  const resend = new Resend(apiKey);

  const subject = `[Tamiz] Diagnóstico — ${payload.companyName} → ${payload.diagnosedSchemeLabel}`;
  const html    = buildDiagnosticHtml(payload);

  // Convertir adjuntos al formato que espera Resend
  const resendAttachments = (payload.attachments ?? []).map((a) => ({
    filename:    a.filename,
    content:     a.content,           // Buffer — Resend acepta Buffer directamente
    contentType: a.contentType,
  }));

  try {
    const { data, error } = await resend.emails.send({
      from:        `Tamiz AMC Principal <${process.env.RESEND_FROM_EMAIL ?? 'noreply@amcprincipal.com'}>`,
      to:          [OPS_EMAIL],
      subject,
      html,
      attachments: resendAttachments,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, opsResponseId: data?.id };
  } catch (err) {
    console.error('[email] Error enviando a ops:', err);
    return { ok: false, error: String(err) };
  }
}

// ============================================================================
// Plantilla HTML del diagnóstico
// ============================================================================

function buildDiagnosticHtml(p: DiagnosticReportPayload): string {
  const matchColor = p.isMatch ? '#15926A' : '#D97706';
  const matchText  = p.isMatch ? '✓ Coincide con intuición inicial' : '↗ Difiere de la intuición inicial';

  const answersRows = Object.entries(p.answers)
    .filter(([k]) => k !== 'q0')
    .map(([k, v]) => `
      <tr>
        <td style="padding:9px 14px;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;width:42%;">${esc(k)}</td>
        <td style="padding:9px 14px;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:500;">${esc(Array.isArray(v) ? v.join(', ') : v)}</td>
      </tr>`)
    .join('');

  const adjuntosSection = (p.attachments?.length ?? 0) > 0
    ? `<p style="margin:16px 0 4px;font-size:13px;color:#5F5C56;">
         <strong>Archivos adjuntos:</strong> ${p.attachments!.map(a => esc(a.filename)).join(', ')}
       </p>`
    : '';

  const normativaSection = p.normativaText
    ? `<div style="margin-top:18px;padding:14px 16px;background:#F5F4F0;border-radius:8px;border:1px solid #E6E3D8;">
         <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#5F5C56;text-transform:uppercase;letter-spacing:1px;">Normativa adicional</p>
         <p style="margin:0;font-size:13px;color:#18171A;line-height:1.6;">${esc(p.normativaText)}</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Diagnóstico Tamiz</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.09);">

  <!-- Header -->
  <tr>
    <td style="background:#4A41B2;padding:28px 36px;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">AMC PRINCIPAL</p>
      <p style="margin:5px 0 0;color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Diagnóstico Tamiz</p>
    </td>
  </tr>

  <!-- Empresa + Esquema -->
  <tr>
    <td style="padding:30px 36px 20px;">
      <p style="margin:0 0 2px;color:#A09C94;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Empresa analizada</p>
      <p style="margin:0 0 22px;color:#18171A;font-size:20px;font-weight:800;">${esc(p.companyName)}</p>

      <!-- Esquema diagnosticado -->
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#ECEAFB;border-radius:10px;margin-bottom:14px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 3px;color:#4A41B2;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Esquema Diagnosticado</p>
            <p style="margin:0;color:#18171A;font-size:22px;font-weight:800;">${esc(p.diagnosedSchemeLabel)}</p>
          </td>
        </tr>
      </table>

      <!-- Intuición vs diagnóstico -->
      <p style="margin:0 0 6px;color:#5F5C56;font-size:13px;">
        Intuición inicial: <strong style="color:#18171A;">${esc(p.initialIntuitionLabel)}</strong>
      </p>
      <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${p.isMatch ? '#DCF2EA' : '#FEF3C7'};color:${matchColor};">
        ${matchText}
      </span>
    </td>
  </tr>

  <!-- Resumen de respuestas -->
  <tr>
    <td style="padding:0 36px 28px;">
      <p style="margin:0 0 10px;color:#18171A;font-size:14px;font-weight:700;">Resumen de respuestas</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6E3D8;border-radius:8px;overflow:hidden;">
        ${answersRows}
      </table>
      ${normativaSection}
      ${adjuntosSection}
    </td>
  </tr>

  <!-- Meta -->
  <tr>
    <td style="padding:0 36px 28px;">
      <p style="margin:0;font-size:12px;color:#A09C94;">
        ID diagnóstico: <code style="background:#F5F4F0;padding:2px 6px;border-radius:4px;">${esc(p.diagnosticoId)}</code><br>
        Contacto: ${esc(p.contactEmail)} · ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F5F4F0;padding:18px 36px;border-top:1px solid #EDEAE0;">
      <p style="margin:0;color:#A09C94;font-size:11px;">Tamiz es una herramienta propietaria de AMC Principal. Uso confidencial.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
