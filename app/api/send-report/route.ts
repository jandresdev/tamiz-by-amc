import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getSessionFiles,
  getDiagnosticoBySession,
  createDiagnostico,
  markDiagnosticoSent,
} from '@/lib/db';
import { createClient } from '@/lib/supabase';
import { sendDiagnosticReport } from '@/lib/email';
import { SCHEMES } from '@/lib/constants';
import type { RegulatoryScheme, DiagnosticAttachment } from '@/lib/types';

/**
 * POST /api/send-report
 *
 * 1. Persiste el diagnóstico en tamiz_diagnosticos (Supabase DB)
 * 2. Descarga archivos adjuntos de Supabase Storage
 * 3. Envía todo a ops@amcprincipal.com con adjuntos (Resend)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, normativaText } = body as { sessionId: string; normativaText?: string };

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Falta sessionId' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    if (!session.email_verified) {
      return NextResponse.json({ ok: false, error: 'El correo no ha sido verificado' }, { status: 403 });
    }

    if (!session.preliminary_scheme) {
      return NextResponse.json({ ok: false, error: 'No se ha determinado un esquema diagnóstico' }, { status: 400 });
    }

    // ── 1. Crear o recuperar el registro de diagnóstico ─────────────────────
    let diagnostico = await getDiagnosticoBySession(sessionId);

    if (!diagnostico) {
      diagnostico = await createDiagnostico(
        sessionId,
        session.company_name ?? 'Sin nombre',
        session.contact_email,
        String(session.answers_json?.q0 ?? 'NOSE'),
        session.preliminary_scheme as RegulatoryScheme,
        session.answers_json ?? {}
      );
    }

    // Persistir normativa si fue enviada
    if (normativaText) {
      const supabase = await createClient();
      await supabase
        .from('tamiz_sessions')
        .update({ normativa_user_text: normativaText, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }

    // ── 2. Descargar archivos adjuntos de Supabase Storage ──────────────────
    const attachments: DiagnosticAttachment[] = [];
    const fileRecords = await getSessionFiles(sessionId);

    if (fileRecords.length > 0) {
      const supabase = await createClient();

      for (const record of fileRecords) {
        try {
          const { data: blob, error } = await supabase.storage
            .from('tamiz-files')
            .download(record.supabase_path);

          if (error || !blob) {
            console.warn(`[send-report] No se pudo descargar ${record.file_name}:`, error?.message);
            continue;
          }

          const arrayBuffer = await blob.arrayBuffer();
          attachments.push({
            filename:    record.file_name,
            content:     Buffer.from(arrayBuffer),
            contentType: record.file_type,
          });
        } catch (e) {
          console.warn(`[send-report] Error al descargar ${record.file_name}:`, e);
        }
      }
    }

    // ── 3. Enviar email a ops con adjuntos (Resend) ─────────────────────────
    const diagnosedScheme = session.preliminary_scheme as RegulatoryScheme;
    const initialIntuition = String(session.answers_json?.q0 ?? 'NOSE');
    const diagnosedSchemeLabel  = SCHEMES[diagnosedScheme]?.label  ?? diagnosedScheme;
    const initialIntuitionLabel = initialIntuition === 'NOSE'
      ? 'No estaba seguro'
      : (SCHEMES[initialIntuition as RegulatoryScheme]?.label ?? initialIntuition);

    const { ok, opsResponseId } = await sendDiagnosticReport({
      diagnosticoId:       diagnostico.id,
      companyName:         session.company_name ?? 'Sin nombre',
      contactEmail:        session.contact_email,
      initialIntuition,
      diagnosedScheme,
      diagnosedSchemeLabel,
      initialIntuitionLabel,
      isMatch:             diagnosedScheme === initialIntuition,
      answers:             (session.answers_json as Record<string, string | string[]>) ?? {},
      normativaText:       normativaText ?? session.normativa_user_text ?? undefined,
      attachments,
    });

    // ── 4. Marcar diagnóstico como enviado ───────────────────────────────────
    await markDiagnosticoSent(
      diagnostico.id,
      ok,
      false,
      opsResponseId,
      undefined
    );

    return NextResponse.json({
      ok,
      diagnosticoId: diagnostico.id,
      sentToOps:     ok,
      adjuntos:      attachments.length,
      message:       ok
        ? `Diagnóstico enviado a ops@amcprincipal.com${attachments.length > 0 ? ` con ${attachments.length} archivo(s) adjunto(s)` : ''}`
        : 'Error al enviar el email. El diagnóstico quedó guardado en Supabase.',
    });
  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al procesar el diagnóstico' },
      { status: 500 }
    );
  }
}
