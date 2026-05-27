import { NextRequest, NextResponse } from 'next/server';
import { getSession, getDiagnosticoBySession, createDiagnostico } from '@/lib/db';
import type { SendReportRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: SendReportRequest = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing sessionId',
        },
        { status: 400 }
      );
    }

    // Get session data
    const session = await getSession(sessionId);

    // Check if diagnostico already exists
    let diagnostico = await getDiagnosticoBySession(sessionId);

    if (!diagnostico) {
      // Create new diagnostico
      if (!session.preliminary_scheme) {
        return NextResponse.json(
          {
            ok: false,
            error: 'No diagnostic scheme determined',
          },
          { status: 400 }
        );
      }

      diagnostico = await createDiagnostico(
        sessionId,
        session.company_name || 'Unknown',
        session.contact_email,
        session.answers_json?.q0 || 'Not specified',
        session.preliminary_scheme,
        session.answers_json || {}
      );
    }

    // TODO: Send to ops via Web3Forms
    // TODO: Send to user via Brevo
    // This will be implemented in Phase 5 (Integraciones Email)
    console.log(`[TODO] Send report for ${diagnostico.id}`);

    return NextResponse.json({
      ok: true,
      message: 'Report sent successfully',
      diagnosticoId: diagnostico.id,
      sentToOps: false, // Will be true after Phase 5
      sentToUser: false, // Will be true after Phase 5
    });
  } catch (error) {
    console.error('Failed to send report:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to send report',
      },
      { status: 500 }
    );
  }
}
