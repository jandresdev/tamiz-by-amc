import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { VerifyEmailRequest } from '@/lib/types';

const MAX_ATTEMPTS = 5;

/**
 * POST /api/verify-email
 *
 * Usa Supabase Auth verifyOtp para validar el código de 6 dígitos.
 * Supabase compara el código contra el que envió por email.
 */
export async function POST(request: NextRequest) {
  try {
    const body: VerifyEmailRequest = await request.json();
    const { sessionId, token } = body;

    if (!sessionId || !token) {
      return NextResponse.json(
        { ok: false, error: 'Faltan campos requeridos (sessionId, token)' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    // ── Cap de intentos locales ──────────────────────────────────────────────
    if ((session.verify_attempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 429 }
      );
    }

    // ── Supabase Auth verifyOtp (nativo) ─────────────────────────────────────
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: session.contact_email,
      token: token.trim().replace(/\s/g, ''),
      type:  'email',
    });

    if (verifyError) {
      await updateSession(sessionId, {
        verify_attempts: (session.verify_attempts ?? 0) + 1,
      } as Parameters<typeof updateSession>[1]);

      const remaining = MAX_ATTEMPTS - ((session.verify_attempts ?? 0) + 1);
      return NextResponse.json(
        {
          ok:       false,
          verified: false,
          error:    remaining > 0
            ? `Código incorrecto o expirado. Te quedan ${remaining} intento(s).`
            : 'Demasiados intentos. Solicita un nuevo código.',
        },
        { status: 400 }
      );
    }

    // ── Marcar sesión como verificada ────────────────────────────────────────
    await updateSession(sessionId, {
      email_verified:  true,
      verify_token:    null,
      verify_expiry:   null,
      verify_attempts: 0,
    } as Parameters<typeof updateSession>[1]);

    return NextResponse.json({
      ok:       true,
      verified: true,
      message:  'Correo verificado correctamente',
    });
  } catch (error) {
    console.error('[verify-email] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al verificar el código' },
      { status: 500 }
    );
  }
}
