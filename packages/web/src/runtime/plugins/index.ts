// CODEX Plugins — entry point. Replaces legacy/plugins.js.
// Assigns window.CODEX_PLUGINS (initializing if absent) and
// window.CODEX_PLUGINS_API at import time, then drains any pre-pushed entries,
// preserving the exact load-time order and timing of the legacy IIFE.
import {
  register, list, getPanels, getVerseActions,
  dispatch, onNavigate, onVerseSelect, adoptPreRegistered,
} from "./helpers.js";
import type { CodexPluginsApi } from "./types.js";
import { pw } from "./plugins-window.js";

// The array third-party scripts can push into directly:
//   <script>window.CODEX_PLUGINS.push({ id: "...", ... })</script>
// (We'll also wire register() to detect any pre-existing entries on boot.)
if (!Array.isArray(pw().CODEX_PLUGINS)) pw().CODEX_PLUGINS = [];

pw().CODEX_PLUGINS_API = {
  register, list, getPanels, getVerseActions,
  dispatch, onNavigate, onVerseSelect,
} satisfies CodexPluginsApi;

// If anything was pushed into CODEX_PLUGINS before the API loaded (or is
// pushed in by an inline script after this file but before app.jsx boots),
// adopt those entries on next microtask.
// NOTE: preserved from legacy — run once now (in case host pre-populated the
// array) and again at DOMContentLoaded for late inline scripts.
adoptPreRegistered();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", adoptPreRegistered, { once: true });
}
