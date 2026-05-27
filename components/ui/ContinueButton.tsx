'use client';

interface ContinueButtonProps {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function ContinueButton({
  label = 'Continuar',
  onClick,
  disabled = false,
  loading = false,
}: ContinueButtonProps) {
  return (
    <button
      type="button"
      className={`continue-btn${loading ? ' loading' : ''}`}
      onClick={loading ? undefined : onClick}
      disabled={disabled && !loading}
      aria-busy={loading}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {loading ? 'Procesando...' : label}
    </button>
  );
}
