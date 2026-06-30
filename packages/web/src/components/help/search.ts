// help — predictive-search ranking (migrated verbatim from help.jsx). Scores an
// article against a query by title prefix/substring, tag hit, body hit, and a
// whole-word title bonus. Cached AI translations widen the body haystack so a
// reader can find an article by words they only ever saw translated.
import { SUPPORTED_LANGS, type Article } from "./data.js";
import { readTrCache } from "./tr-cache.js";

export function scoreArticle(art: Article, q: string): number {
  if (!q) return 0;
  const Q = q.toLowerCase();
  const title = (art.title || "").toLowerCase();
  const tags  = (art.tags || []).join(" ").toLowerCase();
  let body  = (art.body || "").toLowerCase();
  for (const l of SUPPORTED_LANGS) {
    const c = readTrCache(art.id, l.code);
    if (c) {
      body += " " + (c.body || "").toLowerCase();
      if (c.title) body += " " + c.title.toLowerCase();
    }
  }
  let s = 0;
  const ti = title.indexOf(Q);
  if (ti === 0) s += 1000;
  else if (ti > 0) s += 600 - Math.min(ti, 200);
  const gi = tags.indexOf(Q);
  if (gi >= 0) s += 300 - Math.min(gi, 100);
  const bi = body.indexOf(Q);
  if (bi >= 0) s += 80 - Math.min(bi / 20, 60);
  if (new RegExp(`\\b${Q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title)) s += 200;
  return s;
}
