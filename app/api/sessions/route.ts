import { NextRequest, NextResponse } from 'next/server';
import { createSession, updateSession } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    let email: string | undefined;
    let companyName: string | undefined;
    let userId: string | undefined;

    try {
      const body = await request.json();
      email = body.email;
      companyName = body.companyName;
      userId = body.userId;
    } catch {
      // Body may be empty — fall back to temp email
    }

    const sessionEmail = email || `pending-${Date.now()}@tamiz.local`;
    const session = await createSession(sessionEmail, companyName);

    const updates: Record<string, unknown> = {};
    if (userId)      updates.user_id      = userId;
    if (userId)      updates.user_id      = userId;

    if (Object.keys(updates).length > 0) {
      await updateSession(session.id, updates as Parameters<typeof updateSession>[1]);
    }

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (error) {
    console.error('[sessions] Failed to create session:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
