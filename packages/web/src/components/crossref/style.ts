// crossref — self-injected CSS (migrated verbatim from crossref.jsx). One
// idempotent <style id="cx-xref-graph-css"> appended to <head> on first panel
// mount instead of styles.css, because a parallel build owns that file right
// now. The string is byte-for-byte the legacy template (the same ${SERIF_FONT}
// interpolation), so the rendered skin is unchanged.
import { SERIF_FONT } from "./helpers.js";

export const XREF_CSS = `
        .cx-xrefg { padding: 8px 10px 12px; color: var(--cx-fg, #c9d4dc); font-family: var(--cx-font-ui, ui-sans-serif, system-ui); font-size: 12px; line-height: 1.5; }
        .cx-xrefg-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-bottom: 6px; border-bottom: 1px solid var(--cx-rule, rgba(126,224,255,0.16)); }
        .cx-xrefg-counts { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.72; }
        .cx-xrefg-stage { position: relative; width: 100%; height: 264px; }
        @media (max-width: 880px) { .cx-xrefg-stage { height: 200px; } }
        .cx-xrefg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-y pinch-zoom; }
        .cx-xrefg-trail { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; }
        .cx-xrefg-chip { background: transparent; border: 1px solid var(--cx-rule, rgba(126,224,255,0.22)); color: var(--cx-fg, #c9d4dc); font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.06em; padding: 1px 7px; border-radius: 9px; cursor: pointer; line-height: 1.6; }
        .cx-xrefg-chip[aria-pressed="true"] { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff); }
        .cx-xrefg-crumb.is-current { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff); cursor: default; }
        .cx-xrefg-crumb-sep { opacity: 0.45; font-size: 9px; }
        .cx-xrefg-text { margin: 8px 2px 2px; font-family: var(--cx-serif, ${SERIF_FONT}); font-size: 13.5px; line-height: 1.62; }
        .cx-xrefg-text sup { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 8.5px; color: var(--cx-accent, #7ee0ff); margin-right: 5px; opacity: 0.8; }
        .cx-xrefg-readout { margin-top: 8px; padding-top: 6px; border-top: 1px dotted var(--cx-rule, rgba(126,224,255,0.18)); min-height: 30px; }
        .cx-xrefg-ro-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cx-xrefg-ro-ref { font-family: var(--cx-font-mono, ui-monospace, monospace); font-weight: 600; font-size: 11px; }
        .cx-xrefg-ro-theme { font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
        .cx-xrefg-ro-snip { margin-top: 3px; font-style: italic; font-size: 12px; opacity: 0.85; }
        .cx-xrefg-hint { opacity: 0.5; font-size: 10.5px; letter-spacing: 0.03em; }
        /* keyboard mirror of the graph — visually hidden, revealed on focus */
        .cx-xrefg-alist { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: 0; padding: 0; list-style: none; }
        .cx-xrefg-alist:focus-within { position: static; width: auto; height: auto; clip-path: none; white-space: normal; display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0 0; max-height: 120px; overflow-y: auto; }
        .cx-xrefg-alist li { display: inline-block; }
        .cx-xrefg-foot { margin-top: 10px; padding-top: 6px; border-top: 1px solid var(--cx-rule, rgba(126,224,255,0.12)); font-family: var(--cx-font-mono, ui-monospace, monospace); font-size: 9px; opacity: 0.55; letter-spacing: 0.05em; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      `;

export function injectCSS(): void {
  if (document.getElementById("cx-xref-graph-css")) return;
  const el = document.createElement("style");
  el.id = "cx-xref-graph-css";
  el.textContent = XREF_CSS;
  document.head.appendChild(el);
}
