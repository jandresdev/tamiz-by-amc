import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getDiagnosticoBySession,
  createDiagnostico,
} from '@/lib/db';
import { createClient } from '@/lib/supabase.server';
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
    const { sessionId, normativaText, preliminaryScheme: bodyScheme, answers } = body as {
      sessionId: string;
      normativaText?: string;
      preliminaryScheme?: string;
      answers?: any;
    };

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'Falta sessionId' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    // For Supabase Auth users, email is verified at login — skip token check.
    // Legacy non-auth sessions still require token verification.
    const isAuthUser = !!session.user_id;
    if (!isAuthUser && !session.email_verified) {
      return NextResponse.json({ ok: false, error: 'El correo no ha sido verificado' }, { status: 403 });
    }

    // Accept scheme from body (client state) as primary, fall back to DB value
    const resolvedScheme = (bodyScheme || session.preliminary_scheme) as RegulatoryScheme | null;

    if (!resolvedScheme) {
      return NextResponse.json({ ok: false, error: 'No se ha determinado un esquema diagnóstico' }, { status: 400 });
    }

    // ── 1. Crear o recuperar el registro de diagnóstico ─────────────────────
    let diagnostico = await getDiagnosticoBySession(sessionId);

    if (!diagnostico) {
      diagnostico = await createDiagnostico(
        sessionId,
        session.company_name ?? 'Sin nombre',
        session.contact_email,
        String(answers?.q0 ?? session.answers_json?.q0 ?? 'NOSE'),
        resolvedScheme as RegulatoryScheme,
        answers ?? session.answers_json ?? {}
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
      body: { sessionId, answers, preliminaryScheme: resolvedScheme, normativaText },
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
