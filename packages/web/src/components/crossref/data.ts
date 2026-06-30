// crossref — the TSK module loader (migrated from crossref.jsx). One shared
// promise cache across panel mounts, fed by window.CODEX_MODULES. The lookup
// helper getCrossRefs() is part of the frozen export contract
// (window.CODEX_CrossRefLookup.getCrossRefs).
import { xw } from "./crossref-window.js";
import type { TskModule, TskRef, VerseRefInput } from "./crossref-window.js";

export const MODULE_ID = "tsk-sample";

// ── Module cache shared across panel mounts ───────────────────────────────
let _modPromise: Promise<TskModule> | null = null;
export function loadTsk(): Promise<TskModule> {
  if (_modPromise) return _modPromise;
  const mods = xw().CODEX_MODULES;
  if (!mods || typeof mods.loadModule !== "function") {
    return Promise.reject(new Error("CODEX_MODULES not available"));
  }
  _modPromise = mods.loadModule(MODULE_ID).catch((e) => {
    _modPromise = null;
    throw e;
  });
  return _modPromise;
}

// Lookup helper: Returns a Promise<[{ref,theme}|string]>.
export function getCrossRefs(verseRef: VerseRefInput): Promise<TskRef[]> {
  return loadTsk().then((mod) => {
    if (!mod || !mod.verses) return [];
    const key =
      typeof verseRef === "string"
        ? verseRef.toLowerCase()
        : verseRef && verseRef.bookId
          ? `${verseRef.bookId}.${verseRef.chapter}.${verseRef.verse || ""}`.replace(/\.$/, "")
          : "";
    return mod.verses[key] || [];
  });
}

// Test seam: reset the shared cache (the legacy closure had no reset; this is
// inert in production and only exercised by data.test.ts).
export function __resetTskCache(): void {
  _modPromise = null;
}
