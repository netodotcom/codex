// Generated-panel cache + normalization — pure helpers ported from panels-gen.js.
//
// The prompt construction and /api/chat generation are platform glue (deferred).
// The reusable core is: the localStorage cache key (lang + engine aware), the v2
// cache wrapper (with legacy-bare-object migration), and the top-level panel-data
// coercion (defaults + array caps) the renderers rely on. The deep validators
// (gematriaDeep, exegesis, tx-analysis) are a later slice.

const CACHE_PREFIX = "codex.panels.v1.";

export interface PanelEngine {
  provider?: string;
  model?: string;
}

/** Engine cache-slot suffix. Default anthropic+default stays "" for back-compat. */
export function engineSuffix(engine?: PanelEngine): string {
  const provider = engine?.provider || "anthropic";
  const model = engine?.model || "default";
  if (provider === "anthropic" && model === "default") return "";
  return `.${provider}.${String(model).replace(/[^a-z0-9_-]+/gi, "_")}`;
}

export function panelCacheKey(
  bookId: string,
  chapter: number | string,
  opts?: { lang?: string; engine?: PanelEngine },
): string {
  const lang = opts?.lang || "en";
  const langSuffix = lang === "en" ? "" : `.${lang}`;
  return `${CACHE_PREFIX}${bookId}.${chapter}${langSuffix}${engineSuffix(opts?.engine)}`;
}

export interface PanelCacheEntry {
  _v: 2;
  data: unknown;
  fetchedAt: number;
}

export function wrapPanelCache(data: unknown, now: number = Date.now()): PanelCacheEntry {
  return { _v: 2, data, fetchedAt: now };
}

/** Read a parsed cache entry — v2 wrapper or a legacy bare object (fetchedAt 0). */
export function unwrapPanelCache(parsed: unknown): { data: unknown; fetchedAt: number } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as { _v?: number; data?: unknown; fetchedAt?: number };
  if (p._v === 2 && p.data) return { data: p.data, fetchedAt: p.fetchedAt || 0 };
  return { data: parsed, fetchedAt: 0 };
}

export interface PanelData {
  title: string;
  subtitle: string;
  talmud: unknown[];
  commentary: unknown[];
  gematria: unknown[];
  gematriaNotes: unknown[];
  gnosis: unknown[];
  crossRefs: unknown[];
  [key: string]: unknown;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}
function strOr(v: unknown): string {
  return (typeof v === "string" && v) || "";
}
function capArr(v: unknown, n: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, n) : [];
}
// faithful to obj[x] = (typeof x === "string" && x !== "null") ? x : ""
function strNotNull(v: unknown): string {
  return typeof v === "string" && v !== "null" ? v : "";
}

/**
 * Coerce a (possibly partial) generated panel object into a renderable shape:
 * default strings, cap arrays, drop malformed entries, and normalize the
 * optional deep-gematria subtree. Mirrors validate() in panels-gen.js. Unknown
 * extra fields are preserved.
 */
export function coercePanelData(input: unknown): PanelData {
  if (!input || typeof input !== "object") throw new Error("not an object");
  const o = { ...(input as Record<string, unknown>) };

  o["title"] = strOr(o["title"]);
  o["subtitle"] = strOr(o["subtitle"]);
  o["talmud"] = capArr(o["talmud"], 6).filter((t) => isObj(t) && (Boolean(t["body"]) || Boolean(t["heading"])));
  o["commentary"] = capArr(o["commentary"], 6).filter((c) => isObj(c) && Boolean(c["body"]));
  o["gematria"] = capArr(o["gematria"], 10).filter(
    (g) => isObj(g) && Boolean(g["term"]) && typeof g["value"] === "number",
  );
  o["gematriaNotes"] = capArr(o["gematriaNotes"], 4);
  o["gnosis"] = capArr(o["gnosis"], 6).filter((g) => isObj(g) && Boolean(g["body"]));
  o["crossRefs"] = capArr(o["crossRefs"], 8).filter((x) => isObj(x) && Boolean(x["ref"]));

  // Deep gematria (schema 2, optional/additive)
  if (isObj(o["gematriaDeep"])) {
    const d = o["gematriaDeep"];
    d["_schema"] = 2;
    d["primary_word"] = strOr(d["primary_word"]);
    d["primary_translit"] = strOr(d["primary_translit"]);
    d["primary_gloss"] = strOr(d["primary_gloss"]);
    d["primary_lang"] = strOr(d["primary_lang"]) || "hebrew";
    d["symbolic_meaning"] = strOr(d["symbolic_meaning"]);
    d["ai_insight"] = strOr(d["ai_insight"]);
    const cross = capArr(d["cross_matches"], 8);
    for (const cm of cross) if (isObj(cm)) cm["matches"] = capArr(cm["matches"], 6);
    d["cross_matches"] = cross;
    d["notarikon"] = capArr(d["notarikon"], 4);
    d["temurah"] = capArr(d["temurah"], 4);
    d["rabbinic_sources"] = capArr(d["rabbinic_sources"], 4);
    if (isObj(d["kabbalah"])) {
      const k = d["kabbalah"];
      k["sefirot_resonances"] = capArr(k["sefirot_resonances"], 4);
      k["lurianic_frame"] = strNotNull(k["lurianic_frame"]);
      k["lurianic_note"] = strOr(k["lurianic_note"]);
      k["partzuf"] = strNotNull(k["partzuf"]);
      k["partzuf_note"] = strOr(k["partzuf_note"]);
      k["zohar_citations"] = capArr(k["zohar_citations"], 4);
    }
  }

  return o as PanelData;
}

/** Coerce a generated exegesis object (schema 2). Mirrors validateExegesis(). */
export function coerceExegesis(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("not an object");
  const o = { ...(input as Record<string, unknown>) };
  o["_schema"] = 2;
  o["key_terms"] = capArr(o["key_terms"], 8).filter((k) => isObj(k) && (Boolean(k["term"]) || Boolean(k["original"])));
  o["literary_structure"] = strOr(o["literary_structure"]);
  o["historical_context"] = strOr(o["historical_context"]);
  o["intertextual_echoes"] = capArr(o["intertextual_echoes"], 8).filter((e) => isObj(e) && Boolean(e["ref"]));
  o["exegetical_options"] = capArr(o["exegetical_options"], 6).filter(
    (x) => isObj(x) && (Boolean(x["view"]) || Boolean(x["argument"])),
  );
  o["preferred_reading"] = strOr(o["preferred_reading"]);
  o["theological_implication"] = strOr(o["theological_implication"]);
  o["applicational_pivot"] = strOr(o["applicational_pivot"]);
  return o;
}

/** Coerce a generated translation-analysis object (schema 2). Mirrors validateTxAnalysis(). */
export function coerceTxAnalysis(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("not an object");
  const o = { ...(input as Record<string, unknown>) };
  o["_schema"] = 2;
  o["verse_ref"] = strOr(o["verse_ref"]);
  o["renderings"] = capArr(o["renderings"], 12).filter((r) => isObj(r) && (Boolean(r["translation"]) || Boolean(r["text"])));
  o["divergence_points"] = capArr(o["divergence_points"], 8).filter((d) => isObj(d) && Boolean(d["issue"]));
  o["best_for_study"] = strOr(o["best_for_study"]);
  o["best_for_devotion"] = strOr(o["best_for_devotion"]);
  o["best_for_originalist"] = strOr(o["best_for_originalist"]);
  return o;
}
