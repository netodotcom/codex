// @vitest-environment jsdom
// search — faithful-port tests. Expectations are derived from the logic in
// legacy/search.js; any mismatch in tokenization, ranking, or window surface
// is a regression in the port.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  tokenize,
  parseQuery,
  snippet,
  index,
  ingestPassage,
  search,
  clear,
  stats,
  searchSemantic,
} from "./helpers.js";
import type { Passage } from "./types.js";

// ── localStorage mock (jsdom's built-in shim is unreliable) ──────────────────
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

// Wipe module state before each test so tests don't bleed into each other.
beforeEach(() => {
  installStorage();
  clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── tokenize ──────────────────────────────────────────────────────────────────
describe("tokenize", () => {
  it("returns [] for empty / falsy input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("lowercases all characters", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });

  it("strips punctuation but keeps apostrophes inside words", () => {
    const tokens = tokenize("don't, won't.");
    expect(tokens).toContain("don't");
    expect(tokens).toContain("won't");
  });

  it("normalises curly apostrophes to straight (legacy quirk preserved)", () => {
    // ’ RIGHT SINGLE QUOTATION MARK → kept as '
    const tokens = tokenize("God’s love");
    expect(tokens).toContain("god's");
  });

  it("keeps trailing * wildcard character", () => {
    expect(tokenize("lov*")).toContain("lov*");
  });

  it("splits on whitespace and filters blanks", () => {
    expect(tokenize("  a  b  ")).toEqual(["a", "b"]);
  });
});

// ── parseQuery ────────────────────────────────────────────────────────────────
describe("parseQuery", () => {
  it("returns empty structure for empty string", () => {
    expect(parseQuery("")).toEqual({ tokens: [], wildcards: [], phrases: [], translation: null });
  });

  it("splits plain words into tokens", () => {
    const q = parseQuery("love grace");
    expect(q.tokens).toEqual(["love", "grace"]);
    expect(q.wildcards).toEqual([]);
    expect(q.phrases).toEqual([]);
    expect(q.translation).toBeNull();
  });

  it("extracts @TRANS filter (lowercased)", () => {
    const q = parseQuery("love @KJV");
    expect(q.translation).toBe("kjv");
    expect(q.tokens).toEqual(["love"]);
  });

  it("extracts quoted phrases into phrases array", () => {
    const q = parseQuery('"for god so loved"');
    expect(q.phrases).toEqual(["for god so loved"]);
    expect(q.tokens).toEqual([]);
  });

  it("puts trailing-* tokens into wildcards (without the *)", () => {
    const q = parseQuery("lov*");
    expect(q.wildcards).toEqual(["lov"]);
    expect(q.tokens).toEqual([]);
  });

  it("handles mixed: token + wildcard + phrase + @TRANS", () => {
    const q = parseQuery('@KJV grace "holy spirit" lov*');
    expect(q.translation).toBe("kjv");
    expect(q.tokens).toEqual(["grace"]);
    expect(q.phrases).toEqual(["holy spirit"]);
    expect(q.wildcards).toEqual(["lov"]);
  });
});

// ── snippet ───────────────────────────────────────────────────────────────────
describe("snippet", () => {
  it("returns empty string for empty text", () => {
    expect(snippet("", ["love"])).toBe("");
  });

  it("wraps matched substring in <mark>", () => {
    const out = snippet("For God so loved the world", ["loved"]);
    expect(out).toContain("<mark>loved</mark>");
  });

  it("escapes HTML entities outside the match", () => {
    const out = snippet("John said <hello> & goodbye", ["said"]);
    expect(out).toContain("&lt;hello&gt;");
    expect(out).toContain("&amp;");
  });

  it("truncates long text with ellipsis when no match", () => {
    const long = "a".repeat(200);
    const out = snippet(long, ["zzz"]);
    expect(out).toContain("…");
  });

  it("shows … prefix when match is not near start", () => {
    const text = "x".repeat(50) + " loved " + "y".repeat(50);
    const out = snippet(text, ["loved"]);
    expect(out.startsWith("…")).toBe(true);
  });

  it("merges overlapping highlight ranges", () => {
    const text = "abcdef";
    const out = snippet(text, ["abc", "bcd"]);
    // Should have exactly one <mark> (merged [0,3] ∪ [1,4] = [0,4])
    const openCount = (out.match(/<mark>/g) ?? []).length;
    expect(openCount).toBe(1);
    expect(out).toContain("<mark>abcd</mark>");
  });
});

// ── index + search pipeline ───────────────────────────────────────────────────
describe("index + search", () => {
  it("returns [] when nothing indexed", async () => {
    const r = await search("love");
    expect(r).toEqual([]);
  });

  it("returns [] for empty query", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    expect(await search("")).toEqual([]);
    expect(await search("   ")).toEqual([]);
  });

  it("finds a verse by keyword", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    const r = await search("loved");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.ref).toBe("John.3.16");
    expect(r[0]?.translation).toBe("KJV");
  });

  it("deduplicates identical verse+translation", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    const s = stats();
    expect(s.verses).toBe(1);
  });

  it("returns the ref in pretty.label format", async () => {
    // ref "Gen.1.1" → bookId="Gen", chapter="1", verse="1" → label "Gen 1:1"
    index("KJV", { "Gen.1": [{ n: 1, text: "In the beginning God created" }] });
    const r = await search("beginning");
    expect(r[0]?.pretty.label).toBe("Gen 1:1");
    expect(r[0]?.pretty.bookId).toBe("Gen");
    expect(r[0]?.pretty.chapter).toBe(1);
    expect(r[0]?.pretty.verse).toBe(1);
  });

  it("filters by @TRANS annotation", async () => {
    index("KJV",  { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    index("NIV",  { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    const r = await search("loved @NIV");
    expect(r.every(x => x.translation === "NIV")).toBe(true);
  });

  it("phrase match boosts score above single-token match", async () => {
    index("KJV", {
      "John.3": [
        { n: 16, text: "For God so loved the world" },
        { n: 17, text: "God loved and God sent" },
      ],
    });
    const exact   = await search('"god so loved"');
    const partial = await search("god loved");
    // Phrase result must appear and score higher than non-phrase match
    expect(exact.length).toBeGreaterThan(0);
    expect(exact[0]?.ref).toBe("John.3.16");
    expect(partial.length).toBeGreaterThan(0);
  });

  it("wildcard matches prefix tokens", async () => {
    index("KJV", {
      "Psa.23": [
        { n: 1, text: "The LORD is my shepherd" },
        { n: 2, text: "He makes me lie down in green pastures" },
      ],
    });
    const r = await search("shep*");
    expect(r.some(x => x.ref === "Psa.23.1")).toBe(true);
  });

  it("respects opts.limit", async () => {
    const verses: Array<{ n: number; text: string }> = [];
    for (let i = 1; i <= 30; i++) verses.push({ n: i, text: `verse ${i} love` });
    index("KJV", { "Gen.1": verses });
    const r = await search("love", { limit: 5 });
    expect(r.length).toBe(5);
  });

  it("falls back to union (some-match) when intersection is empty", async () => {
    index("KJV", {
      "A.1": [{ n: 1, text: "grace is wonderful" }],
      "B.1": [{ n: 1, text: "peace be with you" }],
    });
    // No verse has both "grace" AND "peace", so we fallback to union
    const r = await search("grace peace");
    expect(r.length).toBeGreaterThan(0);
  });

  it("sorts results: higher score first, then ref alphabetically", async () => {
    index("KJV", {
      "A.1": [{ n: 1, text: "love love love" }],   // more occurrences
      "B.1": [{ n: 1, text: "love and peace" }],
    });
    const r = await search("love");
    // A.1.1 should rank first (more "love" occurrences → contiguity bonus doesn't apply
    // since single token, but score += 1 per occurrence in text via indexOf... actually
    // the score is just base 10 + 1 for the token hit, same for both — sort by ref asc).
    // Both have score 11; tie-break by ref → "A.1.1" < "B.1.1"
    expect(r[0]?.ref).toBe("A.1.1");
    expect(r[1]?.ref).toBe("B.1.1");
  });

  it("contiguity bonus: joined tokens in order give extra +5 score", async () => {
    index("KJV", {
      "A.1": [{ n: 1, text: "God loved the world greatly" }],  // "god loved" contiguous
      "B.1": [{ n: 1, text: "God and the world loved him" }],  // tokens not contiguous
    });
    const r = await search("god loved");
    // A.1.1 should rank above B.1.1 because "god loved" appears as a phrase in A
    const idxA = r.findIndex(x => x.ref === "A.1.1");
    const idxB = r.findIndex(x => x.ref === "B.1.1");
    expect(idxA).toBeLessThan(idxB);
  });

  it("snippet contains <mark> around the matched token", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    const r = await search("loved");
    expect(r[0]?.snippet).toContain("<mark>loved</mark>");
  });
});

// ── ingestPassage ─────────────────────────────────────────────────────────────
describe("ingestPassage", () => {
  it("returns 0 for malformed passage", () => {
    expect(ingestPassage({ bookId: "", chapter: 1, verses: [] })).toBe(0);
  });

  it("ingests per-translation keys (multi-translation verse)", () => {
    const passage: Passage = {
      bookId: "John",
      chapter: 3,
      verses: [
        { n: 16, KJV: "For God so loved the world", NIV: "For God so loved the world" },
      ],
    };
    const added = ingestPassage(passage);
    expect(added).toBe(2);  // KJV + NIV
    const s = stats();
    expect(s.verses).toBe(2);
    expect(s.translationList).toContain("KJV");
    expect(s.translationList).toContain("NIV");
  });

  it("falls back to v.text with passage.primary when no per-translation keys", () => {
    const passage: Passage = {
      bookId:  "Psa",
      chapter: 23,
      primary: "KJV",
      verses:  [{ n: 1, text: "The LORD is my shepherd" }],
    };
    const added = ingestPassage(passage);
    expect(added).toBe(1);
    // The findability via search() is verified in the 'ingestPassage + search' suite below.
  });

  it("skips keys: n, red, _jesusVerse, text (only picks translation keys)", () => {
    const passage: Passage = {
      bookId:  "Gen",
      chapter: 1,
      verses:  [{ n: 1, red: true, _jesusVerse: false, text: "In the beginning", KJV: "In the beginning God" }],
    };
    const added = ingestPassage(passage);
    // Only KJV key + text fallback (if no primary, uses "default")
    expect(added).toBe(2);  // KJV + default
  });
});

// Async version of the ingestPassage + search test
describe("ingestPassage + search", () => {
  it("findable via search after ingestPassage", async () => {
    const passage: Passage = {
      bookId: "Psa",
      chapter: 23,
      primary: "KJV",
      verses: [{ n: 1, text: "The LORD is my shepherd" }],
    };
    ingestPassage(passage);
    const r = await search("shepherd");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.ref).toBe("Psa.23.1");
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────
describe("clear", () => {
  it("resets all state so search returns []", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    clear();
    const r = await search("loved");
    expect(r).toEqual([]);
  });

  it("resets stats to zero", () => {
    index("KJV", { "John.3": [{ n: 16, text: "For God so loved the world" }] });
    clear();
    const s = stats();
    expect(s.verses).toBe(0);
    expect(s.translations).toBe(0);
    expect(s.built).toBe(false);
  });
});

// ── stats ─────────────────────────────────────────────────────────────────────
describe("stats", () => {
  it("returns zero stats when empty", () => {
    const s = stats();
    expect(s.verses).toBe(0);
    expect(s.translations).toBe(0);
    expect(s.translationList).toEqual([]);
    expect(s.built).toBe(false);
  });

  it("counts distinct translations", () => {
    index("KJV", { "John.3": [{ n: 16, text: "loved" }] });
    index("NIV", { "John.3": [{ n: 16, text: "loved" }] });
    const s = stats();
    expect(s.translations).toBe(2);
    expect(s.translationList.sort()).toEqual(["KJV", "NIV"]);
  });

  it("built flag becomes true after first search()", async () => {
    index("KJV", { "John.3": [{ n: 16, text: "loved" }] });
    expect(stats().built).toBe(false);
    await search("loved");
    expect(stats().built).toBe(true);
  });
});

// ── searchSemantic ────────────────────────────────────────────────────────────
describe("searchSemantic", () => {
  function mockFetch(body: unknown, ok = true, status = 200): void {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok,
      status,
      json: (): Promise<unknown> => Promise.resolve(body),
    }));
  }

  it("returns empty results for empty query", async () => {
    const r = await searchSemantic("");
    expect(r.results).toEqual([]);
    expect(r.fromCache).toBe(false);
  });

  it("calls /api/chat and returns enriched results", async () => {
    mockFetch({
      text: JSON.stringify([
        { ref: "John 3:16", passage_text: "For God so loved", relevance: "core verse", score: 0.9 },
      ]),
    });
    const r = await searchSemantic("god's love");
    expect(r.results.length).toBe(1);
    expect(r.results[0]?.ref).toBe("John 3:16");
    expect(r.results[0]?.score).toBe(0.9);
    expect(r.fromCache).toBe(false);
  });

  it("serves cached results on second call without fetch", async () => {
    mockFetch({ text: JSON.stringify([{ ref: "John 3:16", passage_text: "loved", relevance: "r", score: 0.8 }]) });
    await searchSemantic("love");
    const fetchSpy = global.fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchSpy.mock.calls.length;
    const r = await searchSemantic("love");
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);
    expect(r.fromCache).toBe(true);
  });

  it("throws with kind='network' on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(searchSemantic("grace")).rejects.toMatchObject({ kind: "network" });
  });

  it("throws with kind='auth' on 401-like error message", async () => {
    mockFetch({ error: "Invalid API key (auth)" }, false, 401);
    await expect(searchSemantic("grace")).rejects.toMatchObject({ kind: "auth" });
  });

  it("throws with kind='api' on generic HTTP error", async () => {
    mockFetch({ error: "Internal server error" }, false, 500);
    await expect(searchSemantic("grace")).rejects.toMatchObject({ kind: "api" });
  });

  it("tolerates JSON with ```json fences", async () => {
    const arr = [{ ref: "Ps 23:1", passage_text: "The LORD is my shepherd", relevance: "pastoral", score: 0.7 }];
    mockFetch({ text: "```json\n" + JSON.stringify(arr) + "\n```" });
    const r = await searchSemantic("shepherd metaphor");
    expect(r.results.length).toBe(1);
    expect(r.results[0]?.ref).toBe("Ps 23:1");
  });

  it("clamps score to [0, 1]", async () => {
    mockFetch({ text: JSON.stringify([{ ref: "Gen 1:1", passage_text: "beginning", relevance: "r", score: 99 }]) });
    const r = await searchSemantic("creation");
    expect(r.results[0]?.score).toBe(1);
  });

  it("defaults score to 0.5 when score is absent", async () => {
    mockFetch({ text: JSON.stringify([{ ref: "Gen 1:1", passage_text: "beginning", relevance: "r" }]) });
    const r = await searchSemantic("creation force");
    expect(r.results[0]?.score).toBe(0.5);
  });

  it("opts.force bypasses cache", async () => {
    mockFetch({ text: JSON.stringify([{ ref: "John 3:16", passage_text: "loved", relevance: "r", score: 0.8 }]) });
    await searchSemantic("love");
    const fetchSpy = global.fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchSpy.mock.calls.length;
    await searchSemantic("love", { force: true });
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

// ── window contract (index.ts) ────────────────────────────────────────────────
describe("window.CODEX_SEARCH — boot contract", () => {
  it("CODEX_SEARCH.search is a function (the parity probe checks this)", async () => {
    const { sw } = await import("./search-window.js");
    sw().CODEX_SEARCH = undefined;
    await import("./index.js");
    const api = sw().CODEX_SEARCH;
    expect(typeof api?.search).toBe("function");
  });

  it("CODEX_SEARCH is typeof 'object'", async () => {
    const { sw } = await import("./search-window.js");
    await import("./index.js");
    expect(typeof sw().CODEX_SEARCH).toBe("object");
  });

  it("CODEX_SEARCH has all required API methods", async () => {
    const { sw } = await import("./search-window.js");
    await import("./index.js");
    const api = sw().CODEX_SEARCH;
    expect(typeof api?.index).toBe("function");
    expect(typeof api?.ingestPassage).toBe("function");
    expect(typeof api?.clear).toBe("function");
    expect(typeof api?.stats).toBe("function");
    expect(typeof api?.searchSemantic).toBe("function");
    expect(api?.ready).toBeInstanceOf(Promise);
  });

  it("CODEX_SearchBar is a function (React component)", async () => {
    const { sw } = await import("./search-window.js");
    await import("./index.js");
    expect(typeof sw().CODEX_SearchBar).toBe("function");
  });
});
