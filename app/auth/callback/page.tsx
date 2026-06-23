'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

/**
 * /auth/callback — client-side token exchange
 *
 * Supabase sends invite/recovery tokens as URL hash fragments:
 *   https://tamiz-by-amc.vercel.app/auth/callback#access_token=...&type=invite
 *
 * Hash fragments are never sent to the server, so this MUST be a client
 * component. The Supabase JS client parses the hash and establishes a
 * cookie session automatically.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verificando acceso...');
  const supabase = createBrowserSupabaseClient();
  const handled = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;

    const redirect = (session: boolean) => {
      if (handled.current) return;
      handled.current = true;

      if (session) {
        setStatus('Acceso confirmado. Redirigiendo...');
        const isInviteOrRecovery = hash.includes('type=invite') || hash.includes('type=recovery');
        window.location.replace(isInviteOrRecovery ? '/update-password' : '/access');
      } else {
        setStatus('Enlace inválido o ya expiró. Redirigiendo...');
        setTimeout(() => window.location.replace('/access?error=invalid_link'), 2500);
      }
    };

    // 1. Subscribe to auth state changes (fires when Supabase parses the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') {
        redirect(!!session);
        subscription.unsubscribe();
      }
    });

    // 2. Also check immediately after a short delay in case INITIAL_SESSION
    //    already fired before we subscribed
    const timer = setTimeout(async () => {
      if (handled.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      redirect(!!session);
      subscription.unsubscribe();
    }, 1500);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      flexDirection: 'column',
      gap: '1.25rem',
      background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f0ff 100%)',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid #6c63ff',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }} />
      <p style={{ color: '#555', margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
