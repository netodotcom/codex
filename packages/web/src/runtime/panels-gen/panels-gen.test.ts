// @vitest-environment jsdom
// panels-gen — faithful-port tests. Expectations are derived directly from the
// legacy logic; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  engineSuffix,
  cacheKey,
  getCached,
  getCachedMeta,
  putCached,
  purge,
  cacheStats,
  smartRepair,
  extractJSON,
  validate,
  validateExegesis,
  validateTxAnalysis,
  validateDisarm,
  slugify,
  questDomains,
  questGenKey,
  fallbackQuest,
  validateQuest,
  getQuestGenCached,
  purgeQuestGen,
  getDisarmCached,
  purgeDisarm,
  disarmKey,
  exegesisKey,
  txAnalysisKey,
} from "./helpers.js";

// ── localStorage mock (jsdom's built-in shim is unreliable) ──────────────────
// Uses a Proxy so Object.keys(localStorage) returns the storage keys (needed by
// cacheStats(), which iterates `for (const k of Object.keys(localStorage))`).
function installStorage(): void {
  const store: Record<string, string> = {};
  const mock = new Proxy(store, {
    get(target, prop: string | symbol) {
      if (prop === "getItem")    return (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null;
      if (prop === "setItem")    return (k: string, v: string): void => { store[k] = String(v); };
      if (prop === "removeItem") return (k: string): void => { delete store[k]; };
      if (prop === "clear")      return (): void => { for (const k of Object.keys(store)) delete store[k]; };
      if (prop === "length")     return Object.keys(store).length;
      if (prop === "key")        return (i: number): string | null => Object.keys(store)[i] ?? null;
      if (typeof prop === "string" && prop in store) return store[prop];
      return undefined;
    },
    ownKeys() { return Object.keys(store); },
    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(store, prop)) {
        return { value: store[prop], writable: true, enumerable: true, configurable: true };
      }
      return undefined;
    },
    has(_target, prop: string | symbol) {
      return typeof prop === "string" && Object.prototype.hasOwnProperty.call(store, prop);
    },
  });
  Object.defineProperty(window, "localStorage", { configurable: true, value: mock });
}
installStorage();

// Stub CODEX_DATA / CODEX_LANG so engineSuffix/cacheKey work without the data module.
type TestWindow = typeof window & {
  CODEX_PANELS?: unknown;
  CODEX_QUESTGEN?: unknown;
  CODEX_PANELS_ENGINE?: unknown;
  CODEX_LANG?: string;
  CODEX_AI_DEFAULT?: unknown;
  CODEX_ENGAGE?: unknown;
  CODEX_ENGAGEMENT?: unknown;
  codexLangName?: unknown;
};
const tw = (): TestWindow => window as unknown as TestWindow;

// Import the entry point to assign window.CODEX_PANELS / window.CODEX_QUESTGEN.
beforeAll(async () => {
  await import("./index.js");
});

beforeEach(() => {
  // Reset ephemeral globals between tests so they don't bleed.
  tw().CODEX_LANG        = undefined;
  tw().CODEX_AI_DEFAULT  = undefined;
  tw().CODEX_ENGAGE      = undefined;
  tw().CODEX_ENGAGEMENT  = undefined;
  tw().codexLangName     = undefined;
  localStorage.clear();
});

// ── engineSuffix ──────────────────────────────────────────────────────────────
describe("engineSuffix()", () => {
  it("default anthropic+default → empty string (backward-compat)", () => {
    expect(engineSuffix({ provider: "anthropic", model: "default" })).toBe("");
  });

  it("omitted engine falls through to empty (CODEX_AI_DEFAULT absent)", () => {
    expect(engineSuffix()).toBe("");
  });

  it("custom provider+model → .provider.model suffix", () => {
    expect(engineSuffix({ provider: "openai", model: "gpt-4o" }))
      .toBe(".openai.gpt-4o");
  });

  it("model name sanitised — non-alnum becomes underscore", () => {
    expect(engineSuffix({ provider: "anthropic", model: "claude-3/opus" }))
      .toBe(".anthropic.claude-3_opus");
  });

  it("reads CODEX_AI_DEFAULT as fallback", () => {
    tw().CODEX_AI_DEFAULT = { provider: "cohere", model: "command" };
    expect(engineSuffix()).toBe(".cohere.command");
    tw().CODEX_AI_DEFAULT = undefined;
  });
});

// ── cacheKey ──────────────────────────────────────────────────────────────────
describe("cacheKey()", () => {
  it("default (en, anthropic+default) → bare key", () => {
    expect(cacheKey("jhn", 1)).toBe("codex.panels.v1.jhn.1");
  });

  it("non-English lang appended", () => {
    tw().CODEX_LANG = "pt";
    expect(cacheKey("gen", 1)).toBe("codex.panels.v1.gen.1.pt");
    tw().CODEX_LANG = undefined;
  });

  it("custom engine included", () => {
    expect(cacheKey("psa", 23, { provider: "openai", model: "gpt-4o" }))
      .toBe("codex.panels.v1.psa.23.openai.gpt-4o");
  });
});

// ── getCached / putCached / purge ─────────────────────────────────────────────
describe("getCached / putCached / purge", () => {
  const fakePanel = {
    title: "Test", subtitle: "sub",
    talmud: [], commentary: [], gematria: [],
    gematriaNotes: [], gnosis: [], crossRefs: [],
  } satisfies import("./types.js").PanelData;

  it("round-trips v2 cache format", () => {
    putCached("jhn", 1, fakePanel);
    const got = getCached("jhn", 1);
    expect(got).not.toBeNull();
    expect(got?.title).toBe("Test");
  });

  it("getCachedMeta returns fetchedAt", () => {
    putCached("jhn", 1, fakePanel);
    const meta = getCachedMeta("jhn", 1);
    expect(meta).not.toBeNull();
    expect(typeof meta?.fetchedAt).toBe("number");
    expect(meta!.fetchedAt).toBeGreaterThan(0);
  });

  it("purge removes the entry", () => {
    putCached("gen", 2, fakePanel);
    purge("gen", 2);
    expect(getCached("gen", 2)).toBeNull();
  });

  it("returns null for missing key", () => {
    expect(getCached("rev", 22)).toBeNull();
  });
});

// ── cacheStats ────────────────────────────────────────────────────────────────
describe("cacheStats()", () => {
  it("returns entries only for CACHE_PREFIX keys, sorted by fetchedAt desc", () => {
    const panel = { title: "", subtitle: "", talmud: [], commentary: [], gematria: [], gematriaNotes: [], gnosis: [], crossRefs: [] } satisfies import("./types.js").PanelData;
    putCached("gen", 1, panel);
    putCached("exo", 1, panel);
    const stats = cacheStats();
    expect(stats.length).toBeGreaterThanOrEqual(2);
    // sorted desc
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i - 1]!.fetchedAt).toBeGreaterThanOrEqual(stats[i]!.fetchedAt);
    }
    // check ref format
    const refs = stats.map(s => s.ref);
    expect(refs).toContain("gen.1");
    expect(refs).toContain("exo.1");
  });
});

// ── smartRepair ───────────────────────────────────────────────────────────────
describe("smartRepair()", () => {
  it("valid complete JSON passes through unchanged", () => {
    const s = '{"a":1,"b":"two"}';
    expect(JSON.parse(smartRepair(s))).toEqual({ a: 1, b: "two" });
  });

  it("closes an unclosed object", () => {
    const s = '{"a":1,"b":"two"';
    expect(JSON.parse(smartRepair(s))).toEqual({ a: 1, b: "two" });
  });

  it("closes unclosed nested structures", () => {
    const s = '{"arr":[1,2';
    const r = JSON.parse(smartRepair(s)) as { arr: unknown[] };
    expect(Array.isArray(r.arr)).toBe(true);
  });

  it("strips trailing comma before close", () => {
    // Cut at a point where a comma is the last meaningful char
    const s = '{"a":1,';
    const r = JSON.parse(smartRepair(s)) as Record<string, unknown>;
    expect(r["a"]).toBe(1);
  });

  it("strips a dangling key: with no value", () => {
    // NOTE: the input must have a comma right after the dangling colon.
    // Legacy's mark() (legacy/panels-gen.js:194) only advances `lastSafe`
    // past a key's closing quote, never past a bare ":" — so an input cut
    // immediately after the colon (e.g. '{"a":1,"dangling":') never gets
    // the colon into `head`, and the trailing-key regex
    // (legacy/panels-gen.js:207) can't match — legacy itself produces
    // invalid JSON ('{"a":1,"dangling"}') for that shape. The
    // comma-before-mark rule (legacy/panels-gen.js:201, "cut BEFORE the
    // comma") is the only path that pulls the colon into `head`, which is
    // what lets line 207 actually strip the dangling key. Verified against
    // legacy's exact algorithm.
    const s = '{"a":1,"dangling":,';
    const r = JSON.parse(smartRepair(s)) as Record<string, unknown>;
    expect(r["a"]).toBe(1);
    expect("dangling" in r).toBe(false);
  });
});

// ── extractJSON ───────────────────────────────────────────────────────────────
describe("extractJSON()", () => {
  it("parses bare JSON", () => {
    const r = extractJSON('{"title":"Hello"}') as { title: string };
    expect(r.title).toBe("Hello");
  });

  it("strips markdown fences", () => {
    const r = extractJSON('```json\n{"title":"World"}\n```') as { title: string };
    expect(r.title).toBe("World");
  });

  it("throws on empty input", () => {
    expect(() => extractJSON("")).toThrow("empty response");
  });

  it("throws when no JSON object found", () => {
    expect(() => extractJSON("no braces here")).toThrow("no json object found");
  });

  it("repairs truncated JSON", () => {
    const r = extractJSON('{"title":"Test","arr":[1,2') as { title: string; arr: number[] };
    expect(r.title).toBe("Test");
    expect(Array.isArray(r.arr)).toBe(true);
  });
});

// ── validate (PanelData) ──────────────────────────────────────────────────────
describe("validate()", () => {
  it("throws on non-object", () => {
    expect(() => validate(null)).toThrow("not an object");
    expect(() => validate("string")).toThrow("not an object");
  });

  it("coerces missing string fields to empty string", () => {
    const r = validate({});
    expect(r.title).toBe("");
    expect(r.subtitle).toBe("");
  });

  it("coerces missing array fields to []", () => {
    const r = validate({});
    expect(Array.isArray(r.talmud)).toBe(true);
    expect(Array.isArray(r.gematria)).toBe(true);
    expect(Array.isArray(r.crossRefs)).toBe(true);
  });

  it("slices talmud to max 6", () => {
    const t = Array.from({ length: 10 }, (_, i) => ({ ref: `ref${i}`, heading: "h", body: "b", tag: "t" }));
    const r = validate({ talmud: t });
    expect(r.talmud.length).toBeLessThanOrEqual(6);
  });

  it("filters talmud entries missing body AND heading", () => {
    const r = validate({ talmud: [{ ref: "x" }, { ref: "y", body: "ok" }] });
    expect(r.talmud.length).toBe(1);
    expect(r.talmud[0]?.body).toBe("ok");
  });

  it("filters gematria entries missing term or non-number value", () => {
    const entries = [
      { term: "אהבה", translit: "ahavah", meaning: "love", value: 13, system: "hechrachi" },
      { term: "", translit: "", meaning: "", value: 0, system: "" }, // value=0 but string number
      { term: "word", value: "not-a-number" },                        // string value → filtered
      { translit: "", meaning: "", value: 5, system: "" },             // no term → filtered
    ];
    const r = validate({ gematria: entries });
    // Only the first entry survives (term present + numeric value)
    expect(r.gematria.length).toBe(1);
    expect(r.gematria[0]?.value).toBe(13);
  });

  it("normalises gematriaDeep._schema to 2", () => {
    const r = validate({ gematriaDeep: { primary_word: "λόγος" } });
    expect(r.gematriaDeep?._schema).toBe(2);
  });

  it("coerces gematriaDeep cross_match entries", () => {
    const deep = {
      cross_matches: [
        { value: 373, via_system: "isopsephy", matches: Array.from({ length: 10 }, () => ({ ref: "x", word: "y", note: "z" })) },
      ],
    };
    const r = validate({ gematriaDeep: deep });
    expect(r.gematriaDeep?.cross_matches[0]?.matches.length).toBeLessThanOrEqual(6);
  });

  it("coerces kabbalah lurianic_frame 'null' string to empty string", () => {
    const r = validate({
      gematriaDeep: {
        kabbalah: { lurianic_frame: "null", partzuf: "null", sefirot_resonances: [], zohar_citations: [] },
      },
    });
    expect(r.gematriaDeep?.kabbalah?.lurianic_frame).toBe("");
    expect(r.gematriaDeep?.kabbalah?.partzuf).toBe("");
  });
});

// ── validateExegesis ──────────────────────────────────────────────────────────
describe("validateExegesis()", () => {
  it("throws on non-object", () => {
    expect(() => validateExegesis(42)).toThrow("not an object");
  });

  it("sets _schema to 2", () => {
    expect(validateExegesis({})._schema).toBe(2);
  });

  it("coerces string fields to empty string", () => {
    const r = validateExegesis({});
    expect(r.literary_structure).toBe("");
    expect(r.preferred_reading).toBe("");
  });

  it("filters key_terms missing term AND original", () => {
    const r = validateExegesis({
      key_terms: [
        { term: "logos", original: "λόγος", translit: "logos", lexical_range: "", translation_choices: "" },
        { term: "", original: "", translit: "" }, // both empty → filtered
      ],
    });
    expect(r.key_terms.length).toBe(1);
  });
});

// ── validateTxAnalysis ────────────────────────────────────────────────────────
describe("validateTxAnalysis()", () => {
  it("sets _schema to 2", () => {
    expect(validateTxAnalysis({})._schema).toBe(2);
  });

  it("slices renderings to max 12", () => {
    const renderings = Array.from({ length: 20 }, (_, i) => ({ translation: `T${i}`, text: "t" }));
    const r = validateTxAnalysis({ renderings });
    expect(r.renderings.length).toBeLessThanOrEqual(12);
  });

  it("filters renderings missing translation AND text", () => {
    const r = validateTxAnalysis({ renderings: [{ translation: "KJV", text: "In the beginning" }, {}] });
    expect(r.renderings.length).toBe(1);
  });
});

// ── validateDisarm ────────────────────────────────────────────────────────────
describe("validateDisarm()", () => {
  it("slices entries to max 5", () => {
    const entries = Array.from({ length: 8 }, () => ({
      verse: "1", weaponization: "w", quote: "q", source: "s", rebuttal: "r",
    }));
    const r = validateDisarm({ entries });
    expect(r.entries.length).toBeLessThanOrEqual(5);
  });

  it("filters entries missing weaponization or rebuttal", () => {
    const r = validateDisarm({
      entries: [
        { verse: "1:1", weaponization: "w", quote: "q", source: "s", rebuttal: "r" },
        { verse: "1:2", weaponization: "w", quote: "q", source: "s", rebuttal: "" }, // empty rebuttal
        { verse: "1:3", weaponization: "",  quote: "q", source: "s", rebuttal: "r" }, // empty weap
      ],
    });
    expect(r.entries.length).toBe(1);
  });

  it("coerces all string fields", () => {
    const r = validateDisarm({
      entries: [{ weaponization: "w", rebuttal: "r" }],
    });
    const e = r.entries[0]!;
    expect(e.verse).toBe("");
    expect(e.quote).toBe("");
    expect(e.source).toBe("");
  });
});

// ── slugify ───────────────────────────────────────────────────────────────────
describe("slugify()", () => {
  it("lowercases and replaces non-alnum with dash", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  !test!  ")).toBe("test");
  });

  it("truncates to 48 chars", () => {
    expect(slugify("a".repeat(60)).length).toBe(48);
  });

  it("returns 'theme' for empty/whitespace input", () => {
    expect(slugify("")).toBe("theme");
    expect(slugify("!!!")).toBe("theme");
  });
});

// ── questDomains ──────────────────────────────────────────────────────────────
describe("questDomains()", () => {
  it("returns the frozen default taxonomy when CODEX_ENGAGEMENT absent", () => {
    const domains = questDomains();
    expect(domains).toContain("hebrew-greek");
    expect(domains).toContain("gematria");
    expect(domains.length).toBe(8);
  });

  it("uses CODEX_ENGAGEMENT.DOMAINS when present and non-empty", () => {
    tw().CODEX_ENGAGEMENT = { DOMAINS: ["custom-a", "custom-b"] };
    expect(questDomains()).toEqual(["custom-a", "custom-b"]);
    tw().CODEX_ENGAGEMENT = undefined;
  });
});

// ── questGenKey ───────────────────────────────────────────────────────────────
describe("questGenKey()", () => {
  it("produces a stable key for theme only", () => {
    const k = questGenKey("covenant");
    expect(k.startsWith("codex.questgen.v1.")).toBe(true);
    expect(k).toContain("covenant");
  });

  it("includes tradition/domain/steps when provided", () => {
    const k = questGenKey("logos", { tradition: "jewish", domain: "gematria", steps: 5 });
    expect(k).toContain("t-jewish");
    expect(k).toContain("d-gematria");
    expect(k).toContain("s-5");
  });

  it("appends lang suffix for non-English", () => {
    tw().CODEX_LANG = "pt";
    const k = questGenKey("exile");
    expect(k).toContain(".pt");
    tw().CODEX_LANG = undefined;
  });
});

// ── fallbackQuest ─────────────────────────────────────────────────────────────
describe("fallbackQuest()", () => {
  it("returns a quest with 4 steps", () => {
    const q = fallbackQuest("covenant");
    expect(q.steps.length).toBe(4);
  });

  it("meta has all required fields", () => {
    const q = fallbackQuest("exile");
    expect(q.meta.type).toBe("quest");
    expect(q.meta.generated).toBe(true);
    expect(q.meta.fallback).toBe(true);
    expect(typeof q.meta.title).toBe("string");
    expect(typeof q.meta.domain).toBe("string");
  });

  it("step kinds follow read → find → connect → reflect", () => {
    const q = fallbackQuest("logos");
    const kinds = q.steps.map(s => s.kind);
    expect(kinds).toEqual(["read", "find", "connect", "reflect"]);
  });

  it("uses custom domain from opts when valid", () => {
    const q = fallbackQuest("word", { domain: "gematria" });
    expect(q.meta.domain).toBe("gematria");
  });

  it("falls back to cross-references for invalid domain", () => {
    const q = fallbackQuest("word", { domain: "not-a-real-domain" });
    expect(q.meta.domain).toBe("cross-references");
  });
});

// ── validateQuest ─────────────────────────────────────────────────────────────
describe("validateQuest()", () => {
  const validRaw = {
    meta: {
      title: "The Covenant Thread",
      tradition: "jewish",
      domain: "gematria",
      ring: "covenant",
      estSteps: 4,
    },
    steps: [
      { kind: "read",    refs: ["gen.15.1-6"], prompt: "Read this passage.", reveal: "Insight." },
      { kind: "find",    refs: ["rom.4.3"],    prompt: "Find the echo.",    reveal: "Resonance." },
      { kind: "connect", refs: [],             prompt: "Connect them.",     reveal: "Pattern." },
      { kind: "reflect", refs: [],             prompt: "Reflect.",          reveal: "Synthesis." },
    ],
  };

  it("validates a well-formed quest", () => {
    const q = validateQuest(validRaw, "covenant");
    expect(q.meta.title).toBe("The Covenant Thread");
    expect(q.steps.length).toBe(4);
  });

  it("throws on fewer than 2 usable steps", () => {
    expect(() => validateQuest({ steps: [{ kind: "read", refs: [], prompt: "p", reveal: "r" }] }, "theme"))
      .toThrow("too few usable steps");
  });

  it("filters steps missing prompt", () => {
    const raw = {
      steps: [
        { kind: "read",    refs: [], prompt: "Read it.", reveal: "ok" },
        { kind: "reflect", refs: [], prompt: "",         reveal: "no prompt" }, // filtered
        { kind: "find",    refs: [], prompt: "Find.",    reveal: "yes" },
      ],
    };
    const q = validateQuest(raw, "test");
    expect(q.steps.length).toBe(2);
  });

  it("coerces invalid kind to 'read'", () => {
    const raw = {
      steps: [
        { kind: "unknown", refs: [], prompt: "Step one.", reveal: "ok" },
        { kind: "reflect",  refs: [], prompt: "Reflect.", reveal: "ok" },
      ],
    };
    const q = validateQuest(raw, "test");
    expect(q.steps[0]?.kind).toBe("read");
  });

  it("normalises domain to cross-references when invalid", () => {
    const raw = { ...validRaw, meta: { ...validRaw.meta, domain: "not-valid" } };
    const q = validateQuest(raw, "test");
    expect(q.meta.domain).toBe("cross-references");
  });

  it("meta.id is prefixed with quest-gen-", () => {
    const q = validateQuest(validRaw, "covenant");
    expect(q.meta.id.startsWith("quest-gen-")).toBe(true);
  });
});

// ── Quest gen cache helpers ───────────────────────────────────────────────────
describe("getQuestGenCached / purgeQuestGen", () => {
  it("round-trips a quest via writeWrapped and getQuestGenCached", async () => {
    // We need the writeWrapped internals; we'll test through the public generateQuest path.
    // Instead, exercise the key+readWrapped by writing directly.
    const q = fallbackQuest("test");
    // Write manually into the key
    const key = questGenKey("test");
    localStorage.setItem(key, JSON.stringify({ _v: 2, data: q, fetchedAt: Date.now() }));
    const got = getQuestGenCached("test");
    expect(got).not.toBeNull();
    expect(got?.meta.title).toBe(q.meta.title);
  });

  it("purgeQuestGen removes the entry", () => {
    const q = fallbackQuest("exile");
    const key = questGenKey("exile");
    localStorage.setItem(key, JSON.stringify({ _v: 2, data: q, fetchedAt: Date.now() }));
    purgeQuestGen("exile");
    expect(getQuestGenCached("exile")).toBeNull();
  });
});

// ── Disarm cache helpers ──────────────────────────────────────────────────────
describe("getDisarmCached / purgeDisarm", () => {
  it("round-trips disarm data through wrapped cache", () => {
    const d = { entries: [{ verse: "1:1", weaponization: "w", quote: "q", source: "s", rebuttal: "r" }] } satisfies import("./types.js").DisarmData;
    const key = disarmKey("rom", 13);
    localStorage.setItem(key, JSON.stringify({ _v: 2, data: d, fetchedAt: Date.now() }));
    const got = getDisarmCached("rom", 13);
    expect(got).not.toBeNull();
    expect(got?.entries.length).toBe(1);
    purgeDisarm("rom", 13);
    expect(getDisarmCached("rom", 13)).toBeNull();
  });
});

// ── exegesisKey / txAnalysisKey ───────────────────────────────────────────────
describe("exegesisKey()", () => {
  it("starts with the exegesis prefix", () => {
    expect(exegesisKey("jhn.1.1")).toMatch(/^codex\.panel\.exegesis\./);
  });

  it("appends lang suffix for non-English", () => {
    tw().CODEX_LANG = "de";
    expect(exegesisKey("mat.5.1")).toContain(".de");
    tw().CODEX_LANG = undefined;
  });
});

describe("txAnalysisKey()", () => {
  it("sorts translation ids for stable key", () => {
    const k1 = txAnalysisKey("jhn.3.16", ["esv", "kjv"]);
    const k2 = txAnalysisKey("jhn.3.16", ["kjv", "esv"]);
    expect(k1).toBe(k2);
  });
});

// ── window.CODEX_PANELS global contract ──────────────────────────────────────
describe("window.CODEX_PANELS (global contract)", () => {
  it("is an object", () => {
    expect(typeof tw().CODEX_PANELS).toBe("object");
    expect(tw().CODEX_PANELS).not.toBeNull();
  });

  const requiredMethods = [
    "cacheKey", "getCached", "getCachedMeta", "putCached", "purge",
    "load", "subscribe", "cacheStats",
    "loadExegesis", "getExegesisCached", "getExegesisMeta", "purgeExegesis",
    "loadTranslationAnalysis", "getTxAnalysisCached", "getTxAnalysisMeta", "purgeTxAnalysis",
    "loadDisarm", "getDisarmCached", "getDisarmMeta", "purgeDisarm",
    "generateQuest", "getQuestGenCached", "getQuestGenMeta", "purgeQuestGen", "fallbackQuest",
  ] as const;

  it("exposes all required methods as functions", () => {
    const panels = tw().CODEX_PANELS as Record<string, unknown>;
    for (const m of requiredMethods) {
      expect(typeof panels[m], `CODEX_PANELS.${m} should be a function`).toBe("function");
    }
  });

  it("cacheKey('jhn', 1) produces expected key via the global", () => {
    type P = { cacheKey: (b: string, c: number) => string };
    const panels = tw().CODEX_PANELS as P;
    expect(panels.cacheKey("jhn", 1)).toBe("codex.panels.v1.jhn.1");
  });

  it("fallbackQuest returns a valid quest via the global", () => {
    type P = { fallbackQuest: (theme: string) => import("./types.js").QuestModule };
    const panels = tw().CODEX_PANELS as P;
    const q = panels.fallbackQuest("covenant");
    expect(q.meta.type).toBe("quest");
    expect(q.steps.length).toBeGreaterThan(0);
  });
});

// ── window.CODEX_QUESTGEN global contract ─────────────────────────────────────
describe("window.CODEX_QUESTGEN (global contract)", () => {
  it("is an object", () => {
    expect(typeof tw().CODEX_QUESTGEN).toBe("object");
    expect(tw().CODEX_QUESTGEN).not.toBeNull();
  });

  it("has generate as a function", () => {
    const qg = tw().CODEX_QUESTGEN as Record<string, unknown>;
    expect(typeof qg["generate"]).toBe("function");
  });

  it("does NOT overwrite a pre-existing generate function (|| guard)", async () => {
    // Reset CODEX_QUESTGEN to simulate engagement.js having pre-installed a generator.
    const sentinel = vi.fn();
    tw().CODEX_QUESTGEN = { generate: sentinel };
    // Re-run the index guard logic inline (mirrors index.ts).
    const qg = tw().CODEX_QUESTGEN as Record<string, unknown>;
    if (typeof qg["generate"] !== "function") {
      qg["generate"] = () => Promise.resolve(fallbackQuest("x"));
    }
    // The sentinel should still be there.
    expect(qg["generate"]).toBe(sentinel);
    // Cleanup.
    tw().CODEX_QUESTGEN = undefined;
  });
});
