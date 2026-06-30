// panels-gen — pure logic functions (cache, parsing, validation, API calls).
// Faithfully ported from legacy/panels-gen.js. All quirks, edge-cases and
// special-case handling are preserved exactly (comments mark non-obvious ones).
import type {
  Engine,
  PanelData,
  GematriaDeep,
  CacheStatEntry,
  PanelEvent,
  PanelListener,
  ExegesisData,
  TxAnalysisData,
  TranslationInput,
  DisarmData,
  DisarmEntry,
  QuestModule,
  QuestKind,
  QuestMeta,
  QuestStep,
  LoadOpts,
  ExegesisOpts,
  TxAnalysisOpts,
  DisarmOpts,
  QuestGenOpts,
} from "./types.js";
import {
  CACHE_PREFIX, EXEGESIS_PREFIX, TXANALYSIS_PREFIX, DISARM_PREFIX, QUESTGEN_PREFIX,
  QUEST_KINDS,
  PROMPT_SYSTEM, PROMPT_EXEGESIS, PROMPT_TXANALYSIS, PROMPT_DISARM, PROMPT_QUESTGEN,
} from "./data.js";
import { pw } from "./panels-gen-window.js";

// ── Module-level state (mirrors legacy IIFE closed-over vars) ─────────────────

const inflight = new Map<string, Promise<PanelData>>();
const listeners = new Set<PanelListener>();

// ── Engine resolution ──────────────────────────────────────────────────────────

// Cache key includes the active UI language AND the AI engine
// (provider + model) so switching language OR engine never collides
// with previous generations — each combo gets its own cache slot.
// Bug D fix — the engine MUST be passed in by each call, sourced from that
// call's local opts, so two concurrently-loading panels with different
// engines never read each other's cache slot. `window.CODEX_PANELS_ENGINE`
// is demoted to a read-only DISPLAY HINT used only as a fallback for the
// public read helpers (getCached/purge/etc.) that have no engine context;
// it is NEVER the authoritative source inside the async load*() paths.
export function engineSuffix(engine?: Partial<Engine>): string {
  const e = engine ?? pw().CODEX_PANELS_ENGINE ?? {};
  const aiDefault = pw().CODEX_AI_DEFAULT;
  const p = e.provider ?? aiDefault?.provider ?? "anthropic";
  const m = e.model ?? aiDefault?.model ?? "default";
  // Default-anthropic+default model stays empty for backwards compat
  // with caches written before this change.
  if (p === "anthropic" && m === "default") return "";
  return `.${p}.${String(m).replace(/[^a-z0-9_-]+/gi, "_")}`;
}

export function cacheKey(bookId: string, chapter: string | number, engine?: Partial<Engine>): string {
  const lang = pw().CODEX_LANG ?? "en";
  const langSuffix = lang === "en" ? "" : `.${lang}`;
  return `${CACHE_PREFIX}${bookId}.${chapter}${langSuffix}${engineSuffix(engine)}`;
}

// ── Cache format v2 helpers ───────────────────────────────────────────────────
// Cache format v2: { _v: 2, data, fetchedAt }. Old format (bare object)
// is auto-migrated on read so existing caches keep working.

export function getCached(bookId: string, chapter: string | number, engine?: Partial<Engine>): PanelData | null {
  try {
    const raw = localStorage.getItem(cacheKey(bookId, chapter, engine));
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(raw);
    if (parsed && parsed._v === 2 && parsed.data) return parsed.data as PanelData;
    return parsed as PanelData;   // legacy bare object
  } catch { /* ignore */ }
  return null;
}

// Returns { fetchedAt: ms } for cached entries, or null if not cached.
// Used by the UI to show "CACHED · 5d ago" badges so users can SEE that
// re-visiting a chapter never re-hits the API.
export function getCachedMeta(bookId: string, chapter: string | number, engine?: Partial<Engine>): { fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(bookId, chapter, engine));
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(raw);
    if (parsed && parsed._v === 2) return { fetchedAt: (parsed.fetchedAt as number | undefined) ?? 0 };
    return { fetchedAt: 0 };  // legacy entry — unknown date
  } catch { /* ignore */ }
  return null;
}

export function putCached(bookId: string, chapter: string | number, data: PanelData, engine?: Partial<Engine>): void {
  try {
    const wrapped = { _v: 2, data, fetchedAt: Date.now() };
    localStorage.setItem(cacheKey(bookId, chapter, engine), JSON.stringify(wrapped));
  } catch { /* ignore */ }
}

// Quick stats for the settings cache panel
export function cacheStats(): CacheStatEntry[] {
  const out: CacheStatEntry[] = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(CACHE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const obj = JSON.parse(raw);
      const fetchedAt: number = (obj?._v === 2) ? ((obj.fetchedAt as number | undefined) ?? 0) : 0;
      const ref = k.slice(CACHE_PREFIX.length);   // "jhn.1"
      out.push({ ref, bytes: raw.length, fetchedAt });
    } catch { /* ignore */ }
  }
  return out.sort((a, b) => b.fetchedAt - a.fetchedAt);
}

export function purge(bookId: string, chapter: string | number, engine?: Partial<Engine>): void {
  try { localStorage.removeItem(cacheKey(bookId, chapter, engine)); } catch { /* ignore */ }
}

// ── Event bus ─────────────────────────────────────────────────────────────────

function notify(event: PanelEvent): void { listeners.forEach(fn => { try { fn(event); } catch { /* ignore */ } }); }
export function subscribe(fn: PanelListener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

// ── JSON repair / extraction ───────────────────────────────────────────────────

// Tolerant JSON extraction: handles truncated arrays/objects by rewinding to
// the last safe boundary (after a closed value or comma at any depth) and
// closing any still-open brackets.
export function smartRepair(s: string): string {
  let inString = false, escape = false;
  const stk: string[] = [];                // stack of expected close chars
  let lastSafe = 0;                        // index in s up to which truncation+close yields valid JSON
  let safeStack: string[] = [];            // stack snapshot at lastSafe
  const mark = (idx: number): void => { lastSafe = idx; safeStack = stk.slice(); };
  for (let i = 0; i < s.length; i++) {
    // NOTE: preserved from legacy — noUncheckedIndexedAccess safety: i < s.length guarantees
    // the character exists, but TypeScript requires the undefined check.
    const c = s[i];
    if (c === undefined) break;
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inString = false; mark(i + 1); }
      continue;
    }
    if (c === "\"") { inString = true; continue; }
    if (c === "{") stk.push("}");
    else if (c === "[") stk.push("]");
    else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
    else if (c === ",") mark(i); // cut BEFORE the comma; trailing comma stripped below
    else if (/[\d.eE+-]/.test(c)) mark(i + 1); // numeric literal char
    else if (/[a-zA-Z]/.test(c)) mark(i + 1);  // true/false/null literal char
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  // Strip a trailing "key": with no value
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return head + safeStack.reverse().join("");
}

export function extractJSON(text: string): unknown {
  if (!text) throw new Error("empty response");
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i === -1) throw new Error("no json object found");
  // Prefer the slice ending at the last closing brace if balanced; otherwise repair.
  const candidate = j > i ? s.slice(i, j + 1) : s.slice(i);
  try { return JSON.parse(candidate) as unknown; } catch { /* try repair */ }
  // Try repairing the full tail (more bytes = more recoverable content)
  try { return JSON.parse(smartRepair(s.slice(i))) as unknown; } catch (e) {
    // Last-ditch: maybe the response stops mid-array but ended with a valid close brace earlier.
    try { return JSON.parse(smartRepair(candidate)) as unknown; } catch (e2) {
      throw new Error("could not repair JSON: " + (e2 instanceof Error ? e2.message : String(e2)));
    }
  }
}

// ── Panel validation ───────────────────────────────────────────────────────────

function coerceArr<T>(v: unknown, max: number): T[] {
  return Array.isArray(v) ? (v as T[]).slice(0, max) : [];
}

export function validate(obj: unknown): PanelData {
  if (!obj || typeof obj !== "object") throw new Error("not an object");
  const o = obj as Record<string, unknown>;
  // Coerce missing fields to empty arrays / strings so partial responses still render.
  o["title"]    = (typeof o["title"] === "string"    ? o["title"]    : "") || "";
  o["subtitle"] = (typeof o["subtitle"] === "string" ? o["subtitle"] : "") || "";
  o["talmud"]         = coerceArr(o["talmud"], 6);
  o["commentary"]     = coerceArr(o["commentary"], 6);
  o["gematria"]       = coerceArr(o["gematria"], 10);
  o["gematriaNotes"]  = coerceArr(o["gematriaNotes"], 4);
  // Schema 2: deep gematria intelligence (optional, additive).
  if (o["gematriaDeep"] && typeof o["gematriaDeep"] === "object") {
    const d = o["gematriaDeep"] as Record<string, unknown>;
    d["_schema"]          = 2;
    d["primary_word"]     = (typeof d["primary_word"] === "string"     ? d["primary_word"]     : "") || "";
    d["primary_translit"] = (typeof d["primary_translit"] === "string" ? d["primary_translit"] : "") || "";
    d["primary_gloss"]    = (typeof d["primary_gloss"] === "string"    ? d["primary_gloss"]    : "") || "";
    d["primary_lang"]     = (typeof d["primary_lang"] === "string"     ? d["primary_lang"]     : "") || "hebrew";
    d["symbolic_meaning"] = (typeof d["symbolic_meaning"] === "string" ? d["symbolic_meaning"] : "") || "";
    d["ai_insight"]       = (typeof d["ai_insight"] === "string"       ? d["ai_insight"]       : "") || "";
    const crossMatches = coerceArr<Record<string, unknown>>(d["cross_matches"], 8);
    crossMatches.forEach(cm => {
      cm["matches"] = coerceArr(cm["matches"], 6);
    });
    d["cross_matches"]    = crossMatches;
    d["notarikon"]        = coerceArr(d["notarikon"], 4);
    d["temurah"]          = coerceArr(d["temurah"], 4);
    d["rabbinic_sources"] = coerceArr(d["rabbinic_sources"], 4);
    // Kabbalistic layer — optional, additive.
    if (d["kabbalah"] && typeof d["kabbalah"] === "object") {
      const k = d["kabbalah"] as Record<string, unknown>;
      k["sefirot_resonances"] = coerceArr(k["sefirot_resonances"], 4);
      k["lurianic_frame"] = (typeof k["lurianic_frame"] === "string" && k["lurianic_frame"] !== "null")
        ? k["lurianic_frame"] : "";
      k["lurianic_note"]  = (typeof k["lurianic_note"] === "string"  ? k["lurianic_note"]  : "") || "";
      k["partzuf"]        = (typeof k["partzuf"] === "string" && k["partzuf"] !== "null")
        ? k["partzuf"] : "";
      k["partzuf_note"]   = (typeof k["partzuf_note"] === "string"   ? k["partzuf_note"]   : "") || "";
      k["zohar_citations"] = coerceArr(k["zohar_citations"], 4);
    }
  }
  o["gnosis"]    = coerceArr(o["gnosis"], 6);
  o["crossRefs"] = coerceArr(o["crossRefs"], 8);
  // Drop entries that are clearly malformed (missing key string fields).
  o["talmud"]    = (o["talmud"] as Record<string, unknown>[]).filter(t => t && (t["body"] || t["heading"]));
  o["commentary"] = (o["commentary"] as Record<string, unknown>[]).filter(c => c && c["body"]);
  o["gematria"]  = (o["gematria"] as Record<string, unknown>[]).filter(g => g && g["term"] && typeof g["value"] === "number");
  o["gnosis"]    = (o["gnosis"] as Record<string, unknown>[]).filter(g => g && g["body"]);
  o["crossRefs"] = (o["crossRefs"] as Record<string, unknown>[]).filter(x => x && x["ref"]);
  return o as unknown as PanelData;
}

// ── Main panels load ───────────────────────────────────────────────────────────

export async function load(
  bookId: string,
  chapter: string | number,
  bookName: string,
  opts: LoadOpts = {},
): Promise<PanelData> {
  // Bug D — derive the engine from THIS call's opts and thread it through
  // every cache read/write below, so the slot is fixed for the whole call
  // and never depends on a global another concurrent load could overwrite
  // across an `await`. CODEX_PANELS_ENGINE stays only as a display hint.
  const engine: Engine = { provider: opts.provider ?? "anthropic", model: opts.model ?? "default" };
  pw().CODEX_PANELS_ENGINE = engine;
  const key = cacheKey(bookId, chapter, engine);
  const cached = !opts.force && getCached(bookId, chapter, engine);
  if (cached) { if (pw().CODEX_ENGAGE) pw().CODEX_ENGAGE!.trackPanel(); return cached; }
  if (inflight.has(key)) return inflight.get(key)!;

  notify({ type: "start", bookId, chapter });

  const langName = pw().codexLangName?.() ?? "English";
  const langDirective = langName === "English"
    ? ""
    : `\n\nLANGUAGE: All HUMAN-READABLE STRING VALUES in the JSON (heading, body, subtitle, title, meaning, ref labels, gematriaNotes, gnosis bodies, etc.) MUST be written in ${langName}. EXCEPT: keep "from" enum values (Patristic|Reformation|Modern|Devotional) and "system" labels in English; keep native-script terms (Hebrew/Greek/Aramaic) and their transliterations as-is. Cross-reference book names should use the ${langName} convention.`;

  const userMsg = `Draft the CODEX panels for: ${bookName} ${chapter}.\nReturn ONLY the JSON object as specified in the system instructions.${langDirective}`;

  const p = (async () => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // No cache_control here — panels are localStorage-cached forever
        // per chapter, so a panel call almost never repeats with the same
        // system within the 5-min cache window. Caching would only add
        // padding overhead to a one-shot call.
        system: PROMPT_SYSTEM + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 4500,
        // Multi-provider routing — server validates against its whitelist
        // and falls back to a sane default if these are missing/invalid.
        provider: opts.provider,
        model: opts.model,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await r.json();
    if (!r.ok) throw new Error((data as { error?: string }).error ?? `panels HTTP ${r.status}`);
    const parsed = validate(extractJSON((data as { text?: string }).text ?? ""));
    // Tag with engine used so a regenerate respects the current selector
    // and future cache-busting can compare engines.
    parsed._provider = (data as { provider?: string }).provider ?? opts.provider ?? "anthropic";
    parsed._model    = (data as { model?: string | null }).model ?? opts.model ?? null;
    putCached(bookId, chapter, parsed, engine);
    if (pw().CODEX_ENGAGE) pw().CODEX_ENGAGE!.trackPanel();
    return parsed;
  })()
    .then(data => { notify({ type: "done", bookId, chapter, data }); return data; })
    .catch(err => { notify({ type: "error", bookId, chapter, error: err instanceof Error ? err : new Error(String(err)) }); throw err; })
    .finally(() => { inflight.delete(key); });

  inflight.set(key, p);
  return p;
}

// ── Shared wrapped-cache helpers ───────────────────────────────────────────────

function readWrapped<T>(key: string): { data: T; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(raw);
    if (parsed && parsed._v === 2 && parsed.data) {
      return { data: parsed.data as T, fetchedAt: (parsed.fetchedAt as number | undefined) ?? 0 };
    }
    return { data: parsed as T, fetchedAt: 0 };
  } catch { /* ignore */ }
  return null;
}

function writeWrapped<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ _v: 2, data, fetchedAt: Date.now() }));
  } catch { /* ignore */ }
}

// ── PHASE 4.2 — AI EXEGESIS PANEL ─────────────────────────────────────────────

export function exegesisKey(passageKey: string, engine?: Partial<Engine>): string {
  const lang = pw().CODEX_LANG ?? "en";
  const suffix = lang === "en" ? "" : `.${lang}`;
  return `${EXEGESIS_PREFIX}${passageKey}${suffix}${engineSuffix(engine)}`;
}

export function getExegesisCached(passageKey: string, engine?: Partial<Engine>): ExegesisData | null {
  const w = readWrapped<ExegesisData>(exegesisKey(passageKey, engine));
  return w ? w.data : null;
}

export function getExegesisMeta(passageKey: string, engine?: Partial<Engine>): { fetchedAt: number } | null {
  const w = readWrapped<ExegesisData>(exegesisKey(passageKey, engine));
  return w ? { fetchedAt: w.fetchedAt } : null;
}

export function purgeExegesis(passageKey: string, engine?: Partial<Engine>): void {
  try { localStorage.removeItem(exegesisKey(passageKey, engine)); } catch { /* ignore */ }
}

export function validateExegesis(obj: unknown): ExegesisData {
  if (!obj || typeof obj !== "object") throw new Error("not an object");
  const o = obj as Record<string, unknown>;
  o["_schema"]                = 2;
  o["key_terms"]              = coerceArr<Record<string, unknown>>(o["key_terms"], 8)
    .filter(k => k && (k["term"] || k["original"]));
  o["literary_structure"]     = (typeof o["literary_structure"] === "string"     ? o["literary_structure"]     : "") || "";
  o["historical_context"]     = (typeof o["historical_context"] === "string"     ? o["historical_context"]     : "") || "";
  o["intertextual_echoes"]    = coerceArr<Record<string, unknown>>(o["intertextual_echoes"], 8)
    .filter(e => e && e["ref"]);
  o["exegetical_options"]     = coerceArr<Record<string, unknown>>(o["exegetical_options"], 6)
    .filter(opt => opt && (opt["view"] || opt["argument"]));
  o["preferred_reading"]      = (typeof o["preferred_reading"] === "string"      ? o["preferred_reading"]      : "") || "";
  o["theological_implication"]= (typeof o["theological_implication"] === "string"? o["theological_implication"]: "") || "";
  o["applicational_pivot"]    = (typeof o["applicational_pivot"] === "string"    ? o["applicational_pivot"]    : "") || "";
  return o as unknown as ExegesisData;
}

const exegesisInflight = new Map<string, Promise<ExegesisData>>();

export async function loadExegesis(passageKey: string, opts: ExegesisOpts = {}): Promise<ExegesisData> {
  // Bug D — engine from this call's opts, threaded through the cache key;
  // global is only a display hint.
  const engine: Engine = { provider: opts.provider ?? "anthropic", model: opts.model ?? "default" };
  pw().CODEX_PANELS_ENGINE = engine;
  const k = exegesisKey(passageKey, engine);
  if (!opts.force) {
    const cached = getExegesisCached(passageKey, engine);
    if (cached) return cached;
  }
  if (exegesisInflight.has(k)) return exegesisInflight.get(k)!;

  const langName = pw().codexLangName?.() ?? "English";
  const langDirective = langName === "English"
    ? ""
    : `\n\nLANGUAGE: All human-readable string values in the JSON MUST be written in ${langName}, except original-script terms (Hebrew/Greek) and their transliterations.`;

  const userMsg = `Produce the exegetical analysis for: ${opts.passageLabel ?? passageKey}.\nReturn ONLY the JSON object.`;

  const p = (async () => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: PROMPT_EXEGESIS + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 2400,
        provider: opts.provider,
        model: opts.model,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await r.json();
    if (!r.ok) throw new Error((data as { error?: string }).error ?? `exegesis HTTP ${r.status}`);
    const parsed = validateExegesis(extractJSON((data as { text?: string }).text ?? ""));
    parsed._provider = (data as { provider?: string }).provider ?? opts.provider ?? "anthropic";
    parsed._model    = (data as { model?: string | null }).model ?? opts.model ?? null;
    writeWrapped(k, parsed);
    return parsed;
  })().finally(() => { exegesisInflight.delete(k); });

  exegesisInflight.set(k, p);
  return p;
}

// ── PHASE 4.3 — AI TRANSLATION ANALYSIS PANEL ────────────────────────────────

export function txAnalysisKey(passageKey: string, translationIds: string[], engine?: Partial<Engine>): string {
  const lang = pw().CODEX_LANG ?? "en";
  const suffix = lang === "en" ? "" : `.${lang}`;
  const tids = [...translationIds].sort().join("+");
  return `${TXANALYSIS_PREFIX}${passageKey}.${tids}${suffix}${engineSuffix(engine)}`;
}

export function getTxAnalysisCached(passageKey: string, translationIds: string[], engine?: Partial<Engine>): TxAnalysisData | null {
  const w = readWrapped<TxAnalysisData>(txAnalysisKey(passageKey, translationIds, engine));
  return w ? w.data : null;
}

export function getTxAnalysisMeta(passageKey: string, translationIds: string[], engine?: Partial<Engine>): { fetchedAt: number } | null {
  const w = readWrapped<TxAnalysisData>(txAnalysisKey(passageKey, translationIds, engine));
  return w ? { fetchedAt: w.fetchedAt } : null;
}

export function purgeTxAnalysis(passageKey: string, translationIds: string[], engine?: Partial<Engine>): void {
  try { localStorage.removeItem(txAnalysisKey(passageKey, translationIds, engine)); } catch { /* ignore */ }
}

export function validateTxAnalysis(obj: unknown): TxAnalysisData {
  if (!obj || typeof obj !== "object") throw new Error("not an object");
  const o = obj as Record<string, unknown>;
  o["_schema"]             = 2;
  o["verse_ref"]           = (typeof o["verse_ref"] === "string"           ? o["verse_ref"]           : "") || "";
  o["renderings"]          = coerceArr<Record<string, unknown>>(o["renderings"], 12)
    .filter(r => r && (r["translation"] || r["text"]));
  o["divergence_points"]   = coerceArr<Record<string, unknown>>(o["divergence_points"], 8)
    .filter(d => d && d["issue"]);
  o["best_for_study"]      = (typeof o["best_for_study"] === "string"      ? o["best_for_study"]      : "") || "";
  o["best_for_devotion"]   = (typeof o["best_for_devotion"] === "string"   ? o["best_for_devotion"]   : "") || "";
  o["best_for_originalist"]= (typeof o["best_for_originalist"] === "string"? o["best_for_originalist"]: "") || "";
  return o as unknown as TxAnalysisData;
}

const txInflight = new Map<string, Promise<TxAnalysisData>>();

export async function loadTranslationAnalysis(
  passageKey: string,
  translations: TranslationInput[],
  opts: TxAnalysisOpts = {},
): Promise<TxAnalysisData> {
  // Bug D — engine from this call's opts, threaded through the cache key;
  // global is only a display hint.
  const engine: Engine = { provider: opts.provider ?? "anthropic", model: opts.model ?? "default" };
  pw().CODEX_PANELS_ENGINE = engine;
  // translations: [{ id, name, year?, philosophy?, text }]
  const ids = translations.map(t => t.id);
  const k = txAnalysisKey(passageKey, ids, engine);
  if (!opts.force) {
    const cached = getTxAnalysisCached(passageKey, ids, engine);
    if (cached) return cached;
  }
  if (txInflight.has(k)) return txInflight.get(k)!;

  const langName = pw().codexLangName?.() ?? "English";
  const langDirective = langName === "English"
    ? ""
    : `\n\nLANGUAGE: All analytical string values MUST be written in ${langName}. Verse text fields must remain exactly as supplied.`;

  const lines = translations.map(t =>
    `- ${t.id} · ${t.name ?? t.id}${t.year ? ` (${t.year})` : ""}${t.philosophy ? ` · ${t.philosophy}` : ""}: "${(t.text ?? "").replace(/"/g, "\\\"")}"`
  ).join("\n");
  const primary = translations[0];
  const others  = translations.slice(1).map(t => t.name ?? t.id).join(", ");
  const userMsg = `The user is reading ${opts.passageLabel ?? passageKey} in ${primary?.name ?? primary?.id ?? "?"}.
The following translations are loaded: ${others || "(none)"}.
Compare these supplied renderings — do not invent text:

${lines}

Return ONLY the JSON object as specified.`;

  const p = (async () => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: PROMPT_TXANALYSIS + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 2200,
        provider: opts.provider,
        model: opts.model,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await r.json();
    if (!r.ok) throw new Error((data as { error?: string }).error ?? `txanalysis HTTP ${r.status}`);
    const parsed = validateTxAnalysis(extractJSON((data as { text?: string }).text ?? ""));
    parsed._provider = (data as { provider?: string }).provider ?? opts.provider ?? "anthropic";
    parsed._model    = (data as { model?: string | null }).model ?? opts.model ?? null;
    writeWrapped(k, parsed);
    return parsed;
  })().finally(() => { txInflight.delete(k); });

  txInflight.set(k, p);
  return p;
}

// ── DISARM PANEL ───────────────────────────────────────────────────────────────

export function disarmKey(bookId: string, chapter: string | number, engine?: Partial<Engine>): string {
  const lang = pw().CODEX_LANG ?? "en";
  const langSuffix = lang === "en" ? "" : `.${lang}`;
  return `${DISARM_PREFIX}${bookId}.${chapter}${langSuffix}${engineSuffix(engine)}`;
}

export function getDisarmCached(bookId: string, chapter: string | number, engine?: Partial<Engine>): DisarmData | null {
  const w = readWrapped<DisarmData>(disarmKey(bookId, chapter, engine));
  return w ? w.data : null;
}

export function getDisarmMeta(bookId: string, chapter: string | number, engine?: Partial<Engine>): { fetchedAt: number } | null {
  const w = readWrapped<DisarmData>(disarmKey(bookId, chapter, engine));
  return w ? { fetchedAt: w.fetchedAt } : null;
}

export function purgeDisarm(bookId: string, chapter: string | number, engine?: Partial<Engine>): void {
  try { localStorage.removeItem(disarmKey(bookId, chapter, engine)); } catch { /* ignore */ }
}

export function validateDisarm(obj: unknown): DisarmData {
  if (!obj || typeof obj !== "object") throw new Error("not an object");
  const o = obj as Record<string, unknown>;
  let entries = coerceArr<Record<string, unknown>>(o["entries"], 5)
    .filter(e => e && e["weaponization"] && e["rebuttal"]);
  entries = entries.map(e => {
    return {
      verse:          String(e["verse"]          ?? ""),
      weaponization:  String(e["weaponization"]  ?? ""),
      quote:          String(e["quote"]          ?? ""),
      source:         String(e["source"]         ?? ""),
      rebuttal:       String(e["rebuttal"]       ?? ""),
    } satisfies DisarmEntry;
  });
  o["entries"] = entries;
  return o as unknown as DisarmData;
}

const disarmInflight = new Map<string, Promise<DisarmData>>();

export async function loadDisarm(opts: DisarmOpts = {}): Promise<DisarmData> {
  const { passage, currentVerse, engine: engineOpt, model, force, provider } = opts;
  const bookId  = passage?.bookId;
  const chapter = passage?.chapter;
  const bookName = passage?.book ?? bookId;
  if (!bookId || chapter === undefined) throw new Error("loadDisarm: missing passage");
  const eng = engineOpt ?? {};
  // Bug D — engine from this call's args, threaded through the cache key;
  // global is only a display hint.
  const activeEngine: Engine = {
    provider: provider ?? eng.provider ?? "anthropic",
    model:    model    ?? eng.model    ?? "default",
  };
  pw().CODEX_PANELS_ENGINE = activeEngine;
  const k = disarmKey(bookId, chapter, activeEngine);
  if (!force) {
    const cached = getDisarmCached(bookId, chapter, activeEngine);
    if (cached) return cached;
  }
  if (disarmInflight.has(k)) return disarmInflight.get(k)!;

  const langName = pw().codexLangName?.() ?? "English";
  const langDirective = langName === "English"
    ? ""
    : `\n\nLANGUAGE: All human-readable strings (weaponization, rebuttal, source labels) MUST be written in ${langName}. Keep historical quotes in their original language when verbatim; otherwise paraphrase in ${langName}.`;

  const userMsg = `Draft the DISARM weaponized-readings list for: ${bookName} ${chapter}${currentVerse !== undefined ? ` (current verse ${currentVerse})` : ""}.
Cover the most historically significant misuses of any verse in this chapter, balanced across the political spectrum and across centuries. Return ONLY the JSON object.`;

  const p = (async () => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: PROMPT_DISARM + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 2200,
        provider: provider ?? eng.provider,
        model:    model    ?? eng.model,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await r.json();
    if (!r.ok) throw new Error((data as { error?: string }).error ?? `disarm HTTP ${r.status}`);
    const parsed = validateDisarm(extractJSON((data as { text?: string }).text ?? ""));
    parsed._provider = (data as { provider?: string }).provider ?? provider ?? eng.provider ?? "anthropic";
    parsed._model    = (data as { model?: string | null }).model ?? model ?? eng.model ?? null;
    writeWrapped(k, parsed);
    return parsed;
  })().finally(() => { disarmInflight.delete(k); });

  disarmInflight.set(k, p);
  return p;
}

// ── AI QUEST GENERATION ────────────────────────────────────────────────────────
// Fulfils the engagement contract's questGenHook.
// Implements window.CODEX_QUESTGEN.generate(theme, opts?) by routing through
// the SAME engine resolution (/api/chat with provider+model from opts) and
// the SAME per-engine cache-key discipline (engineSuffix) used by the panels
// above. Output is a quest module matching the FROZEN curated schema.
// On ANY failure it returns a valid curated FALLBACK quest so callers never
// get null. Additive: does not touch panel generation.

// Pull the valid mastery domains from the engine when present; otherwise use
// the frozen taxonomy so generation/validation still works in Lite mode.
export function questDomains(): string[] {
  try {
    const eng = pw().CODEX_ENGAGEMENT;
    if (eng && Array.isArray(eng.DOMAINS) && eng.DOMAINS.length) {
      return eng.DOMAINS.slice();
    }
  } catch { /* ignore */ }
  return [
    "hebrew-greek", "cross-references", "gematria", "talmud",
    "patristics", "gnosis", "geography", "canon-coverage",
  ];
}

export function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "theme";
}

// Deterministic per-(theme,opts,engine) cache slot so re-asking the same
// theme never re-hits the API — mirrors the panel cache discipline.
export function questGenKey(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): string {
  const lang = pw().CODEX_LANG ?? "en";
  const langSuffix = lang === "en" ? "" : `.${lang}`;
  const o = opts ?? {};
  const variant = [
    slugify(theme),
    o.tradition ? `t-${slugify(o.tradition)}` : "",
    o.domain    ? `d-${slugify(o.domain)}`    : "",
    o.steps     ? `s-${o.steps}`              : "",
  ].filter(Boolean).join(".");
  return `${QUESTGEN_PREFIX}${variant}${langSuffix}${engineSuffix(engine)}`;
}

// Curated, zero-AI fallback quest — always a VALID quest module of the
// contract shape. Used whenever generation fails or the engine is absent.
export function fallbackQuest(theme: string, opts?: QuestGenOpts): QuestModule {
  const o = opts ?? {};
  const domains = questDomains();
  const domain = (o.domain && domains.includes(o.domain)) ? o.domain : "cross-references";
  const title = theme
    ? `Trace the Thread: ${String(theme).slice(0, 48)}`
    : "Open a New Study Thread";
  return {
    meta: {
      id:         `quest-gen-${slugify(theme)}-fallback`,
      type:       "quest",
      title,
      tradition:  o.tradition ?? "shared",
      domain,
      ring:       slugify(theme),
      estSteps:   4,
      generated:  true,
      fallback:   true,
    } satisfies QuestMeta,
    steps: [
      {
        kind:   "read",
        refs:   [],
        prompt: `Read a passage that opens the theme "${theme || "your study"}". Note one word or phrase worth chasing.`,
        reveal: "Every thread begins with a single line read closely. The word you flagged is the loose end to pull.",
      },
      {
        kind:   "find",
        refs:   [],
        prompt: "Find a second passage that uses the same word or develops the same idea. Use the cross-reference rail.",
        reveal: "A theme is confirmed when it recurs. Two witnesses turn a hunch into a thread.",
      },
      {
        kind:   "connect",
        refs:   [],
        prompt: "Connect the two passages: what does the second add, invert, or fulfil from the first?",
        reveal: "Connection is the work. The gap between two texts is where the reading lives.",
      },
      {
        kind:   "reflect",
        refs:   [],
        prompt: "Write one line on what this thread shows that neither passage said alone.",
        reveal: "The thread closes when you can state it in your own words. That sentence is the case made.",
      },
    ] satisfies QuestStep[],
  };
}

// Coerce any candidate into a strictly-valid quest module of the contract
// shape. Throws if it cannot be made minimally valid (caller falls back).
export function validateQuest(obj: unknown, theme: string, opts?: QuestGenOpts): QuestModule {
  if (!obj || typeof obj !== "object") throw new Error("not an object");
  const o = opts ?? {};
  const domains = questDomains();
  const raw = obj as Record<string, unknown>;
  const metaRaw = (raw["meta"] && typeof raw["meta"] === "object")
    ? (raw["meta"] as Record<string, unknown>)
    : {};
  const title = (
    (typeof metaRaw["title"] === "string" ? metaRaw["title"] : "") ||
    (typeof raw["title"] === "string" ? raw["title"] : "") ||
    ""
  ).trim() || (theme ? `Study Thread: ${String(theme).slice(0, 48)}` : "Study Thread");
  let domain = (
    (typeof metaRaw["domain"] === "string" ? metaRaw["domain"] : "") ||
    (typeof o.domain === "string" ? o.domain : "") ||
    ""
  );
  if (!domains.includes(domain)) domain = "cross-references";
  const tradition = (
    (typeof metaRaw["tradition"] === "string" ? metaRaw["tradition"] : "") ||
    (typeof o.tradition === "string" ? o.tradition : "") ||
    "shared"
  );
  const ring = (typeof metaRaw["ring"] === "string" ? metaRaw["ring"] : "") || slugify(theme);

  const rawSteps = Array.isArray(raw["steps"]) ? (raw["steps"] as unknown[]) : [];
  const steps: QuestStep[] = rawSteps.slice(0, 8).map((s): QuestStep | null => {
    if (!s || typeof s !== "object") return null;
    const sr = s as Record<string, unknown>;
    let kind = (typeof sr["kind"] === "string" ? sr["kind"] : "").toLowerCase();
    if (!(QUEST_KINDS as readonly string[]).includes(kind)) kind = "read";
    const refs = Array.isArray(sr["refs"])
      ? (sr["refs"] as unknown[]).filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          .map(r => r.trim()).slice(0, 8)
      : [];
    const prompt = (typeof sr["prompt"] === "string" ? sr["prompt"] : "").trim();
    const reveal = (typeof sr["reveal"] === "string" ? sr["reveal"] : "").trim();
    if (!prompt) return null; // a step with no instruction is useless
    return { kind: kind as QuestKind, refs, prompt, reveal };
  }).filter((s): s is QuestStep => s !== null);

  if (steps.length < 2) throw new Error("too few usable steps");

  return {
    meta: {
      id:        `quest-gen-${slugify(theme)}-${slugify(title)}`.slice(0, 80),
      type:      "quest",
      title,
      tradition,
      domain,
      ring,
      estSteps:  steps.length,
      generated: true,
    } satisfies QuestMeta,
    steps,
  };
}

export function getQuestGenCached(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): QuestModule | null {
  const w = readWrapped<QuestModule>(questGenKey(theme, opts, engine));
  return w ? w.data : null;
}

export function getQuestGenMeta(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): { fetchedAt: number } | null {
  const w = readWrapped<QuestModule>(questGenKey(theme, opts, engine));
  return w ? { fetchedAt: w.fetchedAt } : null;
}

export function purgeQuestGen(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): void {
  try { localStorage.removeItem(questGenKey(theme, opts, engine)); } catch { /* ignore */ }
}

const questGenInflight = new Map<string, Promise<QuestModule>>();

// Public generator. Resolves to a quest module (generated OR curated
// fallback). Never rejects — on failure it resolves the fallback so the
// contract's `generate -> Promise<questModule>` is always honoured.
export async function generateQuest(theme: string, opts: QuestGenOpts = {}): Promise<QuestModule> {
  const o = opts;
  // Same engine resolution as the panels above.
  // NOTE: preserved from legacy — generateQuest does NOT set window.CODEX_PANELS_ENGINE;
  // that is intentional (the original also omits it here).
  const engine: Engine = { provider: o.provider ?? "anthropic", model: o.model ?? "default" };
  const k = questGenKey(theme, o, engine);

  if (!o.force) {
    const cached = getQuestGenCached(theme, o, engine);
    if (cached) return cached;
  }
  if (questGenInflight.has(k)) return questGenInflight.get(k)!;

  const langName = pw().codexLangName?.() ?? "English";
  const langDirective = langName === "English"
    ? ""
    : `\n\nLANGUAGE: All human-readable string values (title, prompt, reveal, ring) MUST be written in ${langName}. Keep "kind" enum values, OSIS refs, and the "domain"/"tradition" enums in English.`;

  const domains = questDomains().join(" | ");
  const stepHint = (o.steps !== undefined && o.steps >= 3 && o.steps <= 8)
    ? `Make exactly ${o.steps} steps.`
    : "Make 4-6 steps.";
  const userMsg = `Design one depth-gated study quest on the theme: "${theme || "a passage of the reader's choosing"}".
${o.tradition ? `Tradition: ${o.tradition}. ` : ""}${o.domain ? `Primary mastery domain: ${o.domain} (must be one of: ${domains}). ` : `Pick the single best-fitting domain from: ${domains}. `}${stepHint}
Return ONLY the JSON object as specified.`;

  const p = (async () => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: PROMPT_QUESTGEN + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 1800,
        // Multi-provider routing — same contract as the panel calls; the
        // server validates against its whitelist and falls back if invalid.
        provider: o.provider,
        model:    o.model,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await r.json();
    if (!r.ok) throw new Error((data as { error?: string }).error ?? `questgen HTTP ${r.status}`);
    const parsed = validateQuest(extractJSON((data as { text?: string }).text ?? ""), theme, o);
    parsed.meta.provider = (data as { provider?: string }).provider ?? o.provider ?? "anthropic";
    parsed.meta.model    = (data as { model?: string | null }).model ?? o.model ?? null;
    writeWrapped(k, parsed);
    return parsed;
  })()
    // Defensive: any failure yields a valid curated fallback, never a reject.
    .catch(() => fallbackQuest(theme, o))
    .finally(() => { questGenInflight.delete(k); });

  questGenInflight.set(k, p);
  return p;
}

// Re-export GematriaDeep for internal use in validate (already in scope via types)
export type { GematriaDeep };
