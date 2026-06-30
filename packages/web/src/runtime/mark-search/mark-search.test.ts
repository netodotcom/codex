// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readCache,
  writeCache,
  clearCache,
  sigFor,
  previewMark,
  rank,
  CACHE_KEY,
  CACHE_MAX,
} from "./helpers.js";
import type { Mark, RankResult, CacheEntry, CacheStore } from "./types.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// jsdom's built-in localStorage shim is unreliable; install a real in-memory one.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

const sampleMark: Mark = {
  key: "mark-1",
  ref: "John 3:16",
  color: "yellow",
  note: "God so loved",
  text: "For God so loved the world",
  ts: 1000,
  pinned: false,
};

beforeEach(() => {
  installStorage();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── readCache ─────────────────────────────────────────────────────────────────

describe("readCache", () => {
  it("returns {} when nothing stored", () => {
    expect(readCache()).toEqual({});
  });

  it("returns {} on corrupt JSON", () => {
    localStorage.setItem(CACHE_KEY, "{broken");
    expect(readCache()).toEqual({});
  });

  it("returns {} when localStorage holds null JSON", () => {
    localStorage.setItem(CACHE_KEY, "null");
    expect(readCache()).toEqual({});
  });

  it("returns parsed cache", () => {
    const entry: CacheEntry = { ts: 1000, results: [{ key: "mark-1", reason: "love" }] };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ sig1: entry }));
    expect(readCache()).toEqual({ sig1: entry });
  });
});

// ── writeCache ────────────────────────────────────────────────────────────────

describe("writeCache", () => {
  it("persists cache to localStorage", () => {
    const cache: CacheStore = { sig1: { ts: 1000, results: [] } };
    writeCache(cache);
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheStore;
    expect(stored).toEqual(cache);
  });

  it("does not evict when at exact CACHE_MAX", () => {
    const cache: CacheStore = {};
    for (let i = 0; i < CACHE_MAX; i++) {
      cache[`sig${i}`] = { ts: i, results: [] };
    }
    writeCache(cache);
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheStore;
    expect(Object.keys(stored).length).toBe(CACHE_MAX);
  });

  it("evicts oldest entries when over CACHE_MAX, preserving newest", () => {
    const cache: CacheStore = {};
    // CACHE_MAX + 5 entries (ts = index; oldest = sig0..sig4)
    for (let i = 0; i <= CACHE_MAX + 4; i++) {
      cache[`sig${i}`] = { ts: i, results: [] };
    }
    writeCache(cache);
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheStore;
    expect(Object.keys(stored).length).toBe(CACHE_MAX);
    // Oldest 5 must be gone
    for (let i = 0; i < 5; i++) {
      expect(stored[`sig${i}`]).toBeUndefined();
    }
    // Newest must survive
    expect(stored[`sig${CACHE_MAX + 4}`]).toBeDefined();
  });

  it("treats entries without ts as oldest (ts=0 fallback)", () => {
    // One entry with no ts (will have ts=0 via ??) and one with ts=1.
    // Fill to CACHE_MAX+1 total with the no-ts entry, expect it evicted.
    const cache: CacheStore = {};
    // noTs entry
    cache["noTs"] = { ts: 0, results: [] };
    for (let i = 1; i <= CACHE_MAX; i++) {
      cache[`sig${i}`] = { ts: i, results: [] };
    }
    writeCache(cache);
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheStore;
    expect(Object.keys(stored).length).toBe(CACHE_MAX);
    expect(stored["noTs"]).toBeUndefined();
  });

  it("does not throw on localStorage quota error", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => writeCache({})).not.toThrow();
    spy.mockRestore();
  });
});

// ── clearCache ────────────────────────────────────────────────────────────────

describe("clearCache", () => {
  it("removes the cache key from localStorage", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ test: 1 }));
    clearCache();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("does not throw when key is absent", () => {
    expect(() => clearCache()).not.toThrow();
  });
});

// ── sigFor ────────────────────────────────────────────────────────────────────

describe("sigFor", () => {
  it("normalises query to lowercase + trimmed", () => {
    expect(sigFor("  Love  ", [sampleMark])).toBe(sigFor("love", [sampleMark]));
  });

  it("includes sorted keys and total count", () => {
    const marks: Mark[] = [
      { ...sampleMark, key: "b" },
      { ...sampleMark, key: "a" },
    ];
    expect(sigFor("love", marks)).toBe("love||2||a,b");
  });

  it("distinguishes different queries for same marks", () => {
    expect(sigFor("love", [sampleMark])).not.toBe(sigFor("faith", [sampleMark]));
  });

  it("distinguishes same query for different mark sets", () => {
    const other: Mark[] = [{ ...sampleMark, key: "mark-2" }];
    expect(sigFor("love", [sampleMark])).not.toBe(sigFor("love", other));
  });

  it("handles empty query", () => {
    const sig = sigFor("", [sampleMark]);
    expect(sig).toBe("||1||mark-1");
  });
});

// ── previewMark ───────────────────────────────────────────────────────────────

describe("previewMark", () => {
  it("formats a mark with all fields at index 0", () => {
    const result = previewMark(sampleMark, 0);
    expect(result).toBe('1. [mark-1] John 3:16 · yellow · note:"God so loved" · text:"For God so loved the world"');
  });

  it("uses 1-based index", () => {
    expect(previewMark(sampleMark, 4)).toMatch(/^5\./);
  });

  it("falls back to ? for empty ref and color", () => {
    const m: Mark = { key: "mk1", ref: "", color: "", ts: 0 };
    expect(previewMark(m, 0)).toBe("1. [mk1] ? · ?");
  });

  it("omits note and text when absent", () => {
    const m: Mark = { key: "mk1", ref: "Rom 8:38", color: "blue", ts: 0 };
    expect(previewMark(m, 0)).toBe("1. [mk1] Rom 8:38 · blue");
  });

  it("truncates note at 90 chars", () => {
    const m: Mark = { ...sampleMark, note: "x".repeat(100) };
    const result = previewMark(m, 0);
    expect(result).toContain("x".repeat(90));
    expect(result).not.toContain("x".repeat(91));
  });

  it("truncates text at 110 chars", () => {
    const m: Mark = { ...sampleMark, text: "y".repeat(120) };
    const result = previewMark(m, 0);
    expect(result).toContain("y".repeat(110));
    expect(result).not.toContain("y".repeat(111));
  });
});

// ── rank ──────────────────────────────────────────────────────────────────────

describe("rank", () => {
  function mockFetch(responseBody: unknown, ok = true, status = 200): void {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        status,
        json: (): Promise<unknown> => Promise.resolve(responseBody),
      }),
    );
  }

  it("returns [] for empty query", async () => {
    expect(await rank("", [sampleMark])).toEqual([]);
    expect(await rank("   ", [sampleMark])).toEqual([]);
  });

  it("returns [] for empty marks array", async () => {
    expect(await rank("love", [])).toEqual([]);
  });

  it("calls /api/chat and returns parsed results", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love theme" }];
    mockFetch({ text: JSON.stringify(apiResults) });

    const results = await rank("love", [sampleMark]);
    expect(results).toEqual([{ key: "mark-1", reason: "love theme" }]);
  });

  it("strips results with keys not present in marks", async () => {
    const apiResults = [
      { key: "mark-1", reason: "valid" },
      { key: "unknown-key", reason: "invalid" },
    ];
    mockFetch({ text: JSON.stringify(apiResults) });

    const results = await rank("love", [sampleMark]);
    expect(results).toEqual([{ key: "mark-1", reason: "valid" }]);
  });

  it("caps results at 12", async () => {
    const marks: Mark[] = Array.from({ length: 20 }, (_, i) => ({
      ...sampleMark,
      key: `mark-${i}`,
    }));
    const apiResults = marks.map((m, i) => ({ key: m.key, reason: `reason ${i}` }));
    mockFetch({ text: JSON.stringify(apiResults) });

    const results = await rank("love", marks);
    expect(results.length).toBe(12);
  });

  it("truncates reason to 140 chars", async () => {
    const apiResults = [{ key: "mark-1", reason: "x".repeat(200) }];
    mockFetch({ text: JSON.stringify(apiResults) });

    const results = await rank("love", [sampleMark]);
    expect(results[0]?.reason.length).toBe(140);
  });

  it("tolerates code fences around JSON (leading prose)", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love" }];
    const fenced = "Here are the results:\n```json\n" + JSON.stringify(apiResults) + "\n```";
    mockFetch({ text: fenced });

    const results = await rank("love", [sampleMark]);
    expect(results).toEqual(apiResults);
  });

  it("returns [] when response text has no JSON array", async () => {
    mockFetch({ text: "I cannot find any relevant marks." });
    expect(await rank("love", [sampleMark])).toEqual([]);
  });

  it("returns [] when parsed JSON is not an array", async () => {
    mockFetch({ text: '{"key":"mark-1"}' });
    expect(await rank("love", [sampleMark])).toEqual([]);
  });

  it("returns [] and warns when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await rank("love", [sampleMark]);
    expect(results).toEqual([]);
    expect(warn).toHaveBeenCalledWith("MarkSearch.rank failed:", expect.any(Error));
  });

  it("returns [] and warns when HTTP response is not ok", async () => {
    mockFetch({ error: "Server error" }, false, 500);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await rank("love", [sampleMark]);
    expect(results).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("serves cached results and does not call fetch again", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love theme" }];
    mockFetch({ text: JSON.stringify(apiResults) });

    await rank("love", [sampleMark]); // populates cache
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchMock.mock.calls.length;

    await rank("love", [sampleMark]); // should hit cache
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("refreshes cache ts on cache hit", async () => {
    // Pre-seed cache with an old ts.
    const oldTs = 1;
    const sig = sigFor("love", [sampleMark]);
    const seed: CacheStore = { [sig]: { ts: oldTs, results: [{ key: "mark-1", reason: "seed" }] } };
    writeCache(seed);

    vi.stubGlobal("fetch", vi.fn()); // should never be called
    const before = Date.now();
    const results = await rank("love", [sampleMark]);
    const after = Date.now();

    expect(results).toEqual([{ key: "mark-1", reason: "seed" }]);
    const stored = readCache();
    const ts = stored[sig]?.ts ?? 0;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("caches results after a successful fetch", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love theme" }];
    mockFetch({ text: JSON.stringify(apiResults) });

    await rank("love", [sampleMark]);

    const stored = readCache();
    const sig = sigFor("love", [sampleMark]);
    expect(stored[sig]?.results).toEqual(apiResults);
  });

  it("does not cache on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await rank("love", [sampleMark]);

    const sig = sigFor("love", [sampleMark]);
    expect(readCache()[sig]).toBeUndefined();
  });

  it("passes context to /api/chat user message", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love" }];
    mockFetch({ text: JSON.stringify(apiResults) });

    await rank("love", [sampleMark], "Genesis 1");

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const callArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse((callArg?.body as string | undefined) ?? "{}") as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.messages?.[0]?.content).toContain("Current passage: Genesis 1");
  });

  it("sends 'Current passage: (none)' when context is absent", async () => {
    const apiResults: RankResult[] = [{ key: "mark-1", reason: "love" }];
    mockFetch({ text: JSON.stringify(apiResults) });

    await rank("love", [sampleMark]);

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const callArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse((callArg?.body as string | undefined) ?? "{}") as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.messages?.[0]?.content).toContain("Current passage: (none)");
  });
});

// ── window assignment (index.ts contract) ─────────────────────────────────────

describe("index.ts — window.MarkSearch assignment", () => {
  it("sets window.MarkSearch with rank and clearCache", async () => {
    // Import after tests so the module executes in jsdom.
    const { msw } = await import("./mark-search-window.js");
    // Clear any previous assignment so we test the import itself.
    msw().MarkSearch = undefined;
    await import("./index.js");
    const api = msw().MarkSearch;
    expect(typeof api?.rank).toBe("function");
    expect(typeof api?.clearCache).toBe("function");
  });
});
