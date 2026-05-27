import { NextRequest, NextResponse } from 'next/server';
import { updateSessionAnswer, moveToStep, updateActiveSchemes } from '@/lib/db';
import type { SaveAnswerRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: SaveAnswerRequest = await request.json();
    const { sessionId, step, answer, activeSchemes, nextStep } = body;

    if (!sessionId || !step || answer === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Save the answer
    await updateSessionAnswer(sessionId, step, answer);

    // Update active schemes if provided
    if (activeSchemes && activeSchemes.length > 0) {
      await updateActiveSchemes(sessionId, activeSchemes);
    }

    // Move to next step
    if (nextStep) {
      await moveToStep(sessionId, nextStep);
    }

    return NextResponse.json({
      ok: true,
      nextStep,
    });
  } catch (error) {
    console.error('Failed to save answer:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to save answer',
      },
      { status: 500 }
    );
  }
}
