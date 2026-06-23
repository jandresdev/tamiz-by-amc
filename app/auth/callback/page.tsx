'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

/**
 * /auth/callback  — client-side token exchange
 *
 * Supabase sends invite/recovery tokens as URL hash fragments:
 *   https://tamiz-by-amc.vercel.app/auth/callback#access_token=...&type=invite
 *
 * Hash fragments are never sent to the server, so this MUST be a client
 * component. The Supabase JS client parses the hash and establishes a
 * cookie session automatically when getSession() is called.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verificando acceso...');
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    const processCallback = async () => {
      // Small delay to ensure the JS client has time to parse the URL hash
      await new Promise(r => setTimeout(r, 300));

      // Listen for auth state change first (more reliable than getSession)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          subscription.unsubscribe(); // only handle once

          if (session) {
            setStatus('Acceso confirmado. Redirigiendo...');
            // Redirect to update-password for invites and recovery, else home
            if (hash.includes('type=invite') || hash.includes('type=recovery')) {
              window.location.replace('/update-password');
            } else {
              window.location.replace('/access');
            }
          } else {
            // Fallback: try getSession directly
            const { data: { session: fallbackSession } } = await supabase.auth.getSession();
            if (fallbackSession) {
              setStatus('Acceso confirmado. Redirigiendo...');
              if (hash.includes('type=invite') || hash.includes('type=recovery')) {
                window.location.replace('/update-password');
              } else {
                window.location.replace('/access');
              }
            } else {
              setStatus('Enlace inválido o ya utilizado.');
              setTimeout(() => {
                window.location.replace('/access?error=invalid_link');
              }, 2000);
            }
          }
        }
      );

      // Also try getSession immediately in case INITIAL_SESSION already fired
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        subscription.unsubscribe();
        setStatus('Acceso confirmado. Redirigiendo...');
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
          window.location.replace('/update-password');
        } else {
          window.location.replace('/access');
        }
      }
    };

    processCallback();
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
        width: 44,
        height: 44,
        border: '3px solid #6c63ff',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#555', margin: 0, fontSize: '0.95rem' }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
