import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getDiagnosticoBySession,
  createDiagnostico,
} from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { RegulatoryScheme } from '@/lib/types';

const OPS_EMAIL = 'ops@amcprincipal.com';

/**
 * POST /api/send-report
 *
 * 1. Persiste el diagnóstico en tamiz_diagnosticos (Supabase DB)
 * 2. Llama a la Edge Function "send-diagnostic" que:
 *    - Descarga archivos de Supabase Storage
 *    - Envía el email a ops@amcprincipal.com via Resend
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

    // ── 2. Persistir normativa si fue enviada ────────────────────────────────
    if (normativaText) {
      const supabase = await createClient();
      await supabase
        .from('tamiz_sessions')
        .update({ normativa_user_text: normativaText, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }

    // ── 3. Marcar sesión como completada ─────────────────────────────────────
    {
      const supabase = await createClient();
      await supabase
        .from('tamiz_sessions')
        .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }

    // ── 4. Llamar Edge Function send-diagnostic (Gmail SMTP) ─────────────────
    const supabase = await createClient();
    const { data: fnData, error: fnError } = await supabase.functions.invoke('send-diagnostic', {
      body: { sessionId },
    });

    if (fnError) {
      console.error('[send-report] Edge function error:', fnError);
      // El diagnóstico ya quedó guardado en DB aunque falle el email
      return NextResponse.json({
        ok:            false,
        diagnosticoId: diagnostico.id,
        sentToOps:     false,
        message:       'Diagnóstico guardado en Supabase. Fallo el envío de email (verifica los secrets SMTP en Edge Functions).',
        error:         fnError.message,
      });
    }

    const ok       = fnData?.ok === true;
    const adjuntos = fnData?.adjuntos ?? 0;

    return NextResponse.json({
      ok,
      diagnosticoId: diagnostico.id,
      sentToOps:     ok,
      adjuntos,
      message: ok
        ? `Diagnóstico enviado a ${OPS_EMAIL}${adjuntos > 0 ? ` con ${adjuntos} archivo(s) adjunto(s)` : ''}`
        : 'Diagnóstico guardado. Error al enviar el email a ops.',
    });
  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al procesar el diagnóstico' },
      { status: 500 }
    );
  }
}
