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
  const QUESTION_LABELS: Record<string, string> = {
    q1:  '¿Produce o compra?',
    qA1: '¿Vendedor vinculado económico?',
    qA2: '¿Vendedor es ESP?',
    qA3: '¿Único consumidor?',
    qB1: 'Naturaleza de la Frontera',
    qB2: 'Vinculación del usuario de la Frontera',
  };

  const ANSWER_LABELS: Record<string, Record<string, string>> = {
    q1:  { produce: 'Produce la energía', compra: 'Compra la energía' },
    qA1: { si: 'Sí — vinculado económico', no: 'No — no es vinculado económico' },
    qA2: { si: 'Sí — Empresa de Servicios Públicos', no: 'No — no es ESP' },
    qA3: { si: 'Sí — único consumidor', no: 'No — hay más consumidores' },
    qB1: { propia: 'Frontera propia / EC en RUT, registrada ante XM', tercero: 'Frontera/registro a nombre de un tercero' },
    qB2: { vinc: 'Usuario con vinculación económica', sinvinc: 'Sin vinculación económica', varios: 'Frontera atiende varios usuarios' },
  };

  const isSinsop = p.diagnosedLabel === 'Sin soporte regulatorio';
  
  let tone = 'stop';
  if (p.diagnosedLabel && !isSinsop) tone = 'match';
  else if (isSinsop) tone = 'no-match';

  let toneLabel = tone === 'match' ? 'ESQUEMA IDENTIFICADO' : tone === 'no-match' ? 'CALIFICACIÓN' : 'ANÁLISIS DETENIDO';
  let titleColor = '#78350f'; 
  let borderColor = '#fcd34d'; 
  
  if (tone === 'match') {
      titleColor = '#065f46';
      borderColor = '#6ee7b7';
  } else if (tone === 'no-match') {
      titleColor = '#78350f';
      borderColor = '#fbbf24';
  } else {
      titleColor = '#7f1d1d';
      borderColor = '#fca5a5';
  }

  let descHtml = '';
  if (isSinsop) {
     descHtml = `<p style="margin: 8px 0 0; color: #18171A; font-size: 13px; line-height: 1.5;">La combinación de respuestas excluye los esquemas de Autogeneración Remota, Producción Marginal Remota y Suministro de Energía. Se recomienda revisar la estructura de la operación con el equipo de AMC Principal antes de avanzar.</p>`;
  } else if (!p.diagnosedLabel) {
     descHtml = `<p style="margin: 8px 0 0; color: #18171A; font-size: 13px; line-height: 1.5;">Conforme a las reglas del clasificador, cuando la empresa evaluada es el único consumidor de la energía comprada el análisis se detiene en este punto. Se recomienda revisar la operación caso a caso con el equipo de AMC Principal antes de calificar el esquema.</p>`;
  }

  const answerKeys = ['q1', 'qA1', 'qA2', 'qA3', 'qB1', 'qB2'];
  const summaryRowsHtml = answerKeys.map(k => {
     const v = p.answers[k];
     if (!v) return '';
     
     const qLabel = QUESTION_LABELS[k] || k;
     let aLabel = String(Array.isArray(v) ? v.join(', ') : v);
     if (typeof v === 'string' && ANSWER_LABELS[k] && ANSWER_LABELS[k][v]) {
        aLabel = ANSWER_LABELS[k][v];
     } else if (Array.isArray(v)) {
        aLabel = v.map(val => (ANSWER_LABELS[k] && ANSWER_LABELS[k][val]) ? ANSWER_LABELS[k][val] : val).join(', ');
     }

     return `
      <tr>
        <td style="padding:12px 0;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;width:40%;">${esc(qLabel)}</td>
        <td style="padding:12px 0;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:700;text-align:right;">${esc(aLabel)}</td>
      </tr>`;
  }).join('');

  const matchColor = p.isMatch ? '#15926A' : '#D97706';
  const matchBgColor = p.isMatch ? '#DCF2EA' : '#FEF3C7';
  const matchText  = p.isMatch ? 'Su intuición inicial coincide con el diagnóstico.' : 'Su intuición inicial difiere del diagnóstico. Esta diferencia conviene revisarla con el equipo de AMC Principal.';

  const fileHtml = p.fileNames.map(f => `
      <tr>
        <td style="padding:12px 0;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;width:40%;">Documento adjunto</td>
        <td style="padding:12px 0;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:700;text-align:right;">📎 ${esc(f)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Diagnóstico Tamiz</title></head>
<body style="margin:0;padding:20px;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width: 600px; margin: 0 auto;">
  
  <!-- Bloque 1: Calificación -->
  <div style="background: #FFFFFF; border: 1px solid ${borderColor}; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
    <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: ${titleColor}; text-transform: uppercase; letter-spacing: 1px;">${esc(toneLabel)}</p>
    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: ${titleColor};">${esc(p.diagnosedLabel || 'Análisis pausado')}</h2>
    ${descHtml}
  </div>

  <!-- Bloque 2: Intuición vs Diagnóstico -->
  <div style="background: #FFFFFF; border: 1px solid #E6E3D8; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
    <p style="margin: 0 0 16px; font-size: 11px; font-weight: 700; color: #5F5C56; text-transform: uppercase; letter-spacing: 1px;">SU INTUICIÓN VS. EL DIAGNÓSTICO</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
      <tr>
        <td width="48%" valign="top" style="border: 1px solid #E6E3D8; border-radius: 6px; padding: 12px 16px;">
          <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #5F5C56; text-transform: uppercase;">Esquema que usted indicó</p>
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #18171A;">${esc(p.initialLabel)}</p>
        </td>
        <td width="4%"></td>
        <td width="48%" valign="top" style="border: 1px solid #E6E3D8; border-radius: 6px; padding: 12px 16px;">
          <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #5F5C56; text-transform: uppercase;">Esquema diagnosticado</p>
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #18171A;">${esc(p.diagnosedLabel || 'Análisis pausado')}</p>
        </td>
      </tr>
    </table>

    <div style="background: ${matchBgColor}; border: 1px solid ${matchColor}40; border-radius: 6px; padding: 12px 16px;">
      <p style="margin: 0; font-size: 13px; color: ${matchColor}; font-weight: 500;">${esc(matchText)}</p>
    </div>
  </div>

  <!-- Bloque 3: Resumen del diagnóstico -->
  <div style="background: #FFFFFF; border: 1px solid #E6E3D8; border-radius: 8px; padding: 24px;">
    <p style="margin: 0 0 16px; font-size: 11px; font-weight: 700; color: #5F5C56; text-transform: uppercase; letter-spacing: 1px;">RESUMEN DEL DIAGNÓSTICO</p>
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:12px 0;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;width:40%;">Empresa evaluada</td>
        <td style="padding:12px 0;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:700;text-align:right;">${esc(p.companyName)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:#5F5C56;font-size:13px;border-bottom:1px solid #F0EDE8;width:40%;">Correo de contacto</td>
        <td style="padding:12px 0;color:#18171A;font-size:13px;border-bottom:1px solid #F0EDE8;font-weight:700;text-align:right;">${esc(p.contactEmail)}</td>
      </tr>
      ${summaryRowsHtml}
      ${fileHtml}
    </table>
  </div>

</div>
</body></html>`;
}
