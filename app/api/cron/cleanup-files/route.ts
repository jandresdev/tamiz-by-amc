import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredFiles } from '@/lib/db';

/**
 * GET /api/cron/cleanup-files
 *
 * Triggered by Vercel Cron (see vercel.json). Deletes tamiz_files rows
 * (and their Storage objects) past their expires_at date.
 * Authenticated via CRON_SECRET — Vercel Cron sends it as a Bearer token.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const deletedCount = await cleanupExpiredFiles();
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    console.error('[cron/cleanup-files] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
