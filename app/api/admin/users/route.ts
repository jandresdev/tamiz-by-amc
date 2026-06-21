import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient, createServiceRoleClient } from '@/lib/supabase.server';
import { isSuperAdmin, getCurrentUser } from '@/lib/auth';

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'ops@amcprincipal.com';

// Used only as a fallback when Supabase's invite email is rate-limited —
// generates a unique, unguessable temporary password per user instead of a
// shared static one.
function generateTempPassword(): string {
  return `Tz${randomBytes(9).toString('base64url')}!`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard helper
// ─────────────────────────────────────────────────────────────────────────────
async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const ok = await isSuperAdmin(user.id);
  return ok ? user : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// Returns a unified list: pending/rejected requests + approved profiles
// Query params: ?filter=pending|approved|rejected|online|all
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const filter = request.nextUrl.searchParams.get('filter') ?? 'all';
    const service = createServiceRoleClient();

    // ── 1. Access requests (pending / rejected) ────────────────────────────
    const { data: requests, error: reqErr } = await service
      .from('tamiz_access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (reqErr) throw reqErr;

    // ── 2. Approved user profiles ──────────────────────────────────────────
    const { data: profiles, error: profErr } = await service
      .from('tamiz_user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profErr) throw profErr;

    // ── 3. Currently online: sessions active in last 30 min ───────────────
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: activeSessions } = await service
      .from('tamiz_sessions')
      .select('user_id, last_activity')
      .gte('last_activity', thirtyMinAgo)
      .not('user_id', 'is', null);

    const onlineUserIds = new Set(
      (activeSessions ?? []).map((s: { user_id: string }) => s.user_id)
    );

    // ── 4. Merge into a unified list ──────────────────────────────────────
    const allUsers = [
      // Profiles (approved users with auth accounts)
      ...(profiles ?? []).map((p: Record<string, unknown>) => ({
        id:           p.id as string,
        source:       'profile' as const,
        contact_name: p.contact_name as string,
        company_name: p.company_name as string,
        contact_email:p.contact_email as string,
        access_reason:p.access_reason as string | null,
        status:       p.status as string,
        role:         p.role as string,
        approved_by:  p.approved_by as string | null,
        approved_at:  p.approved_at as string | null,
        rejected_reason: p.rejected_reason as string | null,
        last_seen:    p.last_seen as string | null,
        created_at:   p.created_at as string,
        is_online:    onlineUserIds.has(p.id as string),
      })),
      // Pending / rejected requests (no auth account yet)
      ...(requests ?? [])
        .filter((r: Record<string, unknown>) => r.status !== 'approved') // exclude already invited ones
        .map((r: Record<string, unknown>) => ({
          id:           r.id as string,
          source:       'request' as const,
          contact_name: r.contact_name as string,
          company_name: r.company_name as string,
          contact_email:r.contact_email as string,
          access_reason:r.access_reason as string | null,
          status:       r.status as string,
          role:         'user',
          approved_by:  null,
          approved_at:  r.invited_at as string | null,
          rejected_reason: r.rejected_reason as string | null,
          last_seen:    null,
          created_at:   r.created_at as string,
          is_online:    false,
        })),
    ];

    // ── 5. Apply filter ────────────────────────────────────────────────────
    const filtered = filter === 'all'
      ? allUsers
      : filter === 'online'
      ? allUsers.filter(u => u.is_online)
      : allUsers.filter(u => u.status === filter);

    // Stats
    const stats = {
      total:    allUsers.length,
      approved: allUsers.filter(u => u.status === 'approved').length,
      pending:  allUsers.filter(u => u.status === 'pending').length,
      rejected: allUsers.filter(u => u.status === 'rejected').length,
      online:   onlineUserIds.size,
    };

    return NextResponse.json({ ok: true, users: filtered, stats });
  } catch (error) {
    console.error('[admin/users GET] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users
// Admin creates a user directly (bypasses access-request flow)
// Body: { contactName, companyName, contactEmail, role? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await request.json();
    const { contactName, companyName, contactEmail, role = 'user', accessReason } = body;

    if (!contactName || !companyName || !contactEmail) {
      return NextResponse.json({ ok: false, error: 'Faltan campos requeridos.' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    // Invite user via Supabase Auth (sends "Set password" email)
    let userId = '';
    let isRateLimited = false;

    const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
      contactEmail.trim().toLowerCase(),
      {
        data: { contact_name: contactName.trim(), company_name: companyName.trim() },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/access`,
      }
    );

    let tempPassword = '';
    if (inviteError) {
      if (inviteError.message.toLowerCase().includes('rate limit')) {
        tempPassword = generateTempPassword();
        const { data: createData, error: createError } = await service.auth.admin.createUser({
          email: contactEmail.trim().toLowerCase(),
          password: tempPassword,
          email_confirm: true,
          user_metadata: { contact_name: contactName.trim(), company_name: companyName.trim() }
        });
        if (createError || !createData?.user) {
          return NextResponse.json({ ok: false, error: createError?.message ?? 'Error al crear usuario.' }, { status: 500 });
        }
        userId = createData.user.id;
        isRateLimited = true;
      } else {
        return NextResponse.json(
          { ok: false, error: inviteError.message },
          { status: 500 }
        );
      }
    } else if (inviteData?.user) {
      userId = inviteData.user.id;
    } else {
      return NextResponse.json({ ok: false, error: 'Error desconocido al invitar.' }, { status: 500 });
    }
    const assignedRole = contactEmail.trim().toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
      ? 'superadmin'
      : role;

    // Create user profile as approved
    const { error: profileError } = await service.from('tamiz_user_profiles').upsert({
      id:            userId,
      contact_name:  contactName.trim(),
      company_name:  companyName.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      access_reason: accessReason ?? null,
      status:        'approved',
      role:          assignedRole,
      approved_by:   admin.email ?? SUPERADMIN_EMAIL,
      approved_at:   new Date().toISOString(),
    });

    if (profileError) {
      console.error('[admin/users POST] Profile error:', profileError);
      return NextResponse.json({
        ok: false,
        userId,
        error: `Usuario de auth creado (${userId}) pero falló la creación del perfil: ${profileError.message}. El usuario no aparecerá en el panel hasta resolverlo.`,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      message: isRateLimited
        ? `Usuario creado. Límite de correos excedido, clave temporal asignada: ${tempPassword}`
        : 'Usuario invitado correctamente.'
    });
  } catch (error) {
    console.error('[admin/users POST] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users
// Actions: approve, reject, update, change-role
// Body: { id, source, action, ...data }
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await request.json();
    const { id, source, action, ...data } = body as {
      id: string;
      source: 'request' | 'profile';
      action: 'approve' | 'reject' | 'update' | 'change-role';
      [key: string]: unknown;
    };

    if (!id || !action) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros.' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    // ── APPROVE ─────────────────────────────────────────────────────────────
    if (action === 'approve') {
      // Get request data
      const { data: req, error: reqErr } = await service
        .from('tamiz_access_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (reqErr || !req) {
        return NextResponse.json({ ok: false, error: 'Solicitud no encontrada.' }, { status: 404 });
      }

      // Invite user via Supabase Auth
      let userId = '';
      let isRateLimited = false;

      const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
        req.contact_email,
        {
          data: { contact_name: req.contact_name, company_name: req.company_name },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/access`,
        }
      );

      let tempPassword = '';
      if (inviteError) {
        if (inviteError.message.toLowerCase().includes('rate limit')) {
          tempPassword = generateTempPassword();
          const { data: createData, error: createError } = await service.auth.admin.createUser({
            email: req.contact_email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { contact_name: req.contact_name, company_name: req.company_name }
          });
          if (createError || !createData?.user) {
            return NextResponse.json({ ok: false, error: createError?.message ?? 'Error al crear usuario.' }, { status: 500 });
          }
          userId = createData.user.id;
          isRateLimited = true;
        } else {
          return NextResponse.json(
            { ok: false, error: inviteError.message },
            { status: 500 }
          );
        }
      } else if (inviteData?.user) {
        userId = inviteData.user.id;
      } else {
        return NextResponse.json({ ok: false, error: 'Error desconocido al invitar.' }, { status: 500 });
      }

      // Create profile as approved
      const { error: profileError } = await service.from('tamiz_user_profiles').upsert({
        id:            userId,
        contact_name:  req.contact_name,
        company_name:  req.company_name,
        contact_email: req.contact_email,
        access_reason: req.access_reason,
        status:        'approved',
        role:          'user',
        approved_by:   admin.email ?? SUPERADMIN_EMAIL,
        approved_at:   new Date().toISOString(),
      });

      if (profileError) {
        console.error('[admin/users PATCH approve] Profile error:', profileError);
        return NextResponse.json({
          ok: false,
          error: `Usuario de auth creado (${userId}) pero falló la creación del perfil: ${profileError.message}. La solicitud sigue pendiente.`,
        }, { status: 500 });
      }

      // Mark request as approved
      await service.from('tamiz_access_requests').update({
        status:     'approved',
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      return NextResponse.json({
        ok: true,
        message: isRateLimited
          ? `Usuario aprobado. Límite de correos excedido, clave temporal asignada: ${tempPassword}`
          : 'Usuario aprobado. Email de activación enviado.'
      });
    }

    // ── REJECT ──────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const reason = (data.reason as string) ?? '';
      const table  = source === 'request' ? 'tamiz_access_requests' : 'tamiz_user_profiles';

      await service.from(table).update({
        status:          'rejected',
        rejected_reason: reason,
        updated_at:      new Date().toISOString(),
      }).eq('id', id);

      return NextResponse.json({ ok: true, message: 'Solicitud rechazada.' });
    }

    // ── UPDATE (edit profile data) ───────────────────────────────────────────
    if (action === 'update') {
      const { contactName, companyName, accessReason } = data as Record<string, string>;
      await service.from('tamiz_user_profiles').update({
        contact_name:  contactName,
        company_name:  companyName,
        access_reason: accessReason ?? null,
        updated_at:    new Date().toISOString(),
      }).eq('id', id);

      return NextResponse.json({ ok: true, message: 'Usuario actualizado.' });
    }

    // ── CHANGE ROLE ──────────────────────────────────────────────────────────
    if (action === 'change-role') {
      const { role } = data as { role: string };
      await service.from('tamiz_user_profiles').update({
        role,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      return NextResponse.json({ ok: true, message: `Rol cambiado a ${role}.` });
    }

    return NextResponse.json({ ok: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error) {
    console.error('[admin/users PATCH] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users
// Body: { id, source } — deletes auth user + profile (or just request)
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await request.json();
    const { id, source } = body as { id: string; source: 'request' | 'profile' };

    const service = createServiceRoleClient();

    if (source === 'request') {
      await service.from('tamiz_access_requests').delete().eq('id', id);
    } else {
      // Delete auth user (cascades to profile via FK)
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, message: 'Usuario eliminado.' });
  } catch (error) {
    console.error('[admin/users DELETE] Error:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
