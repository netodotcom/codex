// artifacts — self-injected CSS (migrated VERBATIM from artifacts.jsx). The
// idempotent <style id="cx-artifacts-css"> is appended to <head> on first
// renderer mount and on first AI-busy orb render; styles.css is owned by a
// parallel build, so the engine carries its own skin. artEnsureCss keeps the
// legacy name (it is part of the public surface as CODEX_ARTIFACTS.ensureCss).
export const ARTIFACTS_CSS = `
    .cx-art { font-size: inherit; line-height: 1.55; color: var(--cx-fg, #c9d4dc); overflow-wrap: break-word; }
    .cx-art p { margin: 0 0 8px; }
    .cx-art p:last-child { margin-bottom: 0; }
    .cx-art .cx-art-h { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); letter-spacing: 0.08em;
      color: var(--cx-accent, #7ee0ff); margin: 10px 0 6px; font-weight: 600; }
    .cx-art .cx-art-h.is-1 { font-size: 1.15em; } .cx-art .cx-art-h.is-2 { font-size: 1.06em; }
    .cx-art .cx-art-h.is-3, .cx-art .cx-art-h.is-4 { font-size: 0.96em; opacity: 0.92; }
    .cx-art ul, .cx-art ol { margin: 0 0 8px; padding-left: 20px; }
    .cx-art li { margin: 2px 0; }
    .cx-art blockquote { margin: 6px 0 8px; padding: 4px 10px; border-left: 2px solid var(--cx-accent, #7ee0ff);
      opacity: 0.92; font-style: italic; }
    .cx-art hr { border: none; border-top: 1px solid var(--cx-line, rgba(126,224,255,0.18)); margin: 10px 0; }
    .cx-art code.cx-art-code-i { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.88em;
      background: var(--cx-bg-2, rgba(126,224,255,0.08)); border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 3px; padding: 0 4px; }
    .cx-art pre.cx-art-code { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.85em;
      background: var(--cx-bg-2, rgba(8,12,18,0.6)); border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 4px; padding: 8px 10px; overflow-x: auto; margin: 6px 0 8px; white-space: pre-wrap; }
    .cx-art .cx-red { color: var(--cx-red, #ff8291); }
    .cx-art .cx-divine { color: var(--cx-accent, #7ee0ff); text-shadow: 0 0 8px rgba(126,224,255,0.35); }
    /* table */
    .cx-art table.cx-art-table { border-collapse: collapse; margin: 6px 0 10px; width: 100%; font-size: 0.92em; }
    .cx-art table.cx-art-table th { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 0.82em;
      letter-spacing: 0.08em; text-align: left; color: var(--cx-accent, #7ee0ff);
      border-bottom: 1px solid var(--cx-accent, #7ee0ff); padding: 4px 8px 4px 0; }
    .cx-art table.cx-art-table td { padding: 4px 8px 4px 0; border-bottom: 1px solid var(--cx-line, rgba(126,224,255,0.12)); vertical-align: top; }
    /* scripture ref chip */
    .cx-art-ref { display: inline; font: inherit; color: var(--cx-accent, #7ee0ff); background: none; border: none;
      border-bottom: 1px dotted var(--cx-accent, #7ee0ff); padding: 0; margin: 0; cursor: pointer; }
    .cx-art-ref:hover, .cx-art-ref:focus-visible { background: rgba(126,224,255,0.12); outline: none; }
    .cx-art-ref:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); border-radius: 2px; }
    .cx-art-ref-pop { position: fixed; z-index: 100001; width: 280px; max-height: 150px; overflow: hidden;
      background: var(--cx-bg, #0a0f16); border: 1px solid var(--cx-accent, #7ee0ff); border-radius: 5px;
      padding: 8px 10px; box-shadow: 0 8px 28px rgba(0,0,0,0.55); display: block; }
    .cx-art-ref-pop-h { display: block; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      letter-spacing: 0.1em; color: var(--cx-accent, #7ee0ff); margin-bottom: 4px; }
    .cx-art-ref-pop-b { display: block; font-family: var(--cx-serif, Georgia, serif); font-size: 12.5px;
      line-height: 1.5; color: var(--cx-fg, #c9d4dc); }
    .cx-art-ref-pop-b sup { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 8.5px;
      color: var(--cx-accent, #7ee0ff); margin-right: 3px; }
    /* directive: buttons */
    .cx-art-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .cx-art-btn { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 10px; letter-spacing: 0.08em;
      color: var(--cx-accent, #7ee0ff); background: rgba(126,224,255,0.06); border: 1px solid var(--cx-accent, #7ee0ff);
      border-radius: 4px; padding: 5px 10px; cursor: pointer; }
    .cx-art-btn:hover, .cx-art-btn:focus-visible { background: rgba(126,224,255,0.18); outline: none; }
    .cx-art-btn:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
    /* directive: charts + flow */
    .cx-art-chart, .cx-art-flow { margin: 8px 0 10px; border: 1px solid var(--cx-line, rgba(126,224,255,0.16));
      border-radius: 5px; padding: 8px; background: var(--cx-bg-2, rgba(8,12,18,0.4)); overflow-x: auto; }
    .cx-art-chart-title { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      letter-spacing: 0.12em; color: var(--cx-fg-dim, #8a98a8); margin: 0 0 6px; text-transform: uppercase; }
    .cx-art-chart svg, .cx-art-flow svg { display: block; max-width: 100%; height: auto; }
    .cx-art-chart text, .cx-art-flow text { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); }
    /* directive: verse grid */
    .cx-art-vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin: 8px 0 10px; }
    .cx-art-vcard { text-align: left; background: var(--cx-bg-2, rgba(8,12,18,0.45)); color: inherit;
      border: 1px solid var(--cx-line, rgba(126,224,255,0.18)); border-radius: 5px; padding: 8px 10px; cursor: pointer; }
    .cx-art-vcard:hover, .cx-art-vcard:focus-visible { border-color: var(--cx-accent, #7ee0ff); outline: none; }
    .cx-art-vcard:focus-visible { box-shadow: 0 0 0 2px rgba(126,224,255,0.5); }
    .cx-art-vcard-ref { display: block; font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9px;
      letter-spacing: 0.12em; color: var(--cx-accent, #7ee0ff); margin-bottom: 4px; }
    .cx-art-vcard-txt { display: block; font-family: var(--cx-serif, Georgia, serif); font-size: 12.5px;
      line-height: 1.55; color: var(--cx-fg, #c9d4dc); }
    .cx-art-vcard-txt.is-dim { opacity: 0.6; font-style: italic; }
    /* unparsable directive — honest, never silent */
    .cx-art-broken { font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px;
      color: var(--cx-fg-dim, #8a98a8); border: 1px dashed var(--cx-line, rgba(126,224,255,0.25));
      border-radius: 4px; padding: 6px 8px; margin: 6px 0; }
    /* ── AI-busy orb ── */
    #cx-ai-orb { position: fixed; right: 18px; bottom: 78px; z-index: 100000;
      display: flex; align-items: center; flex-direction: row-reverse; gap: 8px; }
    #cx-ai-orb .cx-ai-orb-core { width: 14px; height: 14px; border-radius: 50%; flex: none;
      background: radial-gradient(circle, var(--cx-accent, #7ee0ff) 0%, rgba(126,224,255,0.4) 55%, transparent 78%);
      box-shadow: 0 0 14px 3px rgba(126,224,255,0.35);
      animation: cx-ai-orb-pulse 1.5s ease-in-out infinite; }
    #cx-ai-orb .cx-ai-orb-lbl { opacity: 0; pointer-events: none; transition: opacity 0.18s ease;
      font-family: var(--cx-mono, ui-monospace, Menlo, monospace); font-size: 9.5px; letter-spacing: 0.12em;
      color: var(--cx-fg, #c9d4dc); background: var(--cx-bg, rgba(6,10,16,0.95));
      border: 1px solid var(--cx-line, rgba(126,224,255,0.3)); border-radius: 4px; padding: 3px 8px; white-space: nowrap; }
    #cx-ai-orb:hover .cx-ai-orb-lbl, #cx-ai-orb:focus .cx-ai-orb-lbl, #cx-ai-orb:focus-within .cx-ai-orb-lbl { opacity: 1; }
    @keyframes cx-ai-orb-pulse { 0%,100% { transform: scale(0.72); opacity: 0.55; } 50% { transform: scale(1.18); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      #cx-ai-orb .cx-ai-orb-core { animation: none; opacity: 0.95; }
    }
  `;

// Idempotent self-injection (same id pattern as the legacy artEnsureCss).
export function artEnsureCss(): void {
  if (typeof document === "undefined" || document.getElementById("cx-artifacts-css")) return;
  const el = document.createElement("style");
  el.id = "cx-artifacts-css";
  el.textContent = ARTIFACTS_CSS;
  document.head.appendChild(el);
}
