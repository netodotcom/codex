// panels-gen — entry point. Replaces legacy/panels-gen.js.
// Assigns window.CODEX_PANELS, window.CODEX_PANELS_ENGINE, and
// window.CODEX_QUESTGEN at import time, preserving the exact load-time order
// and semantics of the legacy IIFE:
//   1. CODEX_PANELS set (all methods wired up).
//   2. CODEX_QUESTGEN installed with the `||` guard:
//      – namespace created only if absent/non-object.
//      – generate slot filled only if not already a function
//        (engagement.js may pre-install its own; we never clobber it).
import {
  cacheKey, getCached, getCachedMeta, putCached, purge, load, subscribe, cacheStats,
  loadExegesis, getExegesisCached, getExegesisMeta, purgeExegesis,
  loadTranslationAnalysis, getTxAnalysisCached, getTxAnalysisMeta, purgeTxAnalysis,
  loadDisarm, getDisarmCached, getDisarmMeta, purgeDisarm,
  generateQuest, getQuestGenCached, getQuestGenMeta, purgeQuestGen, fallbackQuest,
} from "./helpers.js";
import { pw } from "./panels-gen-window.js";

// ── CODEX_PANELS ───────────────────────────────────────────────────────────────
pw().CODEX_PANELS = {
  cacheKey, getCached, getCachedMeta, putCached, purge, load, subscribe, cacheStats,
  loadExegesis, getExegesisCached, getExegesisMeta, purgeExegesis,
  loadTranslationAnalysis, getTxAnalysisCached, getTxAnalysisMeta, purgeTxAnalysis,
  loadDisarm, getDisarmCached, getDisarmMeta, purgeDisarm,
  // AI quest generation (engagement questGenHook)
  generateQuest, getQuestGenCached, getQuestGenMeta, purgeQuestGen, fallbackQuest,
};

// ── CODEX_QUESTGEN (engagement contract) ──────────────────────────────────────
// Wire the generator into the engagement contract's reserved hook.
// Guarded so Lite mode / a missing engine never breaks: we only fill the
// `generate` slot (leaving `register`, supplied by engagement.js, intact),
// and we install a minimal namespace if the engine hasn't created one yet.
try {
  if (typeof window !== "undefined") {
    // NOTE: preserved from legacy — `||` guard: initialise only if falsy/non-object.
    if (!pw().CODEX_QUESTGEN || typeof pw().CODEX_QUESTGEN !== "object") {
      pw().CODEX_QUESTGEN = {};
    }
    // Only set generate if the engine left it null/absent — never clobber a
    // generator another agent may have already installed.
    const qg = pw().CODEX_QUESTGEN!;
    if (typeof qg["generate"] !== "function") {
      qg["generate"] = generateQuest;
    }
  }
} catch { /* ignore */ }
