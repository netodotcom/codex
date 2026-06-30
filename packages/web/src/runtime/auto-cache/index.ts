// auto-cache — entry. Assigns window.CODEX_AUTOCACHE at import time and
// schedules the warm-up, exactly as legacy/auto-cache.js. Replaces that
// IIFE in the Vite build (gen-web-entry maps it).
import { loadFlag, saveFlag, warmUp, schedule, FLAG_LS } from "./helpers.js";
import { acw } from "./auto-cache-window.js";
import type { AutoCacheApi } from "./types.js";

const API: AutoCacheApi = {
  state: loadFlag,
  reset(): void {
    try {
      localStorage.removeItem(FLAG_LS);
    } catch {}
  },
  runNow(): Promise<void> {
    return warmUp();
  },
};

// NOTE: preserved from legacy — dual browser/Node guard (the IIFE only ever
// ran in a browser; this module may be imported in SSR or test environments).
if (typeof window !== "undefined") {
  acw().CODEX_AUTOCACHE = API;

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule);
}

export type { AutoCacheApi, AutoCacheFlag, BibleEngine, CodexDataSlice } from "./types.js";
