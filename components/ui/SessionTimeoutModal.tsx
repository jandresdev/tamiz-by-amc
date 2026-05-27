'use client';

import { useEffect, useState } from 'react';

interface SessionTimeoutModalProps {
  minutesLeft: number; // how many minutes remain (counts down from 5)
  onExtend: () => void;
  onEnd: () => void;
}

export default function SessionTimeoutModal({
  minutesLeft,
  onExtend,
  onEnd,
}: SessionTimeoutModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutesLeft * 60);

  // Recompute secondsLeft whenever minutesLeft changes (new warning fired)
  useEffect(() => {
    setSecondsLeft(minutesLeft * 60);
  }, [minutesLeft]);

  // Count down every second
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1_000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display =
    secondsLeft > 60
      ? `${mins} minuto${mins !== 1 ? 's' : ''}`
      : secondsLeft > 0
      ? `${secondsLeft} segundo${secondsLeft !== 1 ? 's' : ''}`
      : 'unos momentos';

  return (
    <div className="timeout-backdrop" role="dialog" aria-modal="true" aria-label="Advertencia de expiración de sesión">
      <div className="timeout-modal">
        <div className="timeout-icon" aria-hidden="true">⏱</div>
        <h2 className="timeout-title">Tu sesión está por expirar</h2>
        <p className="timeout-body">
          Por seguridad, la sesión se cerrará en&nbsp;
          <strong>{display}</strong>&nbsp;por inactividad.
          <br />
          Tu progreso se perderá si no continúas.
        </p>

        <div className="timeout-actions">
          <button
            type="button"
            className="action-btn primary"
            onClick={onExtend}
            autoFocus
          >
            Continuar sesión
          </button>
          <button
            type="button"
            className="action-btn secondary"
            onClick={onEnd}
          >
            Terminar sesión
          </button>
        </div>

        <div className="timeout-bar-wrap" aria-hidden="true">
          <div
            className="timeout-bar"
            style={{ width: `${Math.max(0, (secondsLeft / (minutesLeft * 60)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
