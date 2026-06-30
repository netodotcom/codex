// boot-contract — logic helpers (faithful port from legacy/boot-contract.js).
//
// Declaration order and initial values match the original IIFE exactly.
// NOTE: preserved from legacy — plain module functions, not a class.
import { DEADLINE_MS, INTERVAL_MS } from "./types.js";
import type { BootGlobal, CodexBootContract, BootCodexError } from "./types.js";
import { bcw, getWindowGlobal } from "./boot-contract-window.js";

// ── Utility ───────────────────────────────────────────────────────────────────
/** Returns true when f is a function.
 * NOTE: preserved from legacy — `isFn` helper used by shape predicates. */
export function isFn(f: unknown): boolean {
  return typeof f === "function";
}

// ── Boot contract manifest ────────────────────────────────────────────────────
// Shape predicates below were verified by reading the defining files
// (do NOT change them without re-verifying the source):
//   BIBLE.loadChapter            → bible.js:1024 returned object
//   CODEX_DATA.books             → data.js:6 literal Array
//   CODEX_PLUGINS_API.register   → plugins.js:138
//   CODEX_PANELS.load + cacheKey → panels-gen.js:694
//   CODEX_SEARCH.search          → search.js:622  (NOTE: real fn is `search`,
//                                  not `query` — predicate matches the real
//                                  shape per FOUNDATION's "verify, don't guess".)
//   codexJumpToRef               → app.jsx:2308 (set in a useEffect → phase jsx)
export const CODEX_BOOT_CONTRACT: CodexBootContract = {
  // NOTE: preserved from legacy — filled in once the Phase-0 BASE commit exists.
  baselineSha: null,
  globals: [
    {
      name: "BIBLE",
      phase: "js",
      shape: (b: unknown): boolean => {
        if (!b || typeof b !== "object") return false;
        return isFn((b as Record<string, unknown>)["loadChapter"]);
      },
    },
    {
      name: "CODEX_DATA",
      phase: "js",
      shape: (d: unknown): boolean => {
        if (!d || typeof d !== "object") return false;
        const books = (d as Record<string, unknown>)["books"];
        return Array.isArray(books) && books.length > 0;
      },
    },
    {
      name: "CODEX_PLUGINS_API",
      phase: "js",
      shape: (a: unknown): boolean => {
        if (!a || typeof a !== "object") return false;
        return isFn((a as Record<string, unknown>)["register"]);
      },
    },
    {
      name: "CODEX_PANELS",
      phase: "js",
      shape: (p: unknown): boolean => {
        if (!p || typeof p !== "object") return false;
        const obj = p as Record<string, unknown>;
        return isFn(obj["load"]) && isFn(obj["cacheKey"]);
      },
    },
    {
      name: "CODEX_SEARCH",
      phase: "js",
      // NOTE: preserved from legacy — Real exposed API is `search` (search.js:622),
      // not `query` — predicate matches the real shape per FOUNDATION's
      // "verify, don't guess".
      shape: (s: unknown): boolean => {
        if (!s || typeof s !== "object") return false;
        return isFn((s as Record<string, unknown>)["search"]);
      },
    },
    {
      name: "codexJumpToRef",
      phase: "jsx",
      // NOTE: preserved from legacy — set in a React useEffect → phase jsx.
      shape: (f: unknown): boolean => isFn(f),
    },
  ] satisfies BootGlobal[],
  // NOTE: preserved from legacy — Phase 3 (events.js). Intentionally empty for Phase 0.
  events: [],
};

// ── Error reporter ────────────────────────────────────────────────────────────
/** Pushes a boot-contract failure entry into window.__CODEX_ERRORS__.
 * NOTE: preserved from legacy — wrapped in try/catch; never throws. */
export function fail(name: string, why: string): void {
  try {
    const entry: BootCodexError = {
      when: Date.now(),
      type: "boot-contract",
      message: "[boot-contract] " + why + ": " + name,
      src: "",
    };
    bcw().__CODEX_ERRORS__?.push(entry);
  } catch { /* never throw */ }
}

// ── Contract check ────────────────────────────────────────────────────────────
/** One non-logging pass — returns the list of missing/malformed globals.
 * NOTE: preserved from legacy — per-entry try/catch on both val-get and
 * shape call; skips entries with falsy name. */
export function checkOnce(): Array<{ name: string; why: string }> {
  const missing: Array<{ name: string; why: string }> = [];
  const globals = (CODEX_BOOT_CONTRACT && CODEX_BOOT_CONTRACT.globals) || [];
  for (let i = 0; i < globals.length; i++) {
    const g: BootGlobal | undefined = globals[i];
    if (!g || !g.name) continue;
    let val: unknown;
    try { val = getWindowGlobal(g.name); } catch { val = undefined; }
    if (typeof val === "undefined" || val === null) {
      missing.push({ name: g.name, why: "missing" });
      continue;
    }
    let good = false;
    try { good = !!(g.shape && g.shape(val)); } catch { good = false; }
    if (!good) missing.push({ name: g.name, why: "malformed" });
  }
  return missing;
}

// ── Retry loop ────────────────────────────────────────────────────────────────
// phase:'jsx' globals appear only after the async .jsx phase — and some
// (e.g. codexJumpToRef, set in a React useEffect) appear AFTER the 'load'
// event, once effects have committed. A single check on 'load' would log a
// false "missing" and never set __CODEX_READY__. So poll for a bounded
// window; only treat globals still absent past the deadline as real failures.

/** Polls globals until all pass or the deadline expires.
 * NOTE: preserved from legacy — DEADLINE_MS = 8000, INTERVAL_MS = 150. */
export function runWithRetry(startedAt: number): void {
  let missing: Array<{ name: string; why: string }>;
  try { missing = checkOnce(); } catch { missing = [{ name: "(checker)", why: "threw" }]; }
  if (!missing.length) {
    try { bcw().__CODEX_READY__ = true; } catch { /* never throw */ }
    return;
  }
  if (Date.now() - startedAt < DEADLINE_MS) {
    try {
      setTimeout(function () { runWithRetry(startedAt); }, INTERVAL_MS);
    } catch { /* never throw */ }
    return;
  }
  // Deadline exceeded → genuine failure: log each still-missing global once.
  for (let i = 0; i < missing.length; i++) {
    const m = missing[i];
    if (m) fail(m.name, m.why);
  }
  try { bcw().__CODEX_READY__ = false; } catch { /* never throw */ }
  try {
    console.error(
      "[CODEX] boot-contract: globals missing/malformed after " + DEADLINE_MS + "ms",
    );
  } catch { /* never throw */ }
}

/** Starts the retry loop anchored at now.
 * NOTE: preserved from legacy — start() = runWithRetry(Date.now()). */
export function start(): void {
  runWithRetry(Date.now());
}

// ── Test utilities ────────────────────────────────────────────────────────────
/** Clears window globals written by this module. For use in tests only. */
export function _resetForTest(): void {
  try {
    const w = bcw();
    w.__CODEX_READY__ = undefined;
    w.CODEX_BOOT_CONTRACT = undefined;
  } catch { /* never throw */ }
}
