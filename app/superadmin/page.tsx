'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase.client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type UserFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'online';

interface AdminUser {
  id:             string;
  source:         'request' | 'profile';
  contact_name:   string;
  company_name:   string;
  contact_email:  string;
  access_reason:  string | null;
  status:         string;
  role:           string;
  approved_by:    string | null;
  approved_at:    string | null;
  rejected_reason:string | null;
  last_seen:      string | null;
  created_at:     string;
  is_online:      boolean;
}

interface Stats { total: number; approved: number; pending: number; rejected: number; online: number; }
interface AppConfig { key: string; value: string; description: string; }

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Reject reason
// ─────────────────────────────────────────────────────────────────────────────
function RejectModal({ user, onConfirm, onCancel }: {
  user: AdminUser;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="sa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="sa-modal">
        <h3 className="sa-modal-title">Rechazar solicitud</h3>
        <p className="sa-modal-desc">
          <strong>{user.contact_name}</strong> — {user.company_name}
        </p>
        <label className="field-label" htmlFor="reject-reason">Motivo (opcional)</label>
        <textarea
          id="reject-reason"
          className="text-input normative-textarea"
          rows={3}
          placeholder="Razón del rechazo para informar al usuario..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <div className="sa-modal-actions">
          <button className="action-btn secondary" onClick={onCancel} type="button">Cancelar</button>
          <button className="action-btn primary" style={{ background: 'var(--red-bdr)', borderColor: 'var(--red-bdr)' }}
            onClick={() => onConfirm(reason)} type="button">
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Create user
// ─────────────────────────────────────────────────────────────────────────────
function CreateUserModal({ onConfirm, onCancel, loading }: {
  onConfirm: (data: { contactName: string; companyName: string; contactEmail: string; role: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName]       = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState('user');
  return (
    <div className="sa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="sa-modal">
        <h3 className="sa-modal-title">Crear usuario</h3>
        <p className="sa-modal-desc">El usuario recibirá un email para establecer su contraseña.</p>
        <div className="field-group">
          <label className="field-label" htmlFor="cu-name">Nombre completo *</label>
          <input id="cu-name" className="text-input" type="text" value={name} onChange={e => setName(e.target.value)} autoFocus required />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="cu-company">Empresa *</label>
          <input id="cu-company" className="text-input" type="text" value={company} onChange={e => setCompany(e.target.value)} required />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="cu-email">Correo *</label>
          <input id="cu-email" className="text-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="cu-role">Rol</label>
          <select id="cu-role" className="text-input" value={role} onChange={e => setRole(e.target.value)}>
            <option value="user">Usuario</option>
            <option value="superadmin">SuperAdmin</option>
          </select>
        </div>
        <div className="sa-modal-actions">
          <button className="action-btn secondary" onClick={onCancel} type="button">Cancelar</button>
          <button className="action-btn primary" type="button"
            disabled={!name.trim() || !company.trim() || !email.trim() || loading}
            onClick={() => onConfirm({ contactName: name, companyName: company, contactEmail: email, role })}>
            {loading ? <><span className="spinner" />Enviando...</> : 'Crear y enviar invitación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'diagnosticos' | 'config'>('users');
  const [filter, setFilter]       = useState<UserFilter>('all');
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [stats, setStats]         = useState<Stats>({ total: 0, approved: 0, pending: 0, rejected: 0, online: 0 });
  const [config, setConfig]       = useState<AppConfig[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<Record<string, unknown>[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch]       = useState('');
  const [rejectTarget, setRejectTarget]   = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configEdits, setConfigEdits]         = useState<Record<string, string>>({});
  const [adminEmail, setAdminEmail]           = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Load current user email ─────────────────────────────────────────────
  useEffect(() => {
    createBrowserSupabaseClient().auth.getUser().then(({ data }) => {
      setAdminEmail(data.user?.email ?? '');
    });
  }, []);

  // ── Fetch users ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (f: UserFilter = filter) => {
    setLoadingUsers(true);
    try {
      const res  = await fetch(`/api/admin/users?filter=${f}`);
      const data = await res.json();
      if (data.ok) { setUsers(data.users); setStats(data.stats); }
    } finally {
      setLoadingUsers(false);
    }
  }, [filter]);

  useEffect(() => { fetchUsers(filter); }, [filter, fetchUsers]);

  // ── Auto-refresh every 30s when on users tab ───────────────────────────
  useEffect(() => {
    if (activeTab !== 'users') return;
    const interval = setInterval(() => fetchUsers(filter), 30_000);
    return () => clearInterval(interval);
  }, [activeTab, filter, fetchUsers]);

  // ── Fetch config ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'config') return;
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      if (d.ok) {
        setConfig(d.config);
        setConfigEdits(Object.fromEntries((d.config as AppConfig[]).map((c: AppConfig) => [c.key, c.value])));
      }
    });
  }, [activeTab]);

  // ── Fetch diagnósticos ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'diagnosticos') return;
    const supabase = createBrowserSupabaseClient();
    supabase.from('tamiz_diagnosticos').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setDiagnosticos(data ?? []));
  }, [activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────
  const apiAction = useCallback(async (
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown>,
    successMsg: string
  ) => {
    const key = JSON.stringify(body);
    setActionLoading(key);
    try {
      const res  = await fetch('/api/admin/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(successMsg);
        fetchUsers(filter);
      } else {
        showToast(data.error ?? 'Error al realizar la acción.', 'error');
      }
    } catch {
      showToast('Error de red. Intente de nuevo.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [filter, fetchUsers, showToast]);

  const handleApprove = (user: AdminUser) =>
    apiAction('PATCH', { id: user.id, source: user.source, action: 'approve' }, 'Usuario aprobado. Email de activación enviado ✓');

  const handleReject = (user: AdminUser, reason: string) => {
    setRejectTarget(null);
    apiAction('PATCH', { id: user.id, source: user.source, action: 'reject', reason }, 'Solicitud rechazada.');
  };

  const handleDelete = (user: AdminUser) => {
    if (!confirm(`¿Eliminar a ${user.contact_name} (${user.contact_email})? Esta acción no se puede deshacer.`)) return;
    apiAction('DELETE', { id: user.id, source: user.source }, 'Usuario eliminado.');
  };

  const handleCreateUser = async (formData: { contactName: string; companyName: string; contactEmail: string; role: string }) => {
    setActionLoading('create');
    try {
      const res  = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Usuario creado e invitación enviada ✓');
        setShowCreateModal(false);
        fetchUsers(filter);
      } else {
        showToast(data.error ?? 'Error al crear usuario.', 'error');
      }
    } catch {
      showToast('Error de red.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveConfig = async (key: string) => {
    setActionLoading(`config-${key}`);
    try {
      const res  = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: configEdits[key] }),
      });
      const data = await res.json();
      showToast(data.ok ? 'Configuración guardada ✓' : (data.error ?? 'Error'), data.ok ? 'success' : 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await createBrowserSupabaseClient().auth.signOut();
    router.push('/access');
  };

  // ── Filtered & searched users ──────────────────────────────────────────
  const displayUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.contact_name.toLowerCase().includes(q)
        || u.company_name.toLowerCase().includes(q)
        || u.contact_email.toLowerCase().includes(q);
  });

  // ── Status badge ────────────────────────────────────────────────────────
  const StatusBadge = ({ user }: { user: AdminUser }) => {
    const cls = user.status === 'approved' ? 'sa-badge-approved'
              : user.status === 'pending'  ? 'sa-badge-pending'
              : 'sa-badge-rejected';
    const label = user.status === 'approved' ? 'Aprobado'
                : user.status === 'pending'  ? 'Pendiente'
                : 'Rechazado';
    return (
      <span className={`sa-badge ${cls}`}>
        {user.is_online && <span className="sa-online-dot" title="Conectado ahora" />}
        {label}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="sa-root">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sa-sidebar">
        <div className="sa-sidebar-brand">
          <span className="sa-sidebar-logo">⚡</span>
          <div>
            <p className="sa-sidebar-brand-name">AMC Principal</p>
            <p className="sa-sidebar-brand-sub">Tamiz · SuperAdmin</p>
          </div>
        </div>

        <nav className="sa-nav">
          <button
            type="button"
            className={`sa-nav-item${activeTab === 'users' ? ' active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span>👥</span> Usuarios
            {stats.pending > 0 && <span className="sa-nav-badge">{stats.pending}</span>}
          </button>
          <button
            type="button"
            className={`sa-nav-item${activeTab === 'diagnosticos' ? ' active' : ''}`}
            onClick={() => setActiveTab('diagnosticos')}
          >
            <span>📋</span> Diagnósticos
          </button>
          <button
            type="button"
            className={`sa-nav-item${activeTab === 'config' ? ' active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <span>⚙️</span> Configuración
          </button>
        </nav>

        <div className="sa-sidebar-footer">
          <p className="sa-sidebar-user-email">{adminEmail}</p>
          <button type="button" className="sa-logout-btn" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="sa-main">

        {/* ── USERS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="sa-section">
            <div className="sa-section-header">
              <h2 className="sa-section-title">Gestión de Usuarios</h2>
              <button
                type="button"
                className="action-btn primary sa-create-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + Crear usuario
              </button>
            </div>

            {/* Stats cards */}
            <div className="sa-stats-grid">
              {[
                { label: 'Conectados ahora', value: stats.online, color: 'var(--grn)',     dot: true },
                { label: 'Total usuarios',   value: stats.total,  color: 'var(--acc)' },
                { label: 'Aprobados',        value: stats.approved, color: 'var(--grn)' },
                { label: 'Pendientes',       value: stats.pending,  color: 'var(--amb-bdr)' },
                { label: 'Rechazados',       value: stats.rejected, color: 'var(--red-bdr)' },
              ].map(card => (
                <div key={card.label} className="sa-stat-card">
                  <div className="sa-stat-value" style={{ color: card.color }}>
                    {card.dot && <span className="sa-pulse-dot" />}
                    {card.value}
                  </div>
                  <div className="sa-stat-label">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="sa-filter-tabs">
              {(['all', 'pending', 'approved', 'rejected', 'online'] as UserFilter[]).map(f => (
                <button
                  key={f}
                  type="button"
                  className={`sa-filter-tab${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {{
                    all:      'Todos',
                    pending:  `Pendientes ${stats.pending > 0 ? `(${stats.pending})` : ''}`,
                    approved: 'Aprobados',
                    rejected: 'Rechazados',
                    online:   `🟢 Conectados (${stats.online})`,
                  }[f]}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="sa-search-wrap">
              <input
                type="search"
                className="text-input sa-search-input"
                placeholder="Buscar por nombre, empresa o correo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Users table */}
            {loadingUsers ? (
              <div className="sa-loading">Cargando usuarios...</div>
            ) : displayUsers.length === 0 ? (
              <div className="sa-empty">No hay usuarios en esta categoría.</div>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Empresa</th>
                      <th>Estado</th>
                      <th>Rol</th>
                      <th>Última actividad</th>
                      <th>Registrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.map(user => (
                      <tr key={`${user.source}-${user.id}`} className={user.is_online ? 'sa-row-online' : ''}>
                        <td>
                          <div className="sa-user-cell">
                            <span className="sa-user-name">{user.contact_name}</span>
                            <span className="sa-user-email">{user.contact_email}</span>
                            {user.access_reason && (
                              <span className="sa-user-reason" title={user.access_reason}>
                                💬 {user.access_reason.slice(0, 60)}{user.access_reason.length > 60 ? '...' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sa-td-company">{user.company_name}</td>
                        <td><StatusBadge user={user} /></td>
                        <td>
                          <span className={`sa-role-badge ${user.role === 'superadmin' ? 'sa-role-admin' : ''}`}>
                            {user.role === 'superadmin' ? '⭐ Admin' : 'Usuario'}
                          </span>
                        </td>
                        <td className="sa-td-date">
                          {user.last_seen
                            ? new Date(user.last_seen).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                        <td className="sa-td-date">
                          {new Date(user.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td>
                          <div className="sa-actions-cell">
                            {user.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="sa-action-btn sa-action-approve"
                                  onClick={() => handleApprove(user)}
                                  disabled={!!actionLoading}
                                  title="Aprobar y enviar email de activación"
                                >
                                  ✓ Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="sa-action-btn sa-action-reject"
                                  onClick={() => setRejectTarget(user)}
                                  disabled={!!actionLoading}
                                  title="Rechazar solicitud"
                                >
                                  ✕ Rechazar
                                </button>
                              </>
                            )}
                            {user.status === 'rejected' && (
                              <button
                                type="button"
                                className="sa-action-btn sa-action-approve"
                                onClick={() => handleApprove(user)}
                                disabled={!!actionLoading}
                                title="Aprobar y enviar email de activación"
                              >
                                ↩ Re-aprobar
                              </button>
                            )}
                            {user.source === 'profile' && user.role !== 'superadmin' && (
                              <button
                                type="button"
                                className="sa-action-btn sa-action-role"
                                onClick={() =>
                                  apiAction('PATCH', { id: user.id, source: 'profile', action: 'change-role', role: user.role === 'superadmin' ? 'user' : 'superadmin' },
                                    'Rol actualizado.')
                                }
                                disabled={!!actionLoading}
                                title="Hacer superadmin"
                              >
                                ⭐
                              </button>
                            )}
                            <button
                              type="button"
                              className="sa-action-btn sa-action-delete"
                              onClick={() => handleDelete(user)}
                              disabled={!!actionLoading}
                              title="Eliminar usuario permanentemente"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DIAGNÓSTICOS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'diagnosticos' && (
          <div className="sa-section">
            <div className="sa-section-header">
              <h2 className="sa-section-title">Diagnósticos enviados</h2>
              <span className="sa-section-sub">{diagnosticos.length} registros</span>
            </div>
            {diagnosticos.length === 0 ? (
              <div className="sa-empty">No hay diagnósticos registrados.</div>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Correo</th>
                      <th>Esquema diagnóstico</th>
                      <th>Intuición inicial</th>
                      <th>Enviado a Ops</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticos.map((d: Record<string, unknown>) => (
                      <tr key={d.id as string}>
                        <td className="sa-user-name">{d.company_name as string}</td>
                        <td className="sa-user-email">{d.contact_email as string}</td>
                        <td><span className={`sa-badge ${d.diagnosed_scheme === 'SINSOP' ? 'sa-badge-rejected' : 'sa-badge-approved'}`}>{d.diagnosed_scheme as string}</span></td>
                        <td className="sa-td-company">{d.initial_intuition as string ?? '—'}</td>
                        <td>{d.sent_to_ops ? '✅' : '❌'}</td>
                        <td className="sa-td-date">{new Date(d.created_at as string).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIG TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="sa-section">
            <div className="sa-section-header">
              <h2 className="sa-section-title">Configuración de la app</h2>
            </div>
            <div className="sa-config-grid">
              {config.map(c => (
                <div key={c.key} className="sa-config-card">
                  <label className="field-label" htmlFor={`config-${c.key}`}>{c.description || c.key}</label>
                  <div className="sa-config-row">
                    <input
                      id={`config-${c.key}`}
                      className="text-input"
                      value={configEdits[c.key] ?? c.value}
                      onChange={e => setConfigEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="action-btn primary sa-config-save-btn"
                      onClick={() => handleSaveConfig(c.key)}
                      disabled={actionLoading === `config-${c.key}` || configEdits[c.key] === c.value}
                    >
                      {actionLoading === `config-${c.key}` ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                  <p className="normative-helper">Clave: <code>{c.key}</code></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {rejectTarget && (
        <RejectModal
          user={rejectTarget}
          onConfirm={reason => handleReject(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      {showCreateModal && (
        <CreateUserModal
          onConfirm={handleCreateUser}
          onCancel={() => setShowCreateModal(false)}
          loading={actionLoading === 'create'}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`toast-container`}>
          <div className={`toast ${toast.type === 'success' ? 'success' : 'error'}`} role="status">
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
