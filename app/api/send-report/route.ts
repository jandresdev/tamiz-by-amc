import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getDiagnosticoBySession,
  createDiagnostico,
} from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { RegulatoryScheme } from '@/lib/types';

/**
 * POST /api/send-report
 *
 * Persiste el diagnóstico completo en tamiz_diagnosticos (Supabase DB).
 * El equipo de ops puede ver todos los diagnósticos en el Dashboard de Supabase
 * o en la tabla tamiz_diagnosticos del proyecto.
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
    const supabase = await createClient();
    await supabase
      .from('tamiz_sessions')
      .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return NextResponse.json({
      ok:            true,
      diagnosticoId: diagnostico.id,
      message:       'Diagnóstico guardado en Supabase correctamente.',
    });
  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al procesar el diagnóstico' },
      { status: 500 }
    );
  }
}
