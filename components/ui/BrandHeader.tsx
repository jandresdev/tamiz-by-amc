'use client';

interface BrandHeaderProps {
  onLogout?: () => void;
  userLabel?: string;
}

export default function BrandHeader({ onLogout, userLabel }: BrandHeaderProps) {
  return (
    <div className="brand">
      <div className="brand-text">
        <p className="brand-name">AMC Principal</p>
        <h1 className="brand-title">
          Tamiz <span className="brand-by">| by AMC Principal</span>
        </h1>
        <p className="brand-subtitle">
          Herramienta propietaria de diagnóstico de esquemas regulatorios en operaciones de energía
        </p>
      </div>

      {onLogout && (
        <div className="brand-user">
          {userLabel && <span className="brand-user-label">{userLabel}</span>}
          <button
            type="button"
            className="brand-logout-btn"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
}
