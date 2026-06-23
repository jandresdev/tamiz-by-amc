'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

export default function UpdatePasswordPage() {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');
  const [ready, setReady] = useState(false);

  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    // Verify there is an active session before showing the form.
    // The /api/auth/callback route will have already exchanged the code for a
    // session and set the cookie, so getSession() should return it immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        setMessage('El enlace de invitación es inválido o ya expiró. Por favor solicite una nueva invitación.');
        setMsgType('error');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || loading) return;

    if (newPass.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      setMsgType('error');
      return;
    }

    if (newPass !== confirmPass) {
      setMessage('Las contraseñas no coinciden.');
      setMsgType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password: newPass });

    if (error) {
      setMessage(error.message || 'Error al guardar la contraseña.');
      setMsgType('error');
      setLoading(false);
      return;
    }

    setMessage('¡Contraseña creada! Redirigiendo...');
    setMsgType('success');

    setTimeout(() => {
      window.location.href = '/access';
    }, 1500);
  };

  return (
    <div className="access-page">
      {/* ── Left Brand panel ─────────────────────────────────────────────── */}
      <div className="access-left">
        <div className="access-left-inner">
          <div className="access-brand-block">
            <span className="access-brand-chip">AMC Principal</span>
            <h1 className="access-brand-title">Tamiz</h1>
            <p className="access-brand-sub">
              Herramienta propietaria de diagnóstico de esquemas regulatorios en operaciones de energía
            </p>
          </div>
          <ul className="access-features">
            <li><span className="access-feat-icon">⚡</span><span>Clasificación en 5 esquemas regulatorios</span></li>
            <li><span className="access-feat-icon">🔒</span><span>Acceso restringido y controlado</span></li>
            <li><span className="access-feat-icon">📋</span><span>Diagnóstico basado en cuestionario estructurado</span></li>
            <li><span className="access-feat-icon">📧</span><span>Reporte enviado al equipo de AMC Principal</span></li>
          </ul>
          <p className="access-legal-note">v2.0 · Uso restringido · Requiere autorización previa</p>
        </div>
      </div>

      {/* ── Right Form panel ─────────────────────────────────────────────── */}
      <div className="access-right">
        <div className="access-card">
          <div className="access-logo-mobile">
            <span className="access-brand-chip">AMC Principal</span>
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--color-text-primary, #111)' }}>
            Crear contraseña
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #666)', marginBottom: '1.5rem' }}>
            Bienvenido a Tamiz. Asigne una contraseña segura para activar su cuenta.
          </p>

          {message && (
            <div className={`access-msg access-msg-${msgType}`} role="alert">
              {message}
            </div>
          )}

          {ready && (
            <form className="access-form" onSubmit={handleSubmit} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="new-password">Nueva contraseña</label>
                <div className="input-password-wrap">
                  <input
                    id="new-password"
                    type={showPass ? 'text' : 'password'}
                    className="text-input"
                    placeholder="Mínimo 8 caracteres"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    autoFocus
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="confirm-password">Confirmar contraseña</label>
                <div className="input-password-wrap">
                  <input
                    id="confirm-password"
                    type={showPass ? 'text' : 'password'}
                    className="text-input"
                    placeholder="Repita la contraseña"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                id="update-pass-submit"
                className="continue-btn"
                disabled={!newPass || !confirmPass || loading}
              >
                {loading
                  ? <><span className="spinner" aria-hidden="true" /> Guardando...</>
                  : 'Guardar contraseña →'}
              </button>
            </form>
          )}
        </div>

        <p className="access-footer-note">AMC Principal · Bogotá · Cali · Miami · Palo Alto</p>
      </div>
    </div>
  );
}
