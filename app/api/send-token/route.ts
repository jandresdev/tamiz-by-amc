import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { SendTokenRequest } from '@/lib/types';

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

    // Rate-limit: enforce 60s cooldown between sends
    if (session.verify_expiry) {
      const updatedAt  = new Date(session.updated_at);
      const lastExpiry = new Date(session.verify_expiry);
      const secsSince  = (Date.now() - updatedAt.getTime()) / 1000;
      if (secsSince < 60 && lastExpiry > new Date()) {
        return NextResponse.json(
          { ok: false, error: 'Espera antes de solicitar un nuevo código', retryAfter: Math.ceil(60 - secsSince) },
          { status: 429 }
        );
      }
    }

    // Update session with real email/company if they changed
    const updates: Record<string, string> = {};
    if (email && session.contact_email !== email) updates.contact_email = email;
    if (companyName && !session.company_name) updates.company_name = companyName;
    if (Object.keys(updates).length > 0) {
      await updateSession(sessionId, updates as Parameters<typeof updateSession>[1]);
    }

    // ── Supabase Auth OTP ────────────────────────────────────────────────────
    // Supabase sends a 6-digit code to the user's email.
    // Configure the email template in: Supabase dashboard → Auth → Email Templates.
    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // create Supabase auth user if first time
      },
    });

    if (otpError) {
      console.error('[send-token] Supabase OTP error:', otpError.message);
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el código. Verifica que el correo sea válido.' },
        { status: 500 }
      );
    }

    // Track that a code was sent (rate-limit; Supabase manages the real expiry)
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 60); // Supabase OTP default TTL = 1 h
    await updateSession(sessionId, {
      verify_expiry: expiry.toISOString(),
      verify_token: null,      // token is managed by Supabase, not stored locally
      verify_attempts: 0,
    } as Parameters<typeof updateSession>[1]);

    return NextResponse.json({
      ok: true,
      sent: true,
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
