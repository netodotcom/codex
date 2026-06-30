// plans — migrated feature entry (Phase 2.1 · Reading Plans). Replaces
// dist/plans.js in the Vite build (gen-web-entry maps it). Re-exposes the exact
// window surface the legacy plans.jsx IIFE set on load and runs the same
// module-load side-effects:
//   · window.CODEX_Plans = { PlansPanel, loadPlan, parseReading }
//   · plugin "reading-plans" (panel "plans") registered via
//     window.CODEX_PLUGINS_API.register, deferred to window `load` if the API
//     isn't ready yet — identical control flow to v1.
//   · saved daily reminders re-armed 1.5s after registration (bootReminders).
import React from "react";
import { PlansPanel } from "./PlansPanel.js";
import { loadPlan } from "./data.js";
import { parseReading, bootReminders } from "./helpers.js";
import { pw } from "./plans-window.js";
import type { PlansPlugin } from "./plans-window.js";

// ── The frozen export contract (reuse / testing surface) ─────────────────────
pw().CODEX_Plans = { PlansPanel, loadPlan, parseReading };

// ── Plugin registration (unchanged contract from plans.jsx) ──────────────────
function registerPlugin(): void {
  const api = pw().CODEX_PLUGINS_API;
  if (!api) {
    window.addEventListener("load", registerPlugin, { once: true });
    return;
  }
  try {
    api.register({
      id: "reading-plans",
      name: "Reading Plans",
      version: "1.0.0",
      panels: [
        {
          id: "plans",
          label: "PLANS",
          glyph: "⥁",
          icon: "⥁",
          render: (ctx?: Record<string, unknown>) =>
            React.createElement(PlansPanel as React.FC<Record<string, unknown>>, ctx || {}),
        },
      ],
    } satisfies PlansPlugin);
    setTimeout(bootReminders, 1500);
  } catch (e) {
    console.warn("[plans] plugin registration failed:", e);
  }
}
registerPlugin();
