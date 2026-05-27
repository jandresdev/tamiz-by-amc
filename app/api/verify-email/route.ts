import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/db';
import type { VerifyEmailRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: VerifyEmailRequest = await request.json();
    const { sessionId, token } = body;

    if (!sessionId || !token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Verify the token
    const isValid = await verifyEmailToken(sessionId, token);

    if (!isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid or expired token',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Failed to verify email:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to verify email',
      },
      { status: 500 }
    );
  }
}
