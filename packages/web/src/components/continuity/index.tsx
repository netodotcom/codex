// continuity — migrated feature entry. Replaces legacy/deleted/dist/continuity.js
// in the Vite build (gen-web-entry maps it). Re-exposes the SAME window global
// the legacy IIFE published (window.CODEX_CONTINUITY) so app.jsx keeps mounting
// <CODEX_CONTINUITY.Mount/>, and self-registers the ANALYST DESK rail panel via
// window.CODEX_PLUGINS_API exactly as the legacy did — running every module-load
// side-effect (LITE detection, namespace publish, plugin registration) on import.
import React from "react";
import { ContinuityMount, ContinuityIndicator, AnalystDossier, QuestList, QuestPlayer, NextThread } from "./ContinuityPanel.js";
import { LITE, t } from "./continuity-window.js";
import type { PluginsApi } from "./continuity-window.js";

interface ContinuityNamespace {
  Mount: typeof ContinuityMount;
  ContinuityIndicator: typeof ContinuityIndicator;
  AnalystDossier: typeof AnalystDossier;
  QuestList: typeof QuestList;
  QuestPlayer: typeof QuestPlayer;
  NextThread: typeof NextThread;
  lite: boolean;
}
interface IndexWindow {
  CODEX_CONTINUITY?: ContinuityNamespace;
  CODEX_PLUGINS_API?: PluginsApi;
}
function iw(): IndexWindow {
  return window as unknown as IndexWindow;
}

// ── Public surface for the host (app.jsx mounts <CODEX_CONTINUITY.Mount/>) ──
iw().CODEX_CONTINUITY = {
  Mount: ContinuityMount,
  ContinuityIndicator: ContinuityIndicator,
  AnalystDossier: AnalystDossier,
  QuestList: QuestList,
  QuestPlayer: QuestPlayer,
  NextThread: NextThread,
  lite: LITE,
};

// ── Plugin registration — the ANALYST DESK rail panel. Deferred if the plugin
//    API isn't ready yet. In Lite mode we still expose the namespace but skip
//    the heavy rail surface.
function registerPlugin(): void {
  if (LITE) return;
  if (!iw().CODEX_PLUGINS_API) {
    window.addEventListener("load", registerPlugin, { once: true });
    return;
  }
  try {
    iw().CODEX_PLUGINS_API?.register({
      id: "continuity",
      name: "Analyst Desk",
      version: "1.0.0",
      panels: [
        {
          id: "dossier",
          label: t("cx.dossier.title", "Analyst desk").toUpperCase(),
          glyph: "▦",
          icon: "▦",
          render: (ctx) => {
            // Engine absent → graceful empty (component handles it).
            return React.createElement(AnalystDossier, (ctx || {}) as Record<string, unknown>);
          },
        },
      ],
    });
  } catch (e) {
    // Never throw — registration failure must not brick the app.
    try {
      console.warn("[continuity] plugin registration failed:", e);
    } catch {
      /* ignore */
    }
  }
}
registerPlugin();
