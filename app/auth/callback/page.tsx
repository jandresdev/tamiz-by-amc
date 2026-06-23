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
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const supabase = createBrowserSupabaseClient();
  const handled = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;

    const redirect = (session: boolean, error?: any) => {
      if (handled.current) return;
      handled.current = true;

      if (session) {
        setStatus('Acceso confirmado. Redirigiendo...');
        const isInviteOrRecovery = hash.includes('type=invite') || hash.includes('type=recovery');
        window.location.replace(isInviteOrRecovery ? '/update-password' : '/access');
      } else {
        setStatus('Error al verificar el enlace.');
        setDebugInfo({
          hash: hash,
          error: error?.message || error?.toString() || 'No session and no error provided',
          url: window.location.href,
        });
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
      const { data: { session }, error } = await supabase.auth.getSession();
      redirect(!!session, error);
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
      {debugInfo && (
        <pre style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#111',
          color: '#0f0',
          borderRadius: '8px',
          maxWidth: '90%',
          overflowX: 'auto',
          fontSize: '0.8rem',
          textAlign: 'left'
        }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
