// ops — self-injected CSS (migrated verbatim from ops.jsx). Idempotent
// <style id="cx-ops2-css"> appended to <head> on first component mount;
// the existing styles.css handles the outer shell; these rules cover only
// the v11 collapsible-result additions added inside the step feed.
export const OPS_CSS = `
    .cx-ops-ev.is-result details { margin: 0; }
    .cx-ops-ev.is-result summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 6px;
      font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; letter-spacing: 0.06em;
      color: var(--cx-fg-dim, #8a98a8); }
    .cx-ops-ev.is-result summary::-webkit-details-marker { display: none; }
    .cx-ops-ev.is-result summary::before { content: "▸"; color: var(--cx-accent, #7ee0ff); flex: none; }
    .cx-ops-ev.is-result details[open] summary::before { content: "▾"; }
    .cx-ops-ev.is-result summary:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 3px; }
    .cx-ops-ev.is-result .cx-ops-ev-gist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .cx-ops-ev.is-result.is-failed summary::before, .cx-ops-ev.is-result.is-failed .cx-ops-ev-gist { color: var(--cx-red, #ff8291); }
  `;

export function injectOpsCSS(): void {
  if (typeof document === "undefined" || document.getElementById("cx-ops2-css")) return;
  const el = document.createElement("style");
  el.id = "cx-ops2-css";
  el.textContent = OPS_CSS;
  document.head.appendChild(el);
}
