// ============================================================================
// Supabase Edge Function: send-diagnostic
//
// Descarga archivos de Supabase Storage y envía el diagnóstico completo
// a ops@amcprincipal.com mediante Resend (sin SMTP propio).
//
// Secrets requeridos en Supabase Edge Functions:
//   RESEND_API_KEY  — Obtener en resend.com → API Keys (gratis, sin tarjeta)
//   RESEND_FROM     — e.g. onboarding@resend.dev (sin verificar dominio)
//                     o  noreply@amcprincipal.com (con dominio verificado en Resend)
//
// Variables auto-inyectadas por Supabase (NO configurar manualmente):
//   SUPABASE_URL              — URL del proyecto
//   SUPABASE_SERVICE_ROLE_KEY — service role key
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend';
import { Buffer } from 'node:buffer';

const OPS_EMAIL = 'ops@amcprincipal.com';

const SCHEMES: Record<string, string> = {
  AUTOGEN:  'Autogeneración Remota',
  PMARG:    'Producción Marginal Remota',
  SUMIN:    'Suministro de Energía',
  VENTAEXC: 'Venta de Excedentes de Autogeneración',
  SINSOP:   'Sin soporte regulatorio',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { sessionId, answers, preliminaryScheme, normativaText } = await req.json() as { 
      sessionId: string;
      answers?: any;
      preliminaryScheme?: string;
      normativaText?: string;
    };

    if (!sessionId) {
      return json({ ok: false, error: 'Falta sessionId' }, 400);
    }

    // ── Cliente admin (service role auto-inyectado) ──────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Obtener sesión ────────────────────────────────────────────────────
    const { data: session, error: sessErr } = await supabase
      .from('tamiz_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) {
      return json({ ok: false, error: 'Sesión no encontrada' }, 404);
    }

    // ── 2. Obtener diagnóstico ───────────────────────────────────────────────
    const { data: diagnostico } = await supabase
      .from('tamiz_diagnosticos')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── 3. Descargar archivos de Storage ────────────────────────────────────
    const { data: fileRecords } = await supabase
      .from('tamiz_files')
      .select('*')
      .eq('session_id', sessionId);

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    for (const record of (fileRecords ?? [])) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('tamiz-files')
          .download(record.supabase_path);

        if (dlErr || !blob) {
          console.warn(`[send-diagnostic] No se pudo descargar: ${record.file_name}`);
          continue;
        }

        attachments.push({
          filename:    record.file_name,
          content:     Buffer.from(await blob.arrayBuffer()),
          contentType: record.file_type,
        });
      } catch (e) {
        console.warn(`[send-diagnostic] Error archivo ${record.file_name}:`, e);
      }
    }

    // ── 4. Construir email ───────────────────────────────────────────────────
    const diagnosedScheme  = diagnostico?.diagnosed_scheme ?? preliminaryScheme ?? session.preliminary_scheme ?? '';
    const diagnosedLabel   = SCHEMES[diagnosedScheme] ?? diagnosedScheme;
    
    // Answers fallbacks: use answers from payload if present, else fallback
    const resolvedAnswers = answers || session.answers_json || {};
    const initialIntuition = String(resolvedAnswers?.q0 ?? 'NOSE');
    const initialLabel     = initialIntuition === 'NOSE'
      ? 'No estaba seguro'
      : (SCHEMES[initialIntuition] ?? initialIntuition);
    const isMatch          = diagnosedScheme === initialIntuition;
    const companyName      = session.company_name ?? 'Sin nombre';

    const subject = `[Tamiz] Diagnóstico — ${companyName} → ${diagnosedLabel}`;
    const html    = buildHtml({
      diagId:        diagnostico?.id ?? sessionId,
      companyName,
      contactEmail:  session.contact_email,
      initialLabel,
      diagnosedLabel,
      isMatch,
      answers:       resolvedAnswers as Record<string, string | string[]>,
      normativaText: normativaText ?? (session.normativa_user_text as string | null ?? undefined),
      fileNames:     attachments.map(a => a.filename),
    });

    // ── 5. Enviar con Resend ─────────────────────────────────────────────────
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[send-diagnostic] RESEND_API_KEY no configurado');
      return json({ ok: false, error: 'RESEND_API_KEY no configurado como secret' }, 500);
    }

    const resend = new Resend(apiKey);
    const from   = Deno.env.get('RESEND_FROM') ?? 'noreply@amcprincipal.com';

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from:        `Tamiz AMC Principal <${from}>`,
      to:          [OPS_EMAIL],
      subject,
      html,
      attachments: attachments.map(a => ({
        filename:    a.filename,
        content:     a.content,
        contentType: a.contentType,
      })),
    });

    if (emailErr) {
      console.error('[send-diagnostic] Resend error:', emailErr);
      return json({ ok: false, error: emailErr.message }, 500);
    }

    // ── 6. Marcar diagnóstico como enviado ───────────────────────────────────
    if (diagnostico?.id) {
      await supabase
        .from('tamiz_diagnosticos')
        .update({
          sent_to_ops:     true,
          ops_response_id: emailData?.id ?? null,
          sent_at:         new Date().toISOString(),
        })
        .eq('id', diagnostico.id);
    }

    return json({ ok: true, messageId: emailData?.id, adjuntos: attachments.length });

  } catch (err) {
    console.error('[send-diagnostic] Error:', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

interface HtmlOpts {
  diagId:        string;
  companyName:   string;
  contactEmail:  string;
  initialLabel:  string;
  diagnosedLabel: string;
  isMatch:       boolean;
  answers:       Record<string, string | string[]>;
  normativaText?: string;
  fileNames:     string[];
}

function buildHtml(p: HtmlOpts): string {
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

  const normativaSection = p.normativaText
    ? `<div style="margin-top:18px;padding:14px 16px;background:#F5F4F0;border-radius:8px;border:1px solid #E6E3D8;">
         <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#5F5C56;text-transform:uppercase;letter-spacing:1px;">Normativa adicional</p>
         <p style="margin:0;font-size:13px;color:#18171A;line-height:1.6;">${esc(p.normativaText)}</p>
       </div>`
    : '';

  const adjuntosSection = p.fileNames.length > 0
    ? `<p style="margin:16px 0 4px;font-size:13px;color:#5F5C56;">
         <strong>Archivos adjuntos:</strong> ${p.fileNames.map(esc).join(', ')}
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Diagnóstico Tamiz</title></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.09);">
  <tr><td style="background:#4A41B2;padding:28px 36px;">
    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">AMC PRINCIPAL</p>
    <p style="margin:5px 0 0;color:#FFFFFF;font-size:22px;font-weight:800;">Diagnóstico Tamiz</p>
  </td></tr>
  <tr><td style="padding:30px 36px 20px;">
    <p style="margin:0 0 2px;color:#A09C94;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Empresa analizada</p>
    <p style="margin:0 0 22px;color:#18171A;font-size:20px;font-weight:800;">${esc(p.companyName)}</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#ECEAFB;border-radius:10px;margin-bottom:14px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 3px;color:#4A41B2;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Esquema Diagnosticado</p>
        <p style="margin:0;color:#18171A;font-size:22px;font-weight:800;">${esc(p.diagnosedLabel)}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;color:#5F5C56;font-size:13px;">Intuición inicial: <strong style="color:#18171A;">${esc(p.initialLabel)}</strong></p>
    <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${p.isMatch ? '#DCF2EA' : '#FEF3C7'};color:${matchColor};">${matchText}</span>
  </td></tr>
  <tr><td style="padding:0 36px 28px;">
    <p style="margin:0 0 10px;color:#18171A;font-size:14px;font-weight:700;">Resumen de respuestas</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6E3D8;border-radius:8px;overflow:hidden;">${answersRows}</table>
    ${normativaSection}
    ${adjuntosSection}
  </td></tr>
  <tr><td style="padding:0 36px 28px;">
    <p style="margin:0;font-size:12px;color:#A09C94;">
      ID: <code style="background:#F5F4F0;padding:2px 6px;border-radius:4px;">${esc(p.diagId)}</code><br>
      Contacto: ${esc(p.contactEmail)} · ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
    </p>
  </td></tr>
  <tr><td style="background:#F5F4F0;padding:18px 36px;border-top:1px solid #EDEAE0;">
    <p style="margin:0;color:#A09C94;font-size:11px;">Tamiz es una herramienta propietaria de AMC Principal. Uso confidencial.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
