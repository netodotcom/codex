// strongs — helpers (migrated verbatim from strongs.jsx). Module loading cache,
// lexicon lookup, verse-ref normalisation, and the openLookup side-effect.
import {
  sw,
  type StrongsLexicon,
  type AlignmentModule,
  type AlignmentToken,
  type StrongsEntry,
} from "./strongs-window.js";

// ── Module loading cache ───────────────────────────────────────────────────
const _modPromises: Record<string, Promise<unknown>> = {};

export function loadMod(id: string): Promise<unknown> {
  if (_modPromises[id] !== undefined) return _modPromises[id]!;
  const api = sw().CODEX_MODULES;
  if (!api || typeof api.loadModule !== "function") {
    _modPromises[id] = Promise.reject(new Error("CODEX_MODULES unavailable"));
    return _modPromises[id]!;
  }
  _modPromises[id] = api.loadModule(id).catch(function (e: unknown) {
    console.warn("[strongs] failed to load " + id, e);
    // clear so a later retry can try again
    delete _modPromises[id];
    throw e;
  });
  return _modPromises[id]!;
}

// Synchronous accessor — populated after loads resolve. Keeps lookup()
// available as a plain function for other features.
export const _lex: {
  hebrew: StrongsLexicon | null;
  greek: StrongsLexicon | null;
  alignment: AlignmentModule | null;
} = { hebrew: null, greek: null, alignment: null };

export function ensureLoaded(): Promise<unknown> {
  return Promise.all([
    loadMod("strongs-hebrew").then(
      function (m) { _lex.hebrew = m as StrongsLexicon; return m as StrongsLexicon; },
      function () { return null; },
    ),
    loadMod("strongs-greek").then(
      function (m) { _lex.greek = m as StrongsLexicon; return m as StrongsLexicon; },
      function () { return null; },
    ),
    loadMod("alignment-kjv-sample").then(
      function (m) { _lex.alignment = m as AlignmentModule; return m as AlignmentModule; },
      function () { return null; },
    ),
  ]);
}

// Kick a load on first script eval so cross-feature lookups warm fast.
if (typeof window !== "undefined") ensureLoaded();

// ── Pure lookup ────────────────────────────────────────────────────────────
export function lookup(strongsNumber: string): StrongsEntry | null {
  if (!strongsNumber || typeof strongsNumber !== "string") return null;
  const key = strongsNumber.trim().toUpperCase();
  if (!/^[HG]\d+$/.test(key)) return null;
  const src = key[0] === "H" ? _lex.hebrew : _lex.greek;
  if (!src || !src.entries) return null;
  return src.entries[key] ?? null;
}

// ── Verse-ref helpers ──────────────────────────────────────────────────────
// We accept refs in two shapes:
//   "john.3.16"  (already canonical)
//   { book, chapter, verse }
export type VerseRefParts = {
  bookId?: string;
  book?: string;
  chapter?: number | string;
  verse?: number | string;
};

export function canonRef(
  refOrParts: string | VerseRefParts | null | undefined,
  chapter?: number,
  verse?: number,
): string | null {
  if (typeof refOrParts === "string") {
    return refOrParts.toLowerCase().trim();
  }
  if (refOrParts && typeof refOrParts === "object") {
    const b = ((refOrParts.bookId ?? refOrParts.book) ?? "").toString().toLowerCase().trim();
    const c = refOrParts.chapter;
    const v = refOrParts.verse;
    // normalize spaces ("1 john" -> "1-john" -> "1john")
    const bNorm = b.replace(/\s+/g, "");
    return bNorm + "." + String(c) + "." + String(v);
  }
  if (typeof chapter === "number" && typeof verse === "number") {
    const bk = (refOrParts != null ? String(refOrParts) : "").toLowerCase().trim().replace(/\s+/g, "");
    return bk + "." + chapter + "." + verse;
  }
  return null;
}

export function alignmentFor(ref: string | null | undefined): AlignmentToken[] | null {
  if (!_lex.alignment || !_lex.alignment.verses) return null;
  if (!ref) return null;
  return _lex.alignment.verses[ref] ?? null;
}

// ── Allow other features (or our own panel) to focus a Strong's number ────
export function openLookup(strongsNumber: string): void {
  try {
    window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: strongsNumber } }));
  } catch { /* no-op */ }
  if (strongsNumber) {
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type: "strongs-lookup", ref: strongsNumber, weight: 1, domain: "hebrew-greek" },
      }));
    } catch { /* no-op */ }
  }
}
