'use client';

interface NavButtonsProps {
  onBack?: () => void;
  onReset?: () => void;
  showBack?: boolean;
  showReset?: boolean;
  backLabel?: string;
  resetLabel?: string;
}

export default function NavButtons({
  onBack,
  onReset,
  showBack = true,
  showReset = true,
  backLabel = '← Atrás',
  resetLabel = 'Reiniciar',
}: NavButtonsProps) {
  if (!showBack && !showReset) return null;

  return (
    <div className="nav-row">
      {showBack && onBack ? (
        <button type="button" className="nav-btn" onClick={onBack}>
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      {showReset && onReset ? (
        <button type="button" className="nav-btn" onClick={onReset}>
          {resetLabel}
        </button>
      ) : null}
    </div>
  );
}
