import { NextRequest, NextResponse } from 'next/server';
import { getSession, setVerifyToken } from '@/lib/db';
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
        {
          ok: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Generate verification token
    const token = generateToken();

    // Save token to database
    await setVerifyToken(sessionId, token, 10); // 10 minutes expiry

    // TODO: Send email via Brevo API
    // This will be implemented in Phase 5 (Integraciones Email)
    console.log(`[TODO] Send token ${token} to ${email}`);

    // For now, return success
    // In production, actually call Brevo API
    return NextResponse.json({
      ok: true,
      message: 'Token sent successfully',
      // Debug info (remove in production)
      ...(process.env.NODE_ENV === 'development' && { token }),
    });
  } catch (error) {
    console.error('Failed to send token:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to send token',
      },
      { status: 500 }
    );
  }
}
