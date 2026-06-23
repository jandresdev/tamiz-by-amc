import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;

  // ── Allow auth callback and password setup pages through freely ────────────
  if (path.startsWith('/auth/callback') || path === '/update-password') {
    return supabaseResponse;
  }

  // Refresh session — keeps the JWT alive
  const { data: { user } } = await supabase.auth.getUser();

  // ── Protect /questionnaire ─────────────────────────────────────────────────
  if (path.startsWith('/questionnaire')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/access';
      return NextResponse.redirect(url);
    }
    // Check approval status
    const { data: profile } = await supabase
      .from('tamiz_user_profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status !== 'approved') {
      const url = request.nextUrl.clone();
      url.pathname = '/access';
      url.searchParams.set('status', profile?.status ?? 'pending');
      return NextResponse.redirect(url);
    }
  }

  // ── Protect /superadmin ────────────────────────────────────────────────────
  if (path.startsWith('/superadmin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/access';
      url.searchParams.set('next', 'superadmin');
      return NextResponse.redirect(url);
    }
    const { data: profile } = await supabase
      .from('tamiz_user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'superadmin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access';
      return NextResponse.redirect(url);
    }
  }

  // ── Already logged-in users at /access → redirect to correct destination ──
  // But don't redirect if they're on /update-password (setting first password)
  if (path === '/access' && user) {
    const { data: profile } = await supabase
      .from('tamiz_user_profiles')
      .select('status, role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'superadmin') {
      const url = request.nextUrl.clone();
      url.pathname = '/superadmin';
      return NextResponse.redirect(url);
    }
    if (profile?.status === 'approved') {
      const url = request.nextUrl.clone();
      url.pathname = '/questionnaire';
      return NextResponse.redirect(url);
    }
    // pending/rejected → stay on /access
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
