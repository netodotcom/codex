// wm — entry. Sets window.__CXWM at import time, exactly as
// legacy/wm.js. Replaces that IIFE in the Vite build (gen-web-entry maps it).
//
// Side-effects are installed in the same order as the original IIFE:
//   1. Guard check (idempotency) + window.__CXWM = true
//   2. window.codexArrange = { layout, save, recall, list }
//   3. window "codex:os7" → dockRender (OS·7 mode flips re-render the dock)
//   4. window "codex:desk" → dockRender (desk window opens/closes re-render chips)
//   5. window "codex:desk-panels" → dockRender (builtin panel open/close)
//   6. window "codex:now" → debounced dockRender (verse cursor moves)
//   7. boot(): mo.observe + scan + dockRender immediately, or deferred to DOMContentLoaded

import {
  applyLayout,
  captureSetup,
  recallSetup,
  loadLayouts,
  dockRender,
  boot,
} from "./helpers.js";
import { ww } from "./wm-window.js";

// NOTE: preserved from legacy — idempotency guard. ESM deduplicates module
// evaluation, but window.__CXWM is still set so that external observers
// (e.g., the orchestrator parity probe) can verify the WM has booted.
if (!ww().__CXWM) {
  ww().__CXWM = true;

  // Public arrange API — the omnibar / keyboard can drive it too.
  ww().codexArrange = { layout: applyLayout, save: captureSetup, recall: recallSetup, list: loadLayouts };

  // OS·7 mode flips (shell.js) re-render the dock so launchers appear/retire.
  window.addEventListener("codex:os7", function (): void { dockRender(); });
  // Desk window opens/closes (app.jsx codexDesk) re-render the LIB/READER
  // chips so their active state tracks the desk.
  window.addEventListener("codex:desk", function (): void { dockRender(); });
  // v11 — builtin panel windows open/close (app.jsx codexDeskPanels)
  // re-render their chips' lit state the same way.
  window.addEventListener("codex:desk-panels", function (): void { dockRender(); });

  // Verse cursor moves (app.jsx 'codex:now') re-render the action chips so
  // titles track the current ref and CONTINUE appears after boot without a
  // reload. Debounced — J/K scrubbing fires this on every landed verse.
  let dockNowTimer = 0;
  window.addEventListener("codex:now", function (): void {
    // NOTE: preserved from legacy — os7 gate: no-op when launcher is off.
    if (!document.body?.classList.contains("cx-os7")) return;
    clearTimeout(dockNowTimer);
    dockNowTimer = window.setTimeout(function (): void {
      try { dockRender(); } catch (_) {}
    }, 250);
  });

  const bootFn = (): void => { boot(); };
  if (document.body) {
    bootFn();
  } else {
    document.addEventListener("DOMContentLoaded", bootFn, { once: true });
  }
}
