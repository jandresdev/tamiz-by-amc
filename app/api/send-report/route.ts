import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  getDiagnosticoBySession,
  createDiagnostico,
  markDiagnosticoSent,
} from '@/lib/db';
import { sendDiagnosticReport } from '@/lib/email';
import { SCHEMES } from '@/lib/constants';
import type { SendReportRequest, RegulatoryScheme } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: SendReportRequest = await request.json();
    const { sessionId, normativaText } = body as SendReportRequest & { normativaText?: string };

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Get session data
    const session = await getSession(sessionId);

    if (!session.email_verified) {
      return NextResponse.json(
        { ok: false, error: 'Email not verified' },
        { status: 403 }
      );
    }

    if (!session.preliminary_scheme) {
      return NextResponse.json(
        { ok: false, error: 'No diagnostic scheme determined' },
        { status: 400 }
      );
    }

    // Get or create diagnostico record
    let diagnostico = await getDiagnosticoBySession(sessionId);

    if (!diagnostico) {
      diagnostico = await createDiagnostico(
        sessionId,
        session.company_name || 'Unknown',
        session.contact_email,
        String(session.answers_json?.q0 || 'NOSE'),
        session.preliminary_scheme as RegulatoryScheme,
        session.answers_json || {}
      );
    }

    // Build scheme labels for emails
    const diagnosedScheme = session.preliminary_scheme as RegulatoryScheme;
    const initialIntuition = String(session.answers_json?.q0 || 'NOSE') as RegulatoryScheme | 'NOSE';

    const diagnosedSchemeLabel =
      SCHEMES[diagnosedScheme]?.label || diagnosedScheme;
    const initialIntuitionLabel =
      initialIntuition === 'NOSE'
        ? 'No estoy seguro'
        : SCHEMES[initialIntuition as RegulatoryScheme]?.label || initialIntuition;

    const isMatch = diagnosedScheme === initialIntuition;

    // Send report via Brevo (user) and Web3Forms (ops)
    const { ok, opsResponseId, userResponseId } = await sendDiagnosticReport({
      diagnosticoId: diagnostico.id,
      companyName: session.company_name || 'Unknown',
      contactEmail: session.contact_email,
      initialIntuition,
      diagnosedScheme,
      diagnosedSchemeLabel,
      initialIntuitionLabel,
      isMatch,
      answers: (session.answers_json as Record<string, string | string[]>) || {},
      normativaText: normativaText || session.normativa_user_text || undefined,
    });

    // Mark diagnostico as sent
    await markDiagnosticoSent(diagnostico.id, !!opsResponseId, !!userResponseId, opsResponseId, userResponseId);

    return NextResponse.json({
      ok,
      diagnosticoId: diagnostico.id,
      sentToOps: !!opsResponseId,
      sentToUser: !!userResponseId,
      message: ok ? 'Report sent successfully' : 'Report partially sent',
    });
  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to send report' },
      { status: 500 }
    );
  }
}
