import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import type { VerifyEmailRequest } from '@/lib/types';

const MAX_ATTEMPTS = 5;

/**
 * POST /api/verify-email
 *
 * Compara el código enviado contra verify_token en tamiz_sessions.
 * Sin dependencia de Supabase Auth — verificación 100% en DB propia.
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

    // ── Cap de intentos ──────────────────────────────────────────────────────
    if ((session.verify_attempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 429 }
      );
    }

    // ── Verificar que existe un token guardado ───────────────────────────────
    if (!session.verify_token || !session.verify_expiry) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'No hay código activo. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    // ── Verificar expiración ─────────────────────────────────────────────────
    if (new Date() > new Date(session.verify_expiry)) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'El código ha expirado. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    // ── Comparar código ──────────────────────────────────────────────────────
    const inputToken = token.trim().replace(/\s/g, '');
    if (session.verify_token !== inputToken) {
      // Incrementar intentos fallidos
      await updateSession(sessionId, {
        verify_attempts: (session.verify_attempts ?? 0) + 1,
      } as Parameters<typeof updateSession>[1]);

      const remaining = MAX_ATTEMPTS - ((session.verify_attempts ?? 0) + 1);
      return NextResponse.json(
        {
          ok:       false,
          verified: false,
          error:    remaining > 0
            ? `Código incorrecto. Te quedan ${remaining} intento(s).`
            : 'Demasiados intentos. Solicita un nuevo código.',
        },
        { status: 400 }
      );
    }

    // ── Código correcto — marcar como verificado ─────────────────────────────
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
