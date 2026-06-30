// Engagement — entry point. Replaces legacy/engagement.js.
// Assigns window.CODEX_ENGAGE, window.CODEX_ENGAGEMENT, and
// (if not already set) window.CODEX_QUESTGEN at import time,
// preserving the exact load-time order and guarded assignment of
// the legacy IIFEs.
import { CODEX_ENGAGE_API } from "./helpers-engage.js";
import {
  CODEX_ENGAGEMENT_API,
  buildCodexQuestgen,
  registerQuestModule,
} from "./helpers-engagement.js";
import { ew } from "./engagement-window.js";

// ── CODEX_ENGAGE (Hook-Model Engine) — assigned unconditionally. ───────────────
ew().CODEX_ENGAGE = CODEX_ENGAGE_API;

// ── CODEX_ENGAGEMENT (Continuity & Mastery Engine) — assigned unconditionally. ─
ew().CODEX_ENGAGEMENT = CODEX_ENGAGEMENT_API;

// ── CODEX_QUESTGEN — ONLY assigned if not already set (guarded, legacy: ─────────
// `if (typeof window !== "undefined" && !window.CODEX_QUESTGEN)`).
// NOTE: preserved from legacy — the guard is intentional so a later AI agent
// can pre-install its own generate() implementation before this engine loads.
if (!ew().CODEX_QUESTGEN) {
  ew().CODEX_QUESTGEN = buildCodexQuestgen(registerQuestModule);
}
