// timeline — self-injected CSS (migrated verbatim from timeline.jsx). Idempotent
// <style id="cx-tl2-css"> appended to <head> on first panel mount; styles.css is
// owned by a parallel build, so the timeline carries its own skin.
export const TIMELINE_CSS = `
      .cx-tl2-root { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 360px; padding: 10px 12px 12px; box-sizing: border-box; font-family: var(--cx-sans, ui-sans-serif, system-ui); }
      .cx-tl2-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .cx-tl2-title { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 11px; letter-spacing: 0.18em; color: var(--cx-fg); font-weight: 700; }
      .cx-tl2-meta { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; color: var(--cx-fg-dim); }
      .cx-tl2-span-ro { margin-left: auto; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.1em; color: var(--cx-accent); white-space: nowrap; }
      .cx-tl2-search { background: transparent; border: 1px solid var(--cx-line); border-radius: 6px; color: var(--cx-fg); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; padding: 5px 8px; min-height: 28px; width: 130px; }
      .cx-tl2-search:focus { outline: none; border-color: var(--cx-accent); }
      .cx-tl2-chips { display: flex; gap: 4px; flex-wrap: wrap; }
      .cx-tl2-chip { background: transparent; border: 1px solid var(--cx-line); border-radius: 10px; color: var(--cx-fg-dim); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.06em; padding: 3px 8px; min-height: 24px; cursor: pointer; }
      .cx-tl2-chip.is-on { color: var(--cx-accent); border-color: var(--cx-accent); }
      @media (pointer: coarse) { .cx-tl2-chip { min-height: 44px; padding: 6px 12px; } .cx-tl2-search { min-height: 44px; } }

      /* the river */
      .cx-tl2-river { position: relative; flex: 1; min-height: 200px; overflow: hidden; border: 1px solid var(--cx-line); border-radius: 8px; background: linear-gradient(180deg, color-mix(in srgb, var(--cx-bg-2, #0a0e18) 70%, transparent), transparent 40%, color-mix(in srgb, var(--cx-bg-2, #0a0e18) 70%, transparent)); cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
      .cx-tl2-river.is-panning { cursor: grabbing; }
      .cx-tl2-strata { position: absolute; top: 0; bottom: 0; pointer-events: none; border-left: 1px solid transparent; border-right: 1px solid transparent; }
      .cx-tl2-strata-lbl { position: absolute; top: 6px; left: 8px; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.75; white-space: nowrap; }
      .cx-tl2-axis { position: absolute; left: 0; right: 0; top: 58%; height: 1px; background: var(--cx-line-strong, var(--cx-line)); pointer-events: none; }
      .cx-tl2-tick { position: absolute; top: 58%; width: 1px; height: 8px; background: var(--cx-line); transform: translateY(-4px); pointer-events: none; }
      .cx-tl2-tick-lbl { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.08em; color: var(--cx-fg-dim); white-space: nowrap; }
      .cx-tl2-river .cx-tl2-tick .cx-tl2-tick-lbl { top: 10px; }

      /* event nodes */
      .cx-tl2-ev { position: absolute; transform: translate(-50%, -50%); background: transparent; border: none; padding: 0; margin: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 44px; min-height: 44px; justify-content: center; z-index: 4; }
      .cx-tl2-ev-dot { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid; font-size: 9px; line-height: 1; color: var(--cx-bg, #06080e); box-shadow: 0 0 10px color-mix(in srgb, currentColor 0%, transparent); transition: transform 0.15s ease; }
      .cx-tl2-ev:hover .cx-tl2-ev-dot, .cx-tl2-ev:focus-visible .cx-tl2-ev-dot { transform: scale(1.25); }
      .cx-tl2-ev.is-sel .cx-tl2-ev-dot { outline: 2px solid var(--cx-accent); outline-offset: 2px; }
      .cx-tl2-ev.is-here .cx-tl2-ev-dot { outline: 2px solid var(--cx-accent-2, #ffc46b); outline-offset: 2px; }
      .cx-tl2-ev-stem { position: absolute; width: 1px; background: var(--cx-line); pointer-events: none; }
      .cx-tl2-ev-lbl { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.04em; color: var(--cx-fg); white-space: nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px var(--cx-bg, #06080e); }
      .cx-tl2-ev-yr { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 7.5px; color: var(--cx-fg-dim); white-space: nowrap; }
      .cx-tl2-cluster { position: absolute; transform: translate(-50%, -50%); min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: zoom-in; z-index: 5; padding: 0; }
      .cx-tl2-cluster-core { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px dashed var(--cx-accent); color: var(--cx-accent); background: color-mix(in srgb, var(--cx-accent) 12%, transparent); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; font-weight: 700; }
      .cx-tl2-cluster:hover .cx-tl2-cluster-core { background: color-mix(in srgb, var(--cx-accent) 24%, transparent); }

      /* NOW-READING gold marker */
      .cx-tl2-now { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--cx-accent-2, #ffc46b); pointer-events: none; z-index: 6; box-shadow: 0 0 8px color-mix(in srgb, var(--cx-accent-2, #ffc46b) 60%, transparent); }
      .cx-tl2-now-tag { position: absolute; top: 4px; transform: translateX(-50%); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.12em; color: var(--cx-accent-2, #ffc46b); background: color-mix(in srgb, var(--cx-bg, #06080e) 82%, transparent); border: 1px solid color-mix(in srgb, var(--cx-accent-2, #ffc46b) 50%, transparent); border-radius: 4px; padding: 2px 6px; white-space: nowrap; pointer-events: none; z-index: 7; }
      .cx-tl2-now-tag.is-edge { transform: none; }

      /* in-river detail card — never a modal */
      .cx-tl2-card { position: absolute; bottom: 10px; transform: translateX(-50%); width: min(320px, 86%); max-height: 62%; overflow-y: auto; background: var(--cx-panel-2, rgba(14,22,38,0.95)); border: 1px solid var(--cx-line-strong, var(--cx-line)); border-radius: 8px; padding: 10px 12px; z-index: 9; box-shadow: var(--cx-shadow, 0 8px 32px rgba(0,0,0,0.6)); cursor: auto; text-align: left; }
      .cx-tl2-card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .cx-tl2-card-era { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; border: 1px solid; border-radius: 4px; padding: 2px 6px; }
      .cx-tl2-card-cat { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.1em; color: var(--cx-fg-dim); }
      .cx-tl2-card-x { margin-left: auto; background: transparent; border: 1px solid var(--cx-line); border-radius: 6px; color: var(--cx-fg-dim); cursor: pointer; font-size: 12px; line-height: 1; padding: 4px 8px; min-width: 28px; min-height: 28px; }
      .cx-tl2-card-x:hover { color: var(--cx-fg); border-color: var(--cx-accent); }
      @media (pointer: coarse) { .cx-tl2-card-x { min-width: 44px; min-height: 44px; } }
      .cx-tl2-card-title { margin: 6px 0 2px; font-family: var(--cx-serif, Georgia, serif); font-size: 17px; font-weight: 600; color: var(--cx-fg); }
      .cx-tl2-card-year { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.08em; color: var(--cx-accent-2, #ffc46b); }
      .cx-tl2-card-sum { margin: 6px 0; font-family: var(--cx-serif, Georgia, serif); font-size: 13px; line-height: 1.5; color: var(--cx-fg); }
      .cx-tl2-card-refs { display: flex; gap: 5px; flex-wrap: wrap; margin: 6px 0 2px; }
      .cx-tl2-refchip { background: transparent; border: 1px solid color-mix(in srgb, var(--cx-accent) 50%, transparent); border-radius: 10px; color: var(--cx-accent); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.05em; padding: 4px 9px; min-height: 28px; cursor: pointer; }
      .cx-tl2-refchip:hover, .cx-tl2-refchip:focus-visible { background: color-mix(in srgb, var(--cx-accent) 16%, transparent); }
      @media (pointer: coarse) { .cx-tl2-refchip { min-height: 44px; padding: 8px 14px; } }
      .cx-tl2-card-meta { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; color: var(--cx-fg-dim); margin-top: 4px; letter-spacing: 0.04em; }
      .cx-tl2-card-honest { margin-top: 8px; padding-top: 6px; border-top: 1px dotted var(--cx-line); font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8px; letter-spacing: 0.1em; color: var(--cx-fg-dim); text-transform: uppercase; }

      /* minimap */
      .cx-tl2-mini { position: relative; height: 30px; flex: none; border: 1px solid var(--cx-line); border-radius: 6px; overflow: hidden; cursor: pointer; touch-action: pan-y; }
      @media (pointer: coarse) { .cx-tl2-mini { height: 44px; } }
      .cx-tl2-mini-band { position: absolute; top: 0; bottom: 0; pointer-events: none; }
      .cx-tl2-mini-dot { position: absolute; bottom: 4px; width: 2px; background: var(--cx-fg-dim); opacity: 0.65; pointer-events: none; }
      .cx-tl2-mini-win { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--cx-accent) 16%, transparent); border-left: 1px solid var(--cx-accent); border-right: 1px solid var(--cx-accent); pointer-events: none; }
      .cx-tl2-mini-now { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--cx-accent-2, #ffc46b); pointer-events: none; }

      .cx-tl2-hint { font-family: var(--cx-mono, ui-monospace, monospace); font-size: 8.5px; letter-spacing: 0.08em; color: var(--cx-fg-dim); text-align: center; }
      .cx-tl2-loading { display: flex; align-items: center; justify-content: center; gap: 10px; flex: 1; font-family: var(--cx-mono, ui-monospace, monospace); font-size: 10px; letter-spacing: 0.14em; color: var(--cx-fg-dim); }
      .cx-tl2-orb { width: 12px; height: 12px; border-radius: 50%; flex: none; background: radial-gradient(circle, var(--cx-accent) 0%, color-mix(in srgb, var(--cx-accent) 40%, transparent) 60%, transparent 100%); animation: cx-tl2-orb 1.1s ease-in-out infinite; }
      @keyframes cx-tl2-orb { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .cx-tl2-orb { animation: none; opacity: 0.9; }
        .cx-tl2-ev-dot { transition: none; }
      }
    `;

export function injectCSS(): void {
  if (document.getElementById("cx-tl2-css")) return;
  const el = document.createElement("style");
  el.id = "cx-tl2-css";
  el.textContent = TIMELINE_CSS;
  document.head.appendChild(el);
}
