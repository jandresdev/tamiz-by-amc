import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import type { SendTokenRequest } from '@/lib/types';

const OTP_TTL_MINUTES  = 10;
const COOLDOWN_SECONDS = 60;

/**
 * POST /api/send-token
 *
 * Genera OTP de 6 dígitos, lo guarda en DB y llama a la
 * Edge Function "send-otp" que lo envía al usuario via Resend.
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
    if (session.verify_expiry && session.verify_token) {
      const secsSince  = (Date.now() - new Date(session.updated_at).getTime()) / 1000;
      const stillValid = new Date(session.verify_expiry) > new Date();
      if (secsSince < COOLDOWN_SECONDS && stillValid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Espera antes de solicitar un nuevo código',
            retryAfter: Math.ceil(COOLDOWN_SECONDS - secsSince),
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

    // ── Generar OTP de 6 dígitos y guardarlo en DB ───────────────────────────
    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + OTP_TTL_MINUTES);

    await updateSession(sessionId, {
      verify_token:    otp,
      verify_expiry:   expiry.toISOString(),
      verify_attempts: 0,
    } as Parameters<typeof updateSession>[1]);

    // ── Llamar Edge Function send-otp (Resend) ───────────────────────────────
    const supabase = await createClient();
    const { error: fnError } = await supabase.functions.invoke('send-otp', {
      body: { email, token: otp, companyName: companyName ?? session.company_name ?? '' },
    });

    if (fnError) {
      console.error('[send-token] Edge function error:', fnError.message);
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el código. Intenta de nuevo.' },
        { status: 500 }
      );
    }

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
