'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

type Tab = 'login' | 'request';

function AccessPageContent() {
  const searchParams = useSearchParams();
  const statusParam  = searchParams.get('status');
  const nextParam    = searchParams.get('next');

  const [tab, setTab]               = useState<Tab>('login');
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState('');
  const [msgType, setMsgType]       = useState<'success' | 'error' | 'info'>('info');
  const [submitted, setSubmitted]   = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPass, setLoginPass]         = useState('');
  const [showPass, setShowPass]           = useState(false);

  // Request fields
  const [reqName, setReqName]       = useState('');
  const [reqCompany, setReqCompany] = useState('');
  const [reqEmail, setReqEmail]     = useState('');
  const [reqReason, setReqReason]   = useState('');

  const supabase = createBrowserSupabaseClient();
  const submitRef = useRef(false);

  // Status messages from middleware redirects
  useEffect(() => {
    if (statusParam === 'pending') {
      setMessage('Su solicitud está pendiente de aprobación. Recibirá un email cuando sea activada.');
      setMsgType('info');
    } else if (statusParam === 'rejected') {
      setMessage('Su solicitud fue rechazada. Contacte a ops@amcprincipal.com para más información.');
      setMsgType('error');
    }
  }, [statusParam]);

  const showMsg = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMsgType(type);
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPass || loading) return;
    if (submitRef.current) return;
    submitRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email:    loginEmail.trim().toLowerCase(),
        password: loginPass,
      });
      if (error) {
        showMsg(
          error.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos.'
            : 'Email no confirmado. Revise su bandeja de entrada.',
          'error'
        );
        submitRef.current = false;
        setLoading(false);
        return;
      }
      // Middleware handles destination after login
      window.location.href = nextParam === 'superadmin' ? '/superadmin' : '/questionnaire';
    } catch {
      showMsg('Error al iniciar sesión. Intente de nuevo.', 'error');
      submitRef.current = false;
      setLoading(false);
    }
  };

  // ── Request access ─────────────────────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim() || !reqCompany.trim() || !reqEmail.trim() || loading) return;
    if (submitRef.current) return;
    submitRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName:  reqName.trim(),
          companyName:  reqCompany.trim(),
          contactEmail: reqEmail.trim().toLowerCase(),
          accessReason: reqReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.error ?? 'Error al enviar la solicitud.', 'error');
      } else {
        setSubmitted(true);
        showMsg('Solicitud enviada correctamente. Le avisaremos por email cuando su cuenta sea activada.', 'success');
      }
    } catch {
      showMsg('Error de conexión. Intente de nuevo.', 'error');
    } finally {
      submitRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="access-page">
      {/* ── Left — Brand panel ─────────────────────────────────────────────── */}
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
            <li>
              <span className="access-feat-icon">⚡</span>
              <span>Clasificación en 5 esquemas regulatorios</span>
            </li>
            <li>
              <span className="access-feat-icon">🔒</span>
              <span>Acceso restringido y controlado</span>
            </li>
            <li>
              <span className="access-feat-icon">📋</span>
              <span>Diagnóstico basado en cuestionario estructurado</span>
            </li>
            <li>
              <span className="access-feat-icon">📧</span>
              <span>Reporte enviado al equipo de AMC Principal</span>
            </li>
          </ul>

          <p className="access-legal-note">
            v2.0 · Uso restringido · Requiere autorización previa
          </p>
        </div>
      </div>

      {/* ── Right — Form panel ────────────────────────────────────────────── */}
      <div className="access-right">
        <div className="access-card">
          <div className="access-logo-mobile">
            <span className="access-brand-chip">AMC Principal</span>
          </div>

          <div className="access-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`access-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); setMessage(''); setSubmitted(false); }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'request'}
              className={`access-tab${tab === 'request' ? ' active' : ''}`}
              onClick={() => { setTab('request'); setMessage(''); setSubmitted(false); }}
            >
              Solicitar acceso
            </button>
          </div>

          {message && (
            <div className={`access-msg access-msg-${msgType}`} role="alert" aria-live="polite">
              {message}
            </div>
          )}

          {/* ── Login form ──────────────────────────────────────────────────── */}
          {tab === 'login' && (
            <form className="access-form" onSubmit={handleLogin} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="login-email">
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="text-input"
                  placeholder="correo@empresa.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="login-password">
                  Contraseña
                </label>
                <div className="input-password-wrap">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="text-input"
                    placeholder="••••••••"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    autoComplete="current-password"
                    required
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
              <button
                type="submit"
                id="login-submit"
                className="continue-btn"
                disabled={!loginEmail.trim() || !loginPass || loading}
              >
                {loading
                  ? <><span className="spinner" aria-hidden="true" /> Ingresando...</>
                  : 'Ingresar →'}
              </button>
              <p className="access-help-text">
                ¿Aún no tiene cuenta?{' '}
                <button
                  type="button"
                  className="access-link-btn"
                  onClick={() => { setTab('request'); setMessage(''); }}
                >
                  Solicite acceso aquí
                </button>
              </p>
            </form>
          )}

          {/* ── Request access form ─────────────────────────────────────────── */}
          {tab === 'request' && !submitted && (
            <form className="access-form" onSubmit={handleRequest} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="req-name">Nombre completo *</label>
                <input
                  id="req-name"
                  type="text"
                  className="text-input"
                  placeholder="Nombre y apellidos"
                  value={reqName}
                  onChange={e => setReqName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="req-company">Empresa *</label>
                <input
                  id="req-company"
                  type="text"
                  className="text-input"
                  placeholder="Razón social o nombre comercial"
                  value={reqCompany}
                  onChange={e => setReqCompany(e.target.value)}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="req-email">Correo corporativo *</label>
                <input
                  id="req-email"
                  type="email"
                  className="text-input"
                  placeholder="correo@empresa.com"
                  value={reqEmail}
                  onChange={e => setReqEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="req-reason">
                  Motivo de acceso{' '}
                  <span className="field-label-optional">(opcional)</span>
                </label>
                <textarea
                  id="req-reason"
                  className="text-input normative-textarea"
                  placeholder="Contexto de uso o proyecto asociado..."
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                id="request-submit"
                className="continue-btn"
                disabled={!reqName.trim() || !reqCompany.trim() || !reqEmail.trim() || loading}
              >
                {loading
                  ? <><span className="spinner" aria-hidden="true" /> Enviando...</>
                  : 'Enviar solicitud de acceso'}
              </button>
              <p className="access-help-text">
                Su solicitud será revisada por el equipo de AMC Principal. Recibirá un email con instrucciones para activar su cuenta.
              </p>
            </form>
          )}

          {/* ── Success state after request ─────────────────────────────────── */}
          {tab === 'request' && submitted && (
            <div className="access-submitted">
              <span className="access-submitted-icon">✅</span>
              <h2 className="access-submitted-title">Solicitud enviada</h2>
              <p className="access-submitted-desc">
                Hemos recibido su solicitud. El equipo de AMC Principal la revisará y recibirá un email con instrucciones para activar su cuenta.
              </p>
              <button
                type="button"
                className="action-btn secondary"
                onClick={() => { setTab('login'); setSubmitted(false); setMessage(''); }}
              >
                Volver a iniciar sesión
              </button>
            </div>
          )}
        </div>

        <p className="access-footer-note">
          AMC Principal · Bogotá · Cali · Miami · Palo Alto
        </p>
      </div>
    </div>
  );
}

export default function AccessPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
          Cargando...
        </div>
      }
    >
      <AccessPageContent />
    </Suspense>
  );
}
