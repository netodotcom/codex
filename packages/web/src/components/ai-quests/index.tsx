// ai-quests — migrated feature entry (Backlog 4.6). Replaces
// legacy/deleted/dist/ai-quests.js in the Vite build (gen-web-entry maps it).
// Reproduces the legacy IIFE's load-time side-effects verbatim:
//   · Self-registers as plugin "ai-quests" (panel "QUESTS", glyph "⚔") via
//     window.CODEX_PLUGINS_API, deferred to DOMContentLoaded if the API isn't
//     ready yet — identical control flow to v1.
//   · Pushes / updates the catalog entry in window.CODEX_QUESTS so the
//     existing ⚔ status-bar SideQuestsButton can surface "AI Study Quests".
//   · Sets window.CODEX_AI_QUESTS = { launchCatalog, launchRunner,
//     generateQuest, generateFeedback } — the exact same public surface.
import React from "react";
import { QuestPanel, launchCatalog, launchRunner } from "./QuestPanel.js";
import { generateQuest, generateFeedback } from "./api.js";
import { aqw } from "./ai-quests-window.js";

// ── Plugin registration ────────────────────────────────────────────────────────
function doRegister(): void {
  const api = aqw().CODEX_PLUGINS_API;
  if (api && typeof api.register === "function") {
    api.register({
      id: "ai-quests",
      name: "AI Study Quests",
      version: "1.0.0",
      panels: [
        {
          id: "quests",
          label: "QUESTS",
          glyph: "⚔",
          render: (): React.ReactElement => React.createElement(QuestPanel, null),
        },
      ],
    });
  }

  // Catalog entry for the existing ⚔ status-bar SideQuestsButton
  if (!aqw().CODEX_QUESTS) {
    aqw().CODEX_QUESTS = [];
  }
  const QUEST_ID = "ai-quests-catalog";
  const entry = {
    id: QUEST_ID,
    glyph: "⚔",
    title: "AI Study Quests · custom guided tours",
    blurb:
      "Describe any theme — get a 5-8 step scripture quest with questions, hints, and AI feedback at the end.",
    run: launchCatalog,
  };
  const catalog = aqw().CODEX_QUESTS!;
  const existing = catalog.findIndex((q) => q.id === QUEST_ID);
  if (existing >= 0) catalog[existing] = entry;
  else catalog.push(entry);

  // Public API for other modules
  aqw().CODEX_AI_QUESTS = {
    launchCatalog,
    launchRunner,
    generateQuest,
    generateFeedback,
  };
}

if (aqw().CODEX_PLUGINS_API) {
  doRegister();
} else {
  window.addEventListener("DOMContentLoaded", doRegister, { once: true });
}
