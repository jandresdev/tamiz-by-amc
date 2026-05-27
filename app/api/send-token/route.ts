import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { SendTokenRequest } from '@/lib/types';

/**
 * POST /api/send-token
 *
 * Usa Supabase Auth signInWithOtp para enviar el código de 6 dígitos.
 * El email lo envía Supabase con su infraestructura nativa.
 * Template: Supabase Dashboard → Auth → Email Templates → "Magic Link"
 */
export async function POST(request: NextRequest) {
  try {
    const body: SendTokenRequest = await request.json();
    const { sessionId, email, companyName } = body;

    if (!sessionId || !email) {
      return NextResponse.json(
        { ok: false, error: 'Faltan campos requeridos (sessionId, email)' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    // ── Rate-limit: 60 s entre envíos ───────────────────────────────────────
    if (session.verify_expiry) {
      const secsSince  = (Date.now() - new Date(session.updated_at).getTime()) / 1000;
      const stillValid = new Date(session.verify_expiry) > new Date();
      if (secsSince < 60 && stillValid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Espera antes de solicitar un nuevo código',
            retryAfter: Math.ceil(60 - secsSince),
          },
          { status: 429 }
        );
      }
    }

    // ── Actualizar email / empresa si cambiaron ──────────────────────────────
    const updates: Record<string, string> = {};
    if (session.contact_email !== email) updates.contact_email = email;
    if (companyName && !session.company_name) updates.company_name = companyName;
    if (Object.keys(updates).length > 0) {
      await updateSession(sessionId, updates as Parameters<typeof updateSession>[1]);
    }

    // ── Supabase Auth OTP (nativo, sin SMTP propio) ──────────────────────────
    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (otpError) {
      console.error('[send-token] Supabase OTP error:', otpError.message);
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el código. Verifica que el correo sea válido.' },
        { status: 500 }
      );
    }

    // Marcar que se envió un código (para rate-limit; Supabase gestiona el TTL real)
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);
    await updateSession(sessionId, {
      verify_expiry:   expiry.toISOString(),
      verify_token:    null,
      verify_attempts: 0,
    } as Parameters<typeof updateSession>[1]);

    return NextResponse.json({
      ok:      true,
      sent:    true,
      message: 'Código enviado. Revisa tu bandeja de entrada.',
    });
  } catch (error) {
    console.error('[send-token] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
