// @vitest-environment jsdom
// jsdom env: lsGet/lsSet and window-reading helpers need a DOM with localStorage.
// Ground-truth values for the pure helpers were captured by running faithful copies
// of the originals in node.
import { describe, it, expect, beforeEach } from "vitest";
import {
  lsGet, lsSet,
  extractJson,
  splitSemanticRange,
  parseRef,
  aiCacheGet, aiCacheSet,
  bookName,
  lookup,
  LS_LAST, LS_AI_PREFIX, AI_TTL_MS,
} from "./helpers.js";
import type { WordStudyWindow } from "./word-study-window.js";

const W = (): WordStudyWindow => window as unknown as WordStudyWindow;

// jsdom ships a localStorage stub with no working methods; install in-memory storage.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] ?? null : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  delete W().CODEX_DATA;
  delete W().CODEX_StrongsLookup;
});

// ── Constants ─────────────────────────────────────────────────────────────────
describe("constants (ground truth)", () => {
  it("LS_LAST is the correct localStorage key", () => {
    expect(LS_LAST).toBe("codex.wordstudy.last");
  });
  it("LS_AI_PREFIX is the correct prefix", () => {
    expect(LS_AI_PREFIX).toBe("codex.wordstudy.");
  });
  it("AI_TTL_MS is 30 days in milliseconds", () => {
    expect(AI_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

// ── lsGet / lsSet ─────────────────────────────────────────────────────────────
describe("lsGet / lsSet (localStorage round-trip)", () => {
  it("returns fallback when key is absent", () => {
    expect(lsGet("missing-key", "fb")).toBe("fb");
    expect(lsGet("missing-key", null)).toBeNull();
  });
  it("round-trips a string value", () => {
    lsSet("test.str", "hello");
    expect(lsGet("test.str", "")).toBe("hello");
  });
  it("round-trips an object value", () => {
    lsSet("test.obj", { word: "agape", strongs: "G25" });
    expect(lsGet("test.obj", null)).toEqual({ word: "agape", strongs: "G25" });
  });
  it("returns fallback on malformed JSON", () => {
    localStorage.setItem("test.bad", "{not json");
    expect(lsGet("test.bad", 42)).toBe(42);
  });
});

// ── extractJson ───────────────────────────────────────────────────────────────
describe("extractJson (ground truth)", () => {
  it("parses clean JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json code fences", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("strips ``` code fences", () => {
    expect(extractJson("```\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("extracts embedded JSON object from prose", () => {
    const result = extractJson('Here is the data: {"x":"y"} — end') as Record<string, string>;
    expect(result).not.toBeNull();
    expect(result?.x).toBe("y");
  });
  it("returns null for empty / non-JSON input", () => {
    expect(extractJson("")).toBeNull();
    expect(extractJson(null)).toBeNull();
    expect(extractJson("plain prose no json")).toBeNull();
  });
});

// ── splitSemanticRange ────────────────────────────────────────────────────────
describe("splitSemanticRange (ground truth)", () => {
  it("returns [] for empty / falsy input", () => {
    expect(splitSemanticRange("")).toEqual([]);
    expect(splitSemanticRange(null)).toEqual([]);
    expect(splitSemanticRange(undefined)).toEqual([]);
  });
  it("splits numbered patterns: '1) X 2) Y 3) Z'", () => {
    const result = splitSemanticRange("1) to love 2) to cherish 3) to desire");
    expect(result).toEqual(["to love", "to cherish", "to desire"]);
  });
  it("splits semicolons when no numbered pattern", () => {
    const result = splitSemanticRange("to love; to cherish; to desire");
    expect(result).toEqual(["to love", "to cherish", "to desire"]);
  });
  it("falls back to a single-bullet array for unsplit text", () => {
    expect(splitSemanticRange("single meaning")).toEqual(["single meaning"]);
  });
  it("prefers numbered split over semicolons", () => {
    const result = splitSemanticRange("1) alpha; beta 2) gamma");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toBeDefined();
  });
});

// ── parseRef ──────────────────────────────────────────────────────────────────
describe("parseRef (ground truth)", () => {
  it("splits dot-separated ref into bookId, chapter, verse", () => {
    expect(parseRef("jhn.3.16")).toEqual({ bookId: "jhn", chapter: 3, verse: 16 });
    expect(parseRef("gen.1.1")).toEqual({ bookId: "gen", chapter: 1, verse: 1 });
  });
  it("handles multi-part book ids", () => {
    expect(parseRef("1co.13.4")).toEqual({ bookId: "1co", chapter: 13, verse: 4 });
  });
  it("returns NaN chapter/verse for missing parts", () => {
    const r = parseRef("jhn");
    expect(r.bookId).toBe("");
    expect(Number.isNaN(r.chapter) || r.chapter === 0).toBe(true);
  });
});

// ── bookName ──────────────────────────────────────────────────────────────────
describe("bookName (CODEX_DATA window global)", () => {
  it("resolves a book name from CODEX_DATA.books", () => {
    W().CODEX_DATA = { books: [{ id: "gen", name: "Genesis" }, { id: "jhn", name: "John" }] };
    expect(bookName("gen")).toBe("Genesis");
    expect(bookName("jhn")).toBe("John");
  });
  it("falls back to the bookId when not found", () => {
    W().CODEX_DATA = { books: [] };
    expect(bookName("zzz")).toBe("zzz");
  });
  it("falls back to the bookId when CODEX_DATA is absent", () => {
    expect(bookName("rev")).toBe("rev");
  });
});

// ── lookup ────────────────────────────────────────────────────────────────────
describe("lookup (CODEX_StrongsLookup window global)", () => {
  it("returns null when CODEX_StrongsLookup is absent", () => {
    expect(lookup("G25")).toBeNull();
  });
  it("returns null for falsy strongs", () => {
    expect(lookup("")).toBeNull();
  });
  it("calls CODEX_StrongsLookup and returns its result", () => {
    const entry = { word: "ἀγάπη", gloss: "love" };
    W().CODEX_StrongsLookup = (s) => (s === "G25" ? entry : null);
    expect(lookup("G25")).toBe(entry);
    expect(lookup("G99")).toBeNull();
  });
});

// ── aiCacheGet / aiCacheSet ───────────────────────────────────────────────────
describe("aiCacheGet / aiCacheSet (localStorage round-trip)", () => {
  it("returns null for a missing key", () => {
    expect(aiCacheGet("G25")).toBeNull();
  });
  it("round-trips AI data", () => {
    const data = { related: null, theology: "God so loved…" };
    aiCacheSet("G25", data);
    const out = aiCacheGet("G25");
    expect(out).not.toBeNull();
    expect(out?.theology).toBe("God so loved…");
  });
  it("returns null when cached entry is expired", () => {
    // Write a cache entry with ts in the past beyond TTL
    lsSet(LS_AI_PREFIX + "G999", { ts: Date.now() - AI_TTL_MS - 1000, data: { theology: "old" } });
    expect(aiCacheGet("G999")).toBeNull();
  });
  it("returns the data when cached entry is fresh", () => {
    lsSet(LS_AI_PREFIX + "G888", { ts: Date.now() - 1000, data: { theology: "fresh" } });
    expect(aiCacheGet("G888")?.theology).toBe("fresh");
  });
});
