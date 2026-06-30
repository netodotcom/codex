// omnibar — self-injected GUIDE-mode styles (migrated verbatim from omnibar.jsx).
// Idempotent <style id="cx-omni-guide-css"> appended to <head> on first mount;
// styles.css is owned by a parallel build right now (same pattern as
// constellation.jsx). The .cx-omni-* layout/list classes themselves live in
// styles.css — only the v11.4 guide additions are carried here.
export const OMNI_GUIDE_CSS = `
    .cx-omni-firstline { font-family: var(--cx-serif, Georgia, serif); font-style: italic;
      font-size: 14.5px; line-height: 1.4; color: var(--cx-fg, #e8e4da); opacity: .92;
      padding: 12px 18px 2px; }
    .cx-omni-guide-cap { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px;
      letter-spacing: .16em; text-transform: uppercase; color: var(--cx-fg-dim, #8a8578);
      padding: 10px 18px 0; }
    .cx-omni-row.is-guide .cx-omni-row-txt b { font-family: var(--cx-mono, ui-monospace, monospace);
      font-weight: 600; letter-spacing: .01em; }
    .cx-omni-row.is-guide .cx-omni-row-icon { opacity: .75; }
  `;

// Self-injected styles — idempotent <style id>; styles.css is owned by a
// parallel build right now (same pattern as constellation.jsx).
export function omniInjectGuideCss(): void {
  if (document.getElementById("cx-omni-guide-css")) return;
  const el = document.createElement("style");
  el.id = "cx-omni-guide-css";
  el.textContent = OMNI_GUIDE_CSS;
  document.head.appendChild(el);
}
