import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getDiagnosticoBySession,
  createDiagnostico,
  markDiagnosticoSent,
} from '@/lib/db';
import type { RegulatoryScheme } from '@/lib/types';

/**
 * POST /api/send-report
 *
 * Persiste el diagnóstico completo en tamiz_diagnosticos (Supabase).
 * No usa servicios externos — ops consulta en el dashboard de Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, normativaText } = body as { sessionId: string; normativaText?: string };

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Falta sessionId' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    if (!session.email_verified) {
      return NextResponse.json(
        { ok: false, error: 'El correo no ha sido verificado' },
        { status: 403 }
      );
    }

    if (!session.preliminary_scheme) {
      return NextResponse.json(
        { ok: false, error: 'No se ha determinado un esquema diagnóstico' },
        { status: 400 }
      );
    }

    // Crear o recuperar el registro en tamiz_diagnosticos
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
      const { createClient } = await import('@/lib/supabase');
      const supabase = await createClient();
      await supabase
        .from('tamiz_sessions')
        .update({ normativa_user_text: normativaText, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    }

    // Marcar como enviado (guardado en DB = enviado a ops)
    await markDiagnosticoSent(
      diagnostico.id,
      true,   // sent_to_ops = true (ops lo ve en Supabase Dashboard)
      false,  // sent_to_user = false (no se envía email al usuario)
      `supabase:${diagnostico.id}`, // opsResponseId = referencia interna
      undefined
    );

    return NextResponse.json({
      ok: true,
      diagnosticoId: diagnostico.id,
      sentToOps: true,
      sentToUser: false,
      message: 'Diagnóstico guardado en Supabase correctamente',
    });
  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al guardar el diagnóstico' },
      { status: 500 }
    );
  }
}
