// quest-messiah — feature entry. Replaces legacy/deleted/dist/quest-messiah.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's
// load-time side effects: registers the quest in window.CODEX_QUESTS with the
// same double-registration guard used on hot-reload.
//
// Window globals SET by this module:
//   · window.CODEX_QUESTS  — array entry { id, glyph, title, blurb, run }
//
// Window globals READ by this module (via QuestRunner / helpers):
//   · window.CODEX_ENGAGEMENT  — optional engagement bridge
//   · window.codexJumpToRef    — optional reader navigation hook
//   · window.ReactDOM          — CDN ReactDOM (used only by launch())
import { QUEST_ID } from "./data.js";
import { launch } from "./QuestRunner.js";
import { qmw } from "./quest-messiah-window.js";

const entry = {
  id: QUEST_ID,
  glyph: "✦",
  title: "Messiah in Prophecy · 50 Core Prophecies",
  blurb: "Sequential study of OT prophecies and their NT fulfillments, with Talmudic references and ready-to-use debate refutations.",
  run: launch,
};

// Avoid double-registration on hot-reload (same guard as the legacy IIFE).
qmw().CODEX_QUESTS = qmw().CODEX_QUESTS ?? [];
const quests = qmw().CODEX_QUESTS!;
const existingIdx = quests.findIndex(q => q.id === QUEST_ID);
if (existingIdx >= 0) {
  quests[existingIdx] = entry;
} else {
  quests.push(entry);
}
