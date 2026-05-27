import { NextRequest, NextResponse } from 'next/server';
import { createSession, updateSession } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Accept optional email/companyName in the body
    let email: string | undefined;
    let companyName: string | undefined;

    try {
      const body = await request.json();
      email = body.email;
      companyName = body.companyName;
    } catch {
      // Body may be empty — that's fine, we fall back to temp email
    }

    // Create session — use real email if provided, otherwise placeholder
    const sessionEmail = email || `pending-${Date.now()}@tamiz.local`;
    const session = await createSession(sessionEmail);

    // Persist company name immediately if provided
    if (companyName) {
      await updateSession(session.id, { company_name: companyName });
    }

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[sessions] Failed to create session:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
