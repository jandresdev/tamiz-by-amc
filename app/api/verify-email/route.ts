import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { VerifyEmailRequest } from '@/lib/types';

const MAX_ATTEMPTS = 5;

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

    // Safety cap on local attempts (Supabase also enforces its own limits)
    if ((session.verify_attempts || 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 429 }
      );
    }

    // ── Supabase Auth OTP verification ───────────────────────────────────────
    // Supabase checks the 6-digit code against what it sent via email.
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: session.contact_email,
      token: token.trim(),
      type: 'email',
    });

    if (verifyError) {
      // Increment local attempt counter
      await updateSession(sessionId, {
        verify_attempts: (session.verify_attempts || 0) + 1,
      } as Parameters<typeof updateSession>[1]);

      return NextResponse.json(
        { ok: false, verified: false, error: 'Código incorrecto o expirado. Intenta de nuevo.' },
        { status: 400 }
      );
    }

    // Mark email as verified in our tamiz_sessions table
    await updateSession(sessionId, {
      email_verified: true,
      verify_token:    null,
      verify_expiry:   null,
      verify_attempts: 0,
    } as Parameters<typeof updateSession>[1]);

    return NextResponse.json({
      ok: true,
      verified: true,
      message: 'Correo verificado correctamente',
    });
  } catch (error) {
    console.error('[verify-email] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al verificar el código' },
      { status: 500 }
    );
  }
}
