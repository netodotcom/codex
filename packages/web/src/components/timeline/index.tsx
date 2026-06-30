// timeline — migrated feature entry (Backlog 4.5). Replaces dist/timeline.js in
// the Vite build (gen-web-entry maps it). Exposes window.CODEX_Timeline (same
// surface as v1 — engines outlive skins) and self-registers as a CODEX plugin
// via window.CODEX_PLUGINS_API, exactly as the legacy IIFE did.
import React from "react";
import { TimelinePanel } from "./TimelinePanel.js";
import { loadEvents, ERAS, CATEGORIES } from "./data.js";

interface PluginPanel {
  id: string;
  label: string;
  glyph: string;
  icon: string;
  render: (ctx: Record<string, unknown>) => React.ReactElement;
}
interface PluginsApi {
  register(plugin: { id: string; name: string; version: string; panels: PluginPanel[] }): void;
}
interface TimelineExportWindow {
  CODEX_Timeline?: { TimelinePanel: typeof TimelinePanel; loadEvents: typeof loadEvents; ERAS: typeof ERAS; CATEGORIES: typeof CATEGORIES };
  CODEX_PLUGINS_API?: PluginsApi;
}
function tew(): TimelineExportWindow {
  return window as unknown as TimelineExportWindow;
}

// Expose for reuse (same surface as v1 — engines outlive skins).
tew().CODEX_Timeline = { TimelinePanel, loadEvents, ERAS, CATEGORIES };

function registerPlugin(): void {
  if (!tew().CODEX_PLUGINS_API) {
    window.addEventListener("load", registerPlugin, { once: true });
    return;
  }
  try {
    tew().CODEX_PLUGINS_API?.register({
      id: "biblical-timeline",
      name: "Biblical Timeline",
      version: "2.0.0",
      panels: [
        {
          id: "timeline",
          label: "TIMELINE",
          glyph: "⏳",
          icon: "⏳",
          render: (ctx) => React.createElement(TimelinePanel, (ctx || {}) as Record<string, never>),
        },
      ],
    });
  } catch (e) {
    console.warn("[timeline] plugin registration failed:", e);
  }
}
registerPlugin();
