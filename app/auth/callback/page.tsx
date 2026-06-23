'use client';

import { useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

/**
 * /auth/callback
 *
 * Landing page for Supabase email links (invite, magic link, recovery).
 * Supabase sends tokens in the URL hash (#access_token=...&type=invite).
 * The browser-side Supabase client reads the hash, establishes a cookie
 * session, then we redirect to /update-password.
 *
 * The server cannot read URL hashes, so this MUST be a client component.
 */
export default function AuthCallbackPage() {
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // getSession() triggers the client to parse the hash and exchange tokens
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[auth/callback] Session error:', error.message);
        window.location.href = `/access?error=${encodeURIComponent(error.message)}`;
        return;
      }

      if (session) {
        // Session established — check the type from the hash
        const hash = window.location.hash;
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
          window.location.href = '/update-password';
        } else {
          window.location.href = '/access';
        }
      } else {
        // No session — token may have been invalid or already used
        window.location.href = '/access?error=invalid_link';
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      flexDirection: 'column',
      gap: '1rem',
      background: '#f8f9fa',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #6c63ff',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#555', margin: 0 }}>Verificando acceso...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
