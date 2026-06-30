// ai-translate-ui — core logic (faithful port from legacy/ai-translate-ui.js).
// Same algorithm, same globals, same quirks — only the language changes.
import type {
  CodexAiTranslateUiApi,
  DomQueueEntry,
  I18nTable,
  InflightTranslation,
  LangDict,
} from "./types.js";
import { aw } from "./ai-translate-ui-window.js";

const CACHE_PREFIX = "codex.aiUi.v1.";
const WARN_KEY = "codex.aiUi.warned.v1";
const NODE_CACHE_PREFIX = "codex.aiUiNodes.v1.";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
  fr: "French",
  la: "Latin",
  he: "Hebrew",
  el: "Greek",
  hi: "Hindi",
};

// Plugins / late code can register extra strings to be translated.
const _extra: LangDict = {}; // { key: englishSource }

// ── Cache helpers ─────────────────────────────────────────────────────────────

export function loadCache(lang: string): LangDict {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // NOTE: preserved from legacy — `|| {}` coerces falsy parsed values (null, false, 0)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as LangDict;
  } catch {
    return {};
  }
}

export function saveCache(lang: string, dict: LangDict): void {
  try {
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(dict));
  } catch {}
}

function loadNodeCache(lang: string): LangDict {
  try {
    const raw = localStorage.getItem(NODE_CACHE_PREFIX + lang);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as LangDict;
  } catch {
    return {};
  }
}

function saveNodeCache(lang: string, dict: LangDict): void {
  try {
    localStorage.setItem(NODE_CACHE_PREFIX + lang, JSON.stringify(dict));
  } catch {}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Ensure T[lang] exists, creating an empty dict if needed. Returns the dict. */
function ensureLangTable(T: I18nTable, lang: string): LangDict {
  const existing = T[lang];
  if (existing !== undefined) return existing;
  const table: LangDict = {};
  T[lang] = table;
  return table;
}

export function allEnglishStrings(): LangDict {
  const T: I18nTable = aw().CODEX_T ?? {};
  const en: LangDict = T["en"] ?? {};
  return Object.assign({}, en, _extra);
}

export function hasAIKey(): boolean {
  try {
    // NOTE: preserved from legacy — direct-api.js stores the resolved provider key
    // under codex.api.keys.v1. Comment in original: "'anthropic' and 'grok' (NOT
    // 'xai' — that was a bug)." But the legacy code still checks xai; faithfully kept.
    const raw = localStorage.getItem("codex.api.keys.v1");
    if (!raw) return false;
    const j: unknown = JSON.parse(raw);
    if (!j || typeof j !== "object") return false;
    const r = j as Record<string, unknown>;
    return !!(r["anthropic"] || r["grok"] || r["xai"] || r["openai"] || r["google"]);
  } catch {
    return false;
  }
}

export function toast(msg: string, kind?: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent("codex:toast", { detail: { msg, kind: kind ?? "warn" } }),
    );
  } catch {}
  // Fallback so the user still sees it if no toast listener
  if (!aw().__cxToastListener) {
    console.warn("[codex i18n]", msg);
  }
}

// ── i18n integration ──────────────────────────────────────────────────────────

/** Hydrate the live i18n table from localStorage cache (synchronous, instant). */
export function hydrate(lang: string): void {
  if (!lang || lang === "en") return;
  const T = aw().CODEX_T;
  if (!T) return;
  const langTable = ensureLangTable(T, lang);
  const cache = loadCache(lang);
  Object.assign(langTable, cache);
}

/** In-flight batch tracker so concurrent calls deduplicate. */
let _inflight: InflightTranslation | null = null;

/**
 * Translate any keys that don't yet have a non-trivial entry in T[lang].
 * Batched to keep prompts under model limits.
 */
export async function translateMissing(lang: string): Promise<void> {
  if (!lang || lang === "en") return;
  if (_inflight !== null && _inflight.lang === lang) return _inflight.p;
  const T = aw().CODEX_T;
  if (!T) return;
  const langTable = ensureLangTable(T, lang);

  const cache = loadCache(lang);
  const en = allEnglishStrings();
  const missing: LangDict = {};
  Object.keys(en).forEach((k) => {
    // Skip if already present in cache OR shipped baseline translation
    // (avoid re-translating curated strings).
    if (cache[k]) return;
    const baseline = langTable[k];
    const enVal = en[k];
    if (baseline !== undefined && baseline !== enVal) return;
    if (enVal !== undefined) missing[k] = enVal;
  });
  const keys = Object.keys(missing);
  if (keys.length === 0) return;

  if (!hasAIKey()) {
    // One-time warning per session per language.
    const warnedRaw: unknown = (() => {
      try {
        return JSON.parse(localStorage.getItem(WARN_KEY) ?? "{}");
      } catch {
        return {};
      }
    })();
    const warned: Record<string, unknown> =
      warnedRaw && typeof warnedRaw === "object" && !Array.isArray(warnedRaw)
        ? (warnedRaw as Record<string, unknown>)
        : {};
    if (!warned[lang]) {
      warned[lang] = Date.now();
      try {
        localStorage.setItem(WARN_KEY, JSON.stringify(warned));
      } catch {}
      const langName = LANG_NAMES[lang] ?? lang;
      toast(
        `Add an AI key in Settings to translate the whole app into ${langName}. Falling back to English where translations are missing.`,
        "warn",
      );
    }
    return;
  }

  const p: Promise<void> = (async (): Promise<void> => {
    const BATCH = 60;
    const langName = LANG_NAMES[lang] ?? lang;
    const merged: LangDict = Object.assign({}, cache);
    for (let i = 0; i < keys.length; i += BATCH) {
      const slice = keys.slice(i, i + BATCH);
      const payload: LangDict = {};
      slice.forEach((k) => {
        const v = missing[k];
        if (v !== undefined) payload[k] = v;
      });
      const sys =
        `You translate UI strings for a Bible study app from English to ${langName}. ` +
        `Return ONLY valid JSON in the same shape (same keys), with each value replaced ` +
        `by a faithful natural ${langName} translation. Preserve placeholders like {n}, ` +
        `{ref}, punctuation, and casing intent (ALL-CAPS stays ALL-CAPS where shown). ` +
        `Keep translations terse — UI buttons must remain short. Do not add commentary, ` +
        `do not wrap in markdown fences.`;
      const usr =
        `Translate this JSON object to ${langName}:\n` + JSON.stringify(payload, null, 2);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: sys,
            messages: [{ role: "user", content: usr }],
            max_tokens: 3000,
          }),
        });
        const data: unknown = await r.json();
        const dataRec =
          data !== null && typeof data === "object" && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : undefined;
        if (!r.ok || dataRec?.["error"]) {
          const errMsg = dataRec?.["error"]
            ? String(dataRec["error"])
            : "HTTP " + String(r.status);
          throw new Error(errMsg);
        }
        let txt = String(dataRec?.["text"] ?? "")
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/, "");
        const a = txt.indexOf("{");
        const b = txt.lastIndexOf("}");
        if (a < 0 || b < 0) continue;
        let obj: unknown;
        try {
          obj = JSON.parse(txt.slice(a, b + 1));
        } catch {
          continue;
        }
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
        const objRec = obj as Record<string, unknown>;
        Object.keys(objRec).forEach((k) => {
          const v = objRec[k];
          if (typeof v === "string") merged[k] = v;
        });
        // Incremental save + live update so the UI fills in as we go.
        saveCache(lang, merged);
        Object.assign(langTable, merged);
        window.dispatchEvent(
          new CustomEvent("codex:lang", {
            detail: {
              lang,
              progress: { done: Math.min(i + BATCH, keys.length), total: keys.length },
            },
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[codex i18n] batch failed:", msg);
        // Don't throw — keep going so partial progress still helps.
      }
    }
    toast(`UI translation to ${langName} complete.`, "ok");
  })();

  _inflight = { lang, p };
  // NOTE: preserved from legacy — p.finally used as fire-and-forget cleanup
  void p.finally((): void => {
    if (_inflight !== null && _inflight.lang === lang) _inflight = null;
  });
  return p;
}

/** Plugin registration: adds strings for the next lang-change pass. */
export function registerStrings(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  const rec = obj as Record<string, unknown>;
  let changed = false;
  Object.keys(rec).forEach((k) => {
    const v = rec[k];
    if (typeof v === "string" && !_extra[k]) {
      _extra[k] = v;
      changed = true;
    }
  });
  if (changed) {
    const lang = aw().CODEX_LANG;
    if (lang && lang !== "en") {
      // Trigger a translation pass for the newly registered strings.
      translateMissing(lang).catch(() => {});
    }
  }
}

/** Wrap applyCodexLang so any lang change kicks off hydrate + translate. */
export function install(): void {
  if (!aw().applyCodexLang) {
    // i18n.js hasn't loaded yet — try again next tick.
    // NOTE: preserved from legacy — `return setTimeout(install,30)` returned the timer
    // ID but callers discarded it; converted to void return here.
    setTimeout(install, 30);
    return;
  }
  const orig = aw().applyCodexLang!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  aw().applyCodexLang = function (lang: string): void {
    hydrate(lang);
    orig(lang);
    if (lang && lang !== "en") {
      // Fire-and-forget; UI re-renders as batches complete.
      translateMissing(lang).catch(() => {});
    }
  };
  // Hydrate the initial lang if non-en was already chosen.
  const currentLang = aw().CODEX_LANG;
  if (currentLang && currentLang !== "en") {
    hydrate(currentLang);
    // Defer the network pass so we don't block first paint.
    setTimeout((): void => {
      translateMissing(aw().CODEX_LANG ?? "").catch(() => {});
    }, 1500);
  }
}

// ── DOM walker ────────────────────────────────────────────────────────────────
// Catches the long tail of hardcoded English strings that don't flow through t().
// Collects visible text nodes, ignores scripture/code/inputs/data-no-translate
// trees, caches by text hash per lang, batches them to the AI, then swaps.

// EVERYTHING that's either user content, scripture, or a controlled app surface
// that we MUST NOT translate. Casting the net wide is safer than chasing leaks
// per-bug. Scripture rendering goes through .cx-reader-*, .cx-verse*, .cx-col-h,
// .cx-cols-head — all of those stay verbatim.
const SKIP_SEL = [
  "script",
  "style",
  "code",
  "pre",
  "textarea",
  "input",
  "[data-no-translate]",
  "[contenteditable]",
  // Reader / scripture surface — never touch
  ".cx-reader",
  ".cx-reader-body",
  ".cx-reader-titles",
  ".cx-reader-meta",
  ".cx-reader-foot",
  ".cx-cols-head",
  ".cx-col-h",
  ".cx-verse",
  ".cx-verse-side",
  ".cx-verse-text",
  ".cx-verse-num",
  ".cx-chap",
  ".cx-loading",
  // Existing surfaces with user / canon text
  ".bf-draft",
  ".bf-base",
  ".bf-orig",
  ".cx-note-body",
  ".cx-oracle-bubble",
  ".cx-mark-snippet",
  ".cx-search-snippet",
  ".cx-reel-art-verse",
  ".cx-reel-light-text",
  ".cx-reel-symbol-body",
  ".cx-reel-fact-body",
  ".cx-reel-parable-body",
  ".cx-reel-prophecy-text",
  ".cx-reel-count-body",
  ".cx-reel-q-text",
  ".cx-reel-q-answer",
  ".cx-reel-quest-body",
  ".cx-reel-name-hebrew",
  ".cx-reel-name-body",
  // Panels with AI-generated content (translation already implicit)
  ".cx-pane-body",
  ".cx-talmud-quote",
  ".cx-comm-text",
  ".cx-gem-text",
  ".cx-gnosis-text",
  ".cx-exeg-text",
].join(",");

export function _hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "h" + (h >>> 0).toString(36);
}

export function _isCandidateText(t: string | null | undefined): boolean {
  if (!t) return false;
  const s = t.trim();
  if (s.length < 2 || s.length > 140) return false;
  // Must contain at least one ascii letter sequence of length 3+
  if (!/[A-Za-z]{3,}/.test(s)) return false;
  // Skip pure numbers, refs (gen.1.1), urls, file-paths
  if (/^[\d.:,\s-]+$/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^[a-z]+\.\d+\.\d+/i.test(s)) return false;
  return true;
}

export function _shouldSkip(node: Node): boolean {
  let p: Element | null = node.parentElement;
  while (p) {
    // NOTE: preserved from legacy — `p.matches &&` guard is redundant for Element
    // (matches() always exists) but retained as a faithful quirk.
    if (p.matches && p.matches(SKIP_SEL)) return true;
    if (p.getAttribute && p.getAttribute("contenteditable") === "true") return true;
    p = p.parentElement;
  }
  return false;
}

let _domQueue: Map<string, DomQueueEntry> = new Map();
let _domBusy = false;
let _domTimer: ReturnType<typeof setTimeout> | undefined;

function _scheduleFlush(): void {
  if (_domTimer !== undefined) clearTimeout(_domTimer);
  _domTimer = setTimeout(_flushDomQueue, 700);
}

async function _flushDomQueue(): Promise<void> {
  const lang = aw().CODEX_LANG;
  if (!lang || lang === "en" || _domBusy) return;
  if (!hasAIKey()) return;
  if (_domQueue.size === 0) return;

  const cache = loadNodeCache(lang);

  // Apply anything already cached, collect the rest.
  const todo: Array<{ hash: string; text: string; nodes: Text[] }> = [];
  _domQueue.forEach((entry, hash) => {
    const cached = cache[hash];
    if (cached !== undefined) {
      entry.nodes.forEach((n) => {
        try {
          n.nodeValue = cached;
        } catch {}
      });
    } else {
      todo.push({ hash, text: entry.text, nodes: entry.nodes });
    }
  });
  _domQueue = new Map();
  if (todo.length === 0) return;

  _domBusy = true;
  try {
    const BATCH = 40;
    const langName = LANG_NAMES[lang] ?? lang;
    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo.slice(i, i + BATCH);
      const payload: LangDict = {};
      slice.forEach((item) => {
        payload[item.hash] = item.text;
      });
      const sys =
        `You translate visible UI strings from English to ${langName} for a Bible study ` +
        `app. Return ONLY a JSON object using the same keys with each value replaced by a ` +
        `faithful, terse ${langName} translation. Preserve placeholders, casing intent ` +
        `(ALL-CAPS stays ALL-CAPS), punctuation, surrounding whitespace, and emojis. ` +
        `Never add commentary or markdown fences.`;
      const usr = `Translate to ${langName}:\n` + JSON.stringify(payload, null, 2);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: sys,
            messages: [{ role: "user", content: usr }],
            max_tokens: 2200,
          }),
        });
        const data: unknown = await r.json();
        const dataRec =
          data !== null && typeof data === "object" && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : undefined;
        if (!r.ok || dataRec?.["error"]) continue;
        let txt = String(dataRec?.["text"] ?? "")
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/, "");
        const a = txt.indexOf("{");
        const b = txt.lastIndexOf("}");
        if (a < 0 || b < 0) continue;
        let obj: unknown;
        try {
          obj = JSON.parse(txt.slice(a, b + 1));
        } catch {
          continue;
        }
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
        const objRec = obj as Record<string, unknown>;
        slice.forEach((item) => {
          const tr = objRec[item.hash];
          if (typeof tr === "string" && tr.trim()) {
            cache[item.hash] = tr;
            item.nodes.forEach((n) => {
              try {
                n.nodeValue = tr;
              } catch {}
            });
          }
        });
        saveNodeCache(lang, cache);
      } catch {
        /* keep going */
      }
    }
  } finally {
    _domBusy = false;
  }
}

export function _collectAndQueue(root: Node): void {
  const lang = aw().CODEX_LANG;
  if (!lang || lang === "en") return;
  const cache = loadNodeCache(lang);
  // NOTE: preserved from legacy — enValues computed but never referenced in this function
  const _enValues = new Set(Object.values((aw().CODEX_T ?? {})["en"] ?? {}));
  void _enValues;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n: Node): number {
      const tn = n as Text;
      if (!_isCandidateText(tn.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (_shouldSkip(tn)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  // NOTE: preserved from legacy — `touched` is assigned but never read
  let touched = false;
  while ((n = walker.nextNode()) !== null) {
    const textNode = n as Text;
    const raw = textNode.nodeValue ?? "";
    const trimmed = raw.trim();
    // Skip if string equals current translated text (already swapped).
    // Heuristic: must look like English (no extended Hebrew/Greek/Hindi).
    if (/[֐-׿Ͱ-Ͽऀ-ॿ]/.test(trimmed)) continue;
    const h = _hash(trimmed);
    const cached = cache[h];
    if (cached !== undefined) {
      // Apply immediately if not already.
      if (textNode.nodeValue !== cached) {
        try {
          textNode.nodeValue = cached;
          touched = true;
        } catch {}
      }
      continue;
    }
    const entry: DomQueueEntry = _domQueue.get(h) ?? { text: trimmed, nodes: [] };
    // NOTE: preserved from legacy — indexOf used (not .includes()) to match original guard
    if (entry.nodes.indexOf(textNode) === -1) entry.nodes.push(textNode);
    _domQueue.set(h, entry);
  }
  if (_domQueue.size > 0) _scheduleFlush();
  // NOTE: preserved from legacy — `touched` is referenced here only to satisfy
  // the same dead-variable pattern; value is never consumed
  void touched;
}

export function installDomWalker(): void {
  if (aw().__cxDomWalkerInstalled) return;
  aw().__cxDomWalkerInstalled = true;
  const sweep = (): void => {
    if (!document.body) return;
    _collectAndQueue(document.body);
  };
  sweep();
  const mo = new MutationObserver((mutations: MutationRecord[]): void => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) {
          _collectAndQueue(n);
        } else if (
          n.nodeType === 3 &&
          _isCandidateText((n as Text).nodeValue) &&
          !_shouldSkip(n)
        ) {
          // single text node added
          const textNode = n as Text;
          const trimmed = (textNode.nodeValue ?? "").trim();
          const h = _hash(trimmed);
          const entry: DomQueueEntry = _domQueue.get(h) ?? { text: trimmed, nodes: [] };
          entry.nodes.push(textNode);
          _domQueue.set(h, entry);
          _scheduleFlush();
        }
      });
    });
  });
  // NOTE: preserved from legacy — no null-check in original; function is only ever called
  // after DOMContentLoaded, so body is guaranteed at runtime. TS requires the guard.
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });
  }
  // Re-sweep on lang change.
  window.addEventListener("codex:lang", (): void => {
    // Clear the in-memory queue; cached translations re-apply on sweep.
    _domQueue = new Map();
    setTimeout(sweep, 100);
  });
}

export function createApi(): CodexAiTranslateUiApi {
  return {
    translateMissing,
    hydrate,
    hasAIKey,
    clearCache: (lang: string): void => {
      try {
        localStorage.removeItem(CACHE_PREFIX + lang);
      } catch {}
      try {
        localStorage.removeItem(NODE_CACHE_PREFIX + lang);
      } catch {}
    },
    sweepDom: (): void => {
      _domQueue = new Map();
      _collectAndQueue(document.body);
    },
  };
}
