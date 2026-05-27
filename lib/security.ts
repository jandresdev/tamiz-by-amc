'use client';

/**
 * Security measures migrated from Tamiz v1.0.
 * Blocks dev tools, context menu, text selection, etc.
 */
export function initSecurityMeasures(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Print session watermark
  const dateStr = new Date().toLocaleDateString('es-CO');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.body.setAttribute('data-session', `${dateStr} · ${rand}`);

  // Console watermark
  console.log('%cTamiz | by AMC Principal', 'color:#4A41B2;font-size:18px;font-weight:700;');
  console.log('%c⚠ Esta herramienta es propiedad exclusiva de AMC Principal. Uso no autorizado es perseguible legalmente.', 'color:#c00;font-size:12px;');

  // Block context menu
  const onContextMenu = (e: MouseEvent) => { e.preventDefault(); return false; };
  document.addEventListener('contextmenu', onContextMenu, true);

  // Block dev tools keyboard shortcuts
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key?.toUpperCase() ?? '';
    const ctrl = e.ctrlKey || e.metaKey;
    const blocked =
      k === 'F12' ||
      (ctrl && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k)) ||
      (ctrl && ['U', 'S', 'A', 'P'].includes(k)) ||
      k === 'PRINTSCREEN';
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  // Block text selection outside inputs
  const onSelectStart = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  };
  document.addEventListener('selectstart', onSelectStart);

  // Debugger trap — detects open dev tools
  let devOpen = false;
  const devCheck = setInterval(() => {
    const t0 = +new Date();
    // eslint-disable-next-line no-debugger
    debugger;
    if (+new Date() - t0 > 100 && !devOpen) {
      devOpen = true;
      document.body.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100vh;font-family:system-ui;font-size:14px;color:#666;gap:12px;">' +
        '<div style="font-size:32px;">🔒</div>' +
        '<div style="font-weight:700;font-size:16px;color:#333;">Herramienta protegida</div>' +
        '<div>Tamiz | by AMC Principal · Todos los derechos reservados</div>' +
        '</div>';
      clearInterval(devCheck);
    }
  }, 1500);

  // Blur overlay — show when window loses focus
  let blurOverlay = document.getElementById('_amc_blur');
  if (!blurOverlay) {
    blurOverlay = document.createElement('div');
    blurOverlay.id = '_amc_blur';
    blurOverlay.innerHTML =
      '<div style="font-size:40px;">🔒</div>' +
      '<div style="font-size:14px;font-weight:600;color:#18171A;">Sesión en pausa</div>' +
      '<div style="font-size:13px;">Regrese a esta pestaña para continuar</div>';
    document.body.insertBefore(blurOverlay, document.body.firstChild);
  }

  const onBlur = () => { blurOverlay?.classList.add('visible'); };
  const onFocus = () => { blurOverlay?.classList.remove('visible'); };
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  // Cleanup function
  return () => {
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('selectstart', onSelectStart);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    clearInterval(devCheck);
  };
}
