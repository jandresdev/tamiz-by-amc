import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase.server';

/**
 * POST /api/auth/request-access
 * Crea una solicitud de acceso en tamiz_access_requests.
 * Pública — no requiere autenticación.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactName, companyName, contactEmail, accessReason } = body as {
      contactName: string;
      companyName: string;
      contactEmail: string;
      accessReason?: string;
    };

    if (!contactName?.trim() || !companyName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Faltan campos requeridos: nombre, empresa y correo.' },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail.trim());
    if (!emailOk) {
      return NextResponse.json(
        { ok: false, error: 'El correo electrónico no es válido.' },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();

    // Check if there is already an approved user with this email (auth.users via profile)
    const { data: existingProfile } = await admin
      .from('tamiz_user_profiles')
      .select('id, status')
      .eq('contact_email', contactEmail.trim().toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.status === 'approved') {
        return NextResponse.json(
          { ok: false, error: 'Este correo ya tiene una cuenta activa. Por favor inicie sesión.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: 'Este correo ya tiene una solicitud pendiente o cuenta existente.' },
        { status: 409 }
      );
    }

    // Check existing access requests (to avoid duplicate pending requests)
    const { data: existingReq } = await admin
      .from('tamiz_access_requests')
      .select('id, status')
      .eq('contact_email', contactEmail.trim().toLowerCase())
      .maybeSingle();

    if (existingReq) {
      if (existingReq.status === 'pending') {
        return NextResponse.json(
          { ok: false, error: 'Ya existe una solicitud pendiente con este correo. Espere la revisión del administrador.' },
          { status: 409 }
        );
      }
      // Was rejected — allow re-request by updating the existing record
      await admin
        .from('tamiz_access_requests')
        .update({
          contact_name:   contactName.trim(),
          company_name:   companyName.trim(),
          access_reason:  accessReason?.trim() ?? null,
          status:         'pending',
          rejected_reason: null,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', existingReq.id);

      return NextResponse.json({ ok: true, message: 'Solicitud re-enviada correctamente.' });
    }

    // Insert new request
    const { error } = await admin
      .from('tamiz_access_requests')
      .insert({
        contact_name:   contactName.trim(),
        company_name:   companyName.trim(),
        contact_email:  contactEmail.trim().toLowerCase(),
        access_reason:  accessReason?.trim() ?? null,
        status:         'pending',
      });

    if (error) {
      console.error('[request-access] Insert error:', error);
      return NextResponse.json(
        { ok: false, error: 'Error al registrar la solicitud. Intente de nuevo.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Solicitud enviada correctamente.' });
  } catch (error) {
    console.error('[request-access] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
