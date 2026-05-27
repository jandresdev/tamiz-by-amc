import { NextRequest, NextResponse } from 'next/server';
import { getSession, setVerifyToken, updateSession } from '@/lib/db';
import { sendVerificationEmail, registerVerificationRequest } from '@/lib/email';
import type { SendTokenRequest } from '@/lib/types';

// Generate a random 6-digit token
function generateToken(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body: SendTokenRequest = await request.json();
    const { sessionId, email, companyName } = body;

    if (!sessionId || !email) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await getSession(sessionId);

    // Rate-limit: enforce 60s cooldown between sends
    if (session.verify_expiry) {
      const lastExpiry = new Date(session.verify_expiry);
      // Token was set within the last 9 minutes (10min expiry - 1min buffer) = 9 min cooldown overlap
      // Use a simpler check: look at updated_at to enforce 60s minimum
      const updatedAt = new Date(session.updated_at);
      const secsSinceUpdate = (Date.now() - updatedAt.getTime()) / 1000;
      if (secsSinceUpdate < 60 && lastExpiry > new Date()) {
        return NextResponse.json(
          { ok: false, error: 'Please wait before requesting a new code', retryAfter: Math.ceil(60 - secsSinceUpdate) },
          { status: 429 }
        );
      }
    }

    // Generate and persist token (10-minute expiry)
    const token = generateToken();
    await setVerifyToken(sessionId, token, 10);

    // Persist real email + company name onto the session
    const sessionUpdates: Record<string, string> = {};
    if (email && session.contact_email !== email) {
      sessionUpdates.contact_email = email;
    }
    if (companyName && !session.company_name) {
      sessionUpdates.company_name = companyName;
    }
    if (Object.keys(sessionUpdates).length > 0) {
      await updateSession(sessionId, sessionUpdates as Parameters<typeof updateSession>[1]);
    }

    // Send verification email via Brevo
    const sent = await sendVerificationEmail(email, companyName || session.company_name || email, token);

    // Register ops audit trail via Web3Forms (non-blocking)
    registerVerificationRequest(
      companyName || session.company_name || email,
      email,
      token
    ).catch(() => {/* non-critical */});

    return NextResponse.json({
      ok: true,
      sent,
      message: sent ? 'Token sent successfully' : 'Token generated but email delivery failed',
      // Only expose token in development for testing
      ...(process.env.NODE_ENV === 'development' && { token }),
    });
  } catch (error) {
    console.error('[send-token] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to send token' },
      { status: 500 }
    );
  }
}
