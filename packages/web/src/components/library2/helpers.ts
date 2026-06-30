// library2 — source-light helper (migrated verbatim from library2.jsx).
// lib2SourceLight answers: does the primary translation, or any translation in
// the registry, cover this book?  Reads window.CODEX_DATA.translations at call
// time (lazy, same as the legacy IIFE).
import type { Lib2Book, Lib2Translation } from "./library2-window.js";
import { lw } from "./library2-window.js";

export type SourceLight = "own" | "other" | "none";

export function lib2SourceLight(book: Lib2Book, primary: string): SourceLight {
  const data = lw().CODEX_DATA;
  const all: Lib2Translation[] = (data && data.translations) || [];

  const canonsOf = (t: Lib2Translation): Set<string> =>
    new Set(t.canons && t.canons.length ? t.canons : ["protestant"]);

  const covers = (t: Lib2Translation): boolean => {
    const c = canonsOf(t);
    if (book.testament === "OT") return c.has("protestant") || c.has("ot");
    if (book.testament === "NT") return c.has("protestant") || c.has("nt");
    return c.has(book.canon ?? "");
  };

  const cur = all.find((t) => t.id === primary);
  if (cur && covers(cur)) return "own";
  if (all.some(covers)) return "other";
  return "none";
}
