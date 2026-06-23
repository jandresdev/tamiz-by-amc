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
    if (handled.current) return;

    const processHash = async () => {
      try {
        const hash = window.location.hash;
        
        // If there's no hash, we can't do anything here (maybe it's a direct visit)
        if (!hash || !hash.includes('access_token=')) {
          // Fallback check just in case a session already exists
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            window.location.replace('/access');
            return;
          }
          setStatus('No se encontró información de acceso en el enlace.');
          return;
        }

        handled.current = true;
        
        // Remove the '#' and parse as query params
        const hashParams = new URLSearchParams(hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (!access_token || !refresh_token) {
          setStatus('El enlace está incompleto o dañado.');
          setDebugInfo({ error: 'Missing tokens in hash', hash });
          return;
        }

        // Manually force the session
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          setStatus('Error al verificar el enlace de invitación.');
          setDebugInfo({ error: error.message, hash });
          return;
        }

        if (data.session) {
          setStatus('Acceso confirmado. Redirigiendo...');
          // Redirect based on type
          const isInviteOrRecovery = type === 'invite' || type === 'recovery' || hash.includes('type=invite');
          window.location.replace(isInviteOrRecovery ? '/update-password' : '/access');
        } else {
          setStatus('No se pudo establecer la sesión.');
          setDebugInfo({ error: 'setSession succeeded but returned no session', hash });
        }

      } catch (err: any) {
        setStatus('Ocurrió un error inesperado.');
        setDebugInfo({ error: err.message || String(err) });
      }
    };

    processHash();
  }, [supabase.auth]);

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
