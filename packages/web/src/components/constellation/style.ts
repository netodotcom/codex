// constellation — self-injected dossier-text CSS (migrated verbatim from
// constellation.jsx). Idempotent <style id="cx-const-text-css"> appended to
// <head> on first component mount instead of styles.css, "because a parallel
// build owns that file right now." (The rest of the constellation chrome —
// cx-const-backdrop, cx-const, cx-corner, etc. — lives in styles.css and is
// NOT injected here.)
export const CONST_TEXT_CSS = `
      .cx-const-info-text { margin: 8px 0 4px; max-height: 240px; overflow-y: auto; padding-right: 4px; }
      .cx-const-info-text p { font-family: var(--cx-serif, Georgia, serif); font-size: 13px; line-height: 1.55; color: var(--cx-fg); margin: 0 0 6px; }
      .cx-const-info-text p sup { font-family: var(--cx-mono); font-size: 8.5px; color: var(--cx-accent); margin-right: 5px; opacity: 0.8; }
      .cx-const-info-more, .cx-const-info-src { font-family: var(--cx-mono) !important; font-size: 9.5px !important; letter-spacing: 0.08em; color: var(--cx-fg-dim) !important; }
      .cx-const-info-text.is-loading { display: flex; align-items: center; gap: 8px; font-family: var(--cx-mono); font-size: 9.5px; letter-spacing: 0.12em; color: var(--cx-fg-dim); }
      .cx-const-orb { width: 10px; height: 10px; border-radius: 50%; flex: none;
        background: radial-gradient(circle, var(--cx-accent) 0%, color-mix(in oklab, var(--cx-accent) 40%, transparent) 60%, transparent 100%);
        animation: cx-orb-pulse 1.1s ease-in-out infinite; }
      @keyframes cx-orb-pulse { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .cx-const-orb { animation: none; opacity: 0.9; } }
      .cx-const-trailchip { position: absolute; left: 14px; bottom: 14px; z-index: 5;
        font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.12em;
        color: #ffd479; background: rgba(20, 16, 8, 0.55); border: 1px solid rgba(255, 212, 121, 0.45);
        border-radius: 999px; padding: 4px 10px; cursor: pointer; }
      .cx-const-trailchip:hover { background: rgba(255, 212, 121, 0.16); }
    `;

// Idempotent injection — one tag, same id as the legacy useEffect.
export function injectTextCSS(): void {
  if (document.getElementById("cx-const-text-css")) return;
  const el = document.createElement("style");
  el.id = "cx-const-text-css";
  el.textContent = CONST_TEXT_CSS;
  document.head.appendChild(el);
}
