// reader (soul) — self-injected CSS (migrated verbatim from reader.jsx).
// Idempotent <style id="cxr-soul-style"> appended to <head>. styles.css is owned
// by a parallel build, so the reader's soul carries its own skin.
export const CXR_SOUL_CSS = `
/* ── chapter title — the AI page title returns (serif, serene) ── */
.cxr-title { padding: 26px 12px 14px; text-align: center; }
.cxr-title-main {
  margin: 0; font-weight: 500; font-size: 1.35em; line-height: 1.25;
  font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  letter-spacing: 0.02em; color: var(--cx-fg, inherit);
}
.cxr-title-sub {
  margin: 6px 0 0; min-height: 1.2em; font-size: 0.62em;
  letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.5;
}
.cxr-title.is-arrived .cxr-title-main { animation: cxr-title-in 1.4s ease-out both; }
@keyframes cxr-title-in {
  0%   { opacity: 0; filter: brightness(1.8) blur(1px); letter-spacing: 0.07em; }
  60%  { opacity: 1; filter: brightness(1.25) blur(0); }
  100% { opacity: 1; filter: none; letter-spacing: 0.02em; }
}
@media (prefers-reduced-motion: reduce) {
  .cxr-title.is-arrived .cxr-title-main { animation: cxr-title-fade .5s ease both; }
}
@keyframes cxr-title-fade { from { opacity: 0; } to { opacity: 1; } }

/* ── the golden Name — covenant gold, barely-there glow ── */
.cxr-name {
  color: #ffd479;
  text-shadow: 0 0 12px rgba(255, 212, 121, 0.28);
}
.cx-app.is-light .cxr-name {
  color: #8a6116;
  text-shadow: 0 0 8px rgba(212, 168, 95, 0.30);
}
.cxr-name-yhwh {
  font-family: "SBL Hebrew", "Ezra SIL", "Times New Roman", serif;
  unicode-bidi: isolate; font-style: normal; padding: 0 0.06em;
}
.cxr-v.is-red .cxr-name { text-shadow: 0 0 10px rgba(255, 212, 121, 0.35); }

/* ── overlay chips in the bar ── */
.cxr-ovs { display: inline-flex; align-items: center; gap: 4px; }
.cxr-chip-ov { min-width: 26px; padding: 2px 7px; opacity: 0.55; }
.cxr-chip-ov.is-on { opacity: 1; }
.cxr-chip-ov.is-gnosis.is-on { color: #b88cff; border-color: #b88cff55; text-shadow: 0 0 8px #b88cff44; }
.cxr-chip-ov.is-talmud.is-on { color: #ffd479; border-color: #ffd47955; text-shadow: 0 0 8px #ffd47944; }
.cxr-chip-ov.is-comm.is-on   { color: #7ee0ff; border-color: #7ee0ff55; text-shadow: 0 0 8px #7ee0ff44; }

/* ── the glosses — whispers, never shouts ── */
.cxr-gloss {
  margin: 2px 6px 12px 44px; padding: 5px 10px 5px 12px;
  border-left: 2px solid; border-radius: 0 6px 6px 0;
  font-size: 0.76em; line-height: 1.5; opacity: 0.72; cursor: pointer;
  background: color-mix(in oklab, currentColor 3%, transparent);
  transition: opacity 0.25s ease;
}
.cxr-gloss:hover, .cxr-gloss:focus-visible { opacity: 1; outline: none; }
.cxr-gloss.is-open { opacity: 0.95; }
.cxr-gloss.is-gnosis { border-color: #b88cff; color: color-mix(in oklab, #b88cff 55%, var(--cx-fg, #ccc)); }
.cxr-gloss.is-talmud { border-color: #ffd479; color: color-mix(in oklab, #ffd479 55%, var(--cx-fg, #ccc)); }
.cxr-gloss.is-comm   { border-color: #7ee0ff; color: color-mix(in oklab, #7ee0ff 55%, var(--cx-fg, #ccc)); }
.cxr-gloss-h { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.cxr-gloss-h i { flex: none; font-style: normal; opacity: 0.9; }
.cxr-gloss-h b { font-weight: 500; font-family: Georgia, serif; letter-spacing: 0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cxr-gloss-h em { flex: none; margin-left: auto; font-style: normal; font-size: 0.85em;
  letter-spacing: 0.08em; opacity: 0.6; }
.cxr-gloss-body {
  margin-top: 6px; font-family: Georgia, serif; font-size: 1.04em;
  color: var(--cx-fg, inherit); opacity: 0.92; white-space: pre-line;
}
.cxr-gloss-tag { display: block; margin-top: 5px; font-family: ui-monospace, monospace;
  font-size: 0.82em; letter-spacing: 0.06em; opacity: 0.6; }
.cxr-glosses-ch { margin: 0 6px 6px; }
.cxr-glosses-ch .cxr-gloss { margin-left: 12px; }

/* ── tiny inline orb while a layer generates ── */
.cxr-orb {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: currentColor; opacity: 0.6; flex: none;
  animation: cxr-orb 1.4s ease-in-out infinite;
}
@keyframes cxr-orb { 0%, 100% { transform: scale(0.7); opacity: 0.35; } 50% { transform: scale(1); opacity: 0.8; } }
@media (prefers-reduced-motion: reduce) { .cxr-orb { animation: none; } }
.cxr-gloss-wait {
  display: flex; align-items: center; gap: 8px; margin: 0 6px 10px 44px;
  font-size: 0.72em; letter-spacing: 0.1em; opacity: 0.55;
}

/* ── ⧉ secondary-reader spawner (reader window header) ── */
.cxr-spawn { position: relative; display: inline-flex; }
.cxr-spawn-btn {
  background: none; border: 0; color: inherit; opacity: 0.55; cursor: pointer;
  font-size: 13px; padding: 2px 6px; line-height: 1;
}
.cxr-spawn-btn:hover { opacity: 1; }
.cxr-spawn-pop {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 60;
  min-width: 240px; padding: 6px;
  background: var(--cx-bg2, #10151c); border: 1px solid var(--cx-line, #2a3442);
  border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.45);
  display: flex; flex-direction: column; gap: 2px;
}
.cx-app.is-light .cxr-spawn-pop { background: #faf6ec; border-color: #d8cfba; }
.cxr-spawn-pop button {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  background: none; border: 0; color: inherit; cursor: pointer;
  padding: 7px 9px; border-radius: 6px; text-align: left; font: inherit;
}
.cxr-spawn-pop button:hover { background: color-mix(in oklab, currentColor 8%, transparent); }
.cxr-spawn-pop button b { font-size: 11px; letter-spacing: 0.08em; }
.cxr-spawn-pop button span { font-size: 10px; opacity: 0.6; }
`;

export function cxrInjectSoulCss(): void {
  try {
    if (typeof document === "undefined" || document.getElementById("cxr-soul-style")) return;
    const s = document.createElement("style");
    s.id = "cxr-soul-style";
    s.textContent = CXR_SOUL_CSS;
    document.head.appendChild(s);
  } catch { /* no document — ignore */ }
}
