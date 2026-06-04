import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase.server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from('tamiz_app_config')
      .select('*')
      .order('key');
    if (error) throw error;
    return NextResponse.json({ ok: true, config: data });
  } catch (error) {
    console.error('[admin/config GET]', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isSuperAdmin(user.id))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const body = await request.json();
    const { key, value } = body as { key: string; value: string };
    if (!key || value === undefined) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros' }, { status: 400 });
    }
    const service = createServiceRoleClient();
    const { error } = await service
      .from('tamiz_app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/config PATCH]', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
