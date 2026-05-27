import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Create a new session with a temporary email
    // The email will be set in the first step (qName)
    const tempEmail = `temp-${Date.now()}@example.com`;

    const session = await createSession(tempEmail);

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      redirectTo: '/questionnaire/qName',
    });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to create session',
      },
      { status: 500 }
    );
  }
}
