import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/callback
 *
 * Supabase redirects here after email confirmation / password-reset / invite.
 * It may carry:
 *   - ?code=<pkce_code>  (PKCE flow — modern)
 *   - #access_token=...  (implicit flow — older; browser handles this client-side)
 *
 * For the PKCE flow we exchange the code for a session server-side and then
 * redirect the user to the correct destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'invite' | 'recovery' | 'signup' | ...
  const next = searchParams.get('next') ?? '/access';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Session established. For invite/recovery, go to update-password page.
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/update-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] Exchange error:', error.message);
  }

  // If no code or exchange failed, redirect to /access with an error hint
  return NextResponse.redirect(`${origin}/access?error=auth_callback_failed`);
}
