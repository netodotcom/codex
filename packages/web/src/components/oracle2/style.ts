// oracle2 — self-injected CSS (migrated verbatim from oracle2.jsx). Idempotent
// <style id="cxo2-css"> appended to <head> on first OracleX mount. These are the
// v11 additions (tabs, tool chips); the base .cxo-* classes live in styles.css.

export const ORACLE2_CSS = `
      .cxo2-tabs { display: flex; align-items: stretch; gap: 2px; padding: 3px 6px 0; overflow-x: auto;
        border-bottom: 1px solid var(--cx-line, rgba(126,224,255,0.14)); flex: none; }
      .cxo2-tab { display: inline-flex; align-items: center; gap: 6px; max-width: 160px; flex: none;
        font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9px; letter-spacing: 0.08em;
        color: var(--cx-fg-dim, #8a98a8); background: none; border: 1px solid transparent; border-bottom: none;
        border-radius: 5px 5px 0 0; padding: 4px 8px; cursor: pointer; white-space: nowrap; }
      .cxo2-tab.is-active { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-line, rgba(126,224,255,0.22));
        background: rgba(126,224,255,0.06); }
      .cxo2-tab:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
      .cxo2-tab-lbl { overflow: hidden; text-overflow: ellipsis; }
      .cxo2-tab-x { opacity: 0.55; padding: 0 1px; }
      .cxo2-tab-x:hover { opacity: 1; color: var(--cx-red, #ff8291); }
      .cxo2-tab-new { flex: none; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 11px;
        color: var(--cx-accent, #7ee0ff); background: none; border: none; padding: 2px 8px; cursor: pointer; }
      .cxo2-tab-new:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 4px; }
      .cxo2-tools { margin-left: auto; flex: none; font-family: var(--cx-mono, ui-monospace, Menlo, monospace);
        font-size: 8.5px; letter-spacing: 0.1em; border: 1px solid var(--cx-line, rgba(126,224,255,0.25));
        border-radius: 4px; background: none; color: var(--cx-fg-dim, #8a98a8); padding: 3px 7px; cursor: pointer; }
      .cxo2-tools.is-on { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff);
        background: rgba(126,224,255,0.07); }
      .cxo2-tools:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
      .cxo2-toolchip { display: flex; align-items: baseline; gap: 7px; margin: 4px 0;
        font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; line-height: 1.5;
        color: var(--cx-fg-dim, #8a98a8); }
      .cxo2-toolchip b { flex: none; color: var(--cx-accent, #7ee0ff); font-weight: 600; letter-spacing: 0.08em; }
      .cxo2-toolchip.is-failed b { color: var(--cx-red, #ff8291); }
      .cxo2-toolchip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;

export function injectCSS(): void {
  if (document.getElementById("cxo2-css")) return;
  const el = document.createElement("style");
  el.id = "cxo2-css";
  el.textContent = ORACLE2_CSS;
  document.head.appendChild(el);
}
