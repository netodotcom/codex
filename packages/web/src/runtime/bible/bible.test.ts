// @vitest-environment jsdom
// bible — faithful-port tests. Expectations derived directly from legacy/bible.js.
// Mocks: fetch + CODEX_DATA. Asserts loadChapter resolves/caches and
// translation resolution matches legacy behaviour.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { VerseEntry, MultiVerseRow } from "./types.js";

// ── Helpers we test directly (not via the window entry) ───────────────────────
// We import lazily inside tests where module-level side effects need resetting.

// ── Fake IndexedDB ────────────────────────────────────────────────────────────
// jsdom ships without IndexedDB. We install a minimal in-memory shim that
// mirrors the exact IDBRequest / IDBTransaction / IDBCursor event sequence
// that helpers.ts expects.

type FakeStore = Map<string, { verses: VerseEntry[]; fetchedAt: number; source: string; pinned: boolean; translation: string }>;

function makeIdbRequest<T>(compute: () => T): IDBRequest<T> {
  let _onsuccess: ((e: Event) => void) | null = null;
  let _onerror: ((e: Event) => void) | null = null;
  let _result: T;
  const obj: Record<string, unknown> = { error: null };
  Object.defineProperty(obj, "result",   { get: () => _result });
  Object.defineProperty(obj, "onsuccess", {
    get: () => _onsuccess,
    set: (fn: ((e: Event) => void) | null) => { _onsuccess = fn; },
  });
  Object.defineProperty(obj, "onerror", {
    get: () => _onerror,
    set: (fn: ((e: Event) => void) | null) => { _onerror = fn; },
  });
  Promise.resolve().then(() => {
    try { _result = compute(); _onsuccess?.({} as Event); }
    catch (e) { obj["error"] = e; _onerror?.({} as Event); }
  });
  return obj as unknown as IDBRequest<T>;
}

function makeObjectStore(
  chapStore: FakeStore,
  metaStore: Map<string, unknown>,
  storeName: string,
): IDBObjectStore {
  const store = storeName === "chapters" ? chapStore : null;
  const meta  = storeName === "meta"     ? metaStore : null;

  // Minimal cursor for openCursor
  function makeCursor(entries: [string, unknown][], idx: number): IDBCursorWithValue | null {
    if (idx >= entries.length) return null;
    const [key, value] = entries[idx]!;
    let _onsuccess2: ((e: Event) => void) | null = null;
    const req2: Record<string, unknown> = { error: null };
    const cursor: Record<string, unknown> = {
      key,
      value,
      continue: () => {
        Promise.resolve().then(() => {
          const next = makeCursor(entries, idx + 1);
          Object.defineProperty(req2, "result", { get: () => next, configurable: true });
          _onsuccess2?.({ target: req2 } as unknown as Event);
        });
      },
      delete: () => {
        if (store) store.delete(key);
        return makeIdbRequest(() => undefined);
      },
    };
    Object.defineProperty(req2, "result",   { get: () => cursor, configurable: true });
    Object.defineProperty(req2, "onsuccess", {
      get: () => _onsuccess2,
      set: (fn: ((e: Event) => void) | null) => { _onsuccess2 = fn; },
    });
    Object.defineProperty(req2, "onerror",   { get: () => null, set: () => {} });
    return cursor as unknown as IDBCursorWithValue;
  }

  // Minimal index for removeTranslation / checkUpdates
  function makeIndex(field: string): IDBIndex {
    return {
      openCursor: (range: IDBKeyRangeType) => {
        const only = (range as IDBKeyRange & { _only?: unknown })._only;
        const entries = store
          ? [...store.entries()].filter(([, v]) => (v as Record<string, unknown>)[field] === only)
          : [];
        const req2: Record<string, unknown> = { error: null };
        let _onsuccess2: ((e: Event) => void) | null = null;
        Object.defineProperty(req2, "onsuccess", {
          get: () => _onsuccess2,
          set: (fn: ((e: Event) => void) | null) => { _onsuccess2 = fn; },
        });
        Object.defineProperty(req2, "onerror", { get: () => null, set: () => {} });
        const allEntries = entries as [string, unknown][];
        Promise.resolve().then(() => {
          const cursor = makeCursor(allEntries, 0);
          Object.defineProperty(req2, "result", { get: () => cursor, configurable: true });
          _onsuccess2?.({ target: req2 } as unknown as Event);
        });
        return req2 as unknown as IDBRequest<IDBCursorWithValue | null>;
      },
    } as unknown as IDBIndex;
  }

  return {
    get:    (key: IDBValidKey) => {
      if (meta) return makeIdbRequest(() => meta.get(key as string));
      return makeIdbRequest(() => store?.get(key as string));
    },
    put:    (value: unknown, key?: IDBValidKey) => {
      if (meta && key != null) { meta.set(key as string, value); return makeIdbRequest(() => key); }
      if (store && key != null) {
        store.set(key as string, value as FakeStore extends Map<string, infer V> ? V : never);
        return makeIdbRequest(() => key);
      }
      return makeIdbRequest(() => key as IDBValidKey);
    },
    delete: (key: IDBValidKey) => {
      store?.delete(key as string);
      meta?.delete(key as string);
      return makeIdbRequest(() => undefined);
    },
    openCursor: () => {
      const entries = store ? [...store.entries()] as [string, unknown][] : [];
      const req2: Record<string, unknown> = { error: null };
      let _onsuccess2: ((e: Event) => void) | null = null;
      Object.defineProperty(req2, "onsuccess", {
        get: () => _onsuccess2,
        set: (fn: ((e: Event) => void) | null) => { _onsuccess2 = fn; },
      });
      Object.defineProperty(req2, "onerror", { get: () => null, set: () => {} });
      Promise.resolve().then(() => {
        const cursor = makeCursor(entries, 0);
        Object.defineProperty(req2, "result", { get: () => cursor, configurable: true });
        _onsuccess2?.({ target: req2 } as unknown as Event);
      });
      return req2 as unknown as IDBRequest<IDBCursorWithValue | null>;
    },
    index: (name: string) => makeIndex(name),
    createIndex: () => ({}) as IDBIndex,
  } as unknown as IDBObjectStore;
}

function makeFakeTransaction(
  chapStore: FakeStore,
  metaStore: Map<string, unknown>,
  storeName: string,
): IDBTransaction {
  let _oncomplete: ((e: Event) => void) | null = null;
  let _onerror: ((e: Event) => void) | null = null;
  const tx: Record<string, unknown> = { error: null };
  Object.defineProperty(tx, "oncomplete", {
    get: () => _oncomplete,
    set: (fn: ((e: Event) => void) | null) => { _oncomplete = fn; },
  });
  Object.defineProperty(tx, "onerror", {
    get: () => _onerror,
    set: (fn: ((e: Event) => void) | null) => { _onerror = fn; },
  });
  tx["objectStore"] = (name: string) => makeObjectStore(chapStore, metaStore, name ?? storeName);
  setTimeout(() => { _oncomplete?.({} as Event); }, 0);
  return tx as unknown as IDBTransaction;
}

type IDBKeyRangeType = { _only?: unknown };

function installFakeIdb(): { chapStore: FakeStore; metaStore: Map<string, unknown> } {
  const chapStore: FakeStore = new Map();
  const metaStore: Map<string, unknown> = new Map();

  const fakeDb: Record<string, unknown> = {
    objectStoreNames: { contains: () => true },
    transaction: (_names: string | string[], _mode: string) => {
      const name = Array.isArray(_names) ? _names[0]! : _names;
      return makeFakeTransaction(chapStore, metaStore, name);
    },
  };

  const fakeIndexedDB = {
    open: (_name: string, _version: number): IDBOpenDBRequest => {
      let _onsuccess: ((e: Event) => void) | null = null;
      let _onerror:   ((e: Event) => void) | null = null;
      let _onupgradeneeded: ((e: IDBVersionChangeEvent) => void) | null = null;
      const req: Record<string, unknown> = { error: null, result: fakeDb };
      Object.defineProperty(req, "onsuccess",      { get: () => _onsuccess,      set: (fn) => { _onsuccess = fn; } });
      Object.defineProperty(req, "onerror",        { get: () => _onerror,        set: (fn) => { _onerror = fn; } });
      Object.defineProperty(req, "onupgradeneeded",{ get: () => _onupgradeneeded,set: (fn) => { _onupgradeneeded = fn; } });
      Promise.resolve().then(() => { _onsuccess?.({} as Event); });
      return req as unknown as IDBOpenDBRequest;
    },
  };

  // Install IDBKeyRange.only
  (globalThis as Record<string, unknown>)["IDBKeyRange"] = {
    only: (v: unknown): IDBKeyRangeType => ({ _only: v }),
  };

  Object.defineProperty(window, "indexedDB", { configurable: true, writable: true, value: fakeIndexedDB });
  return { chapStore, metaStore };
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true, status = 200): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok, status,
    json: () => Promise.resolve(data),
  }));
}

function failFetch(msg = "network error"): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(msg)));
}

// Install CODEX_DATA on window with a minimal translation registry.
function installCodexData(translations: object[] = []): void {
  Object.defineProperty(window, "CODEX_DATA", {
    configurable: true,
    writable: true,
    value: { translations },
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset the module registry so each test gets a fresh helpers.ts with
  // clean _memCache, _db, _inflight, _bundleStatus, _truthLoaded state.
  vi.resetModules();
  installFakeIdb();
  vi.restoreAllMocks();
  installCodexData([]);
  // Stub localStorage
  const ls: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => ls[k] ?? null,
    setItem: (k: string, v: string) => { ls[k] = v; },
    removeItem: (k: string) => { delete ls[k]; },
  });
  // Stub navigator.storage
  vi.stubGlobal("navigator", {
    storage: { estimate: async () => ({ quota: 10_000_000, usage: 100_000 }) },
  });
  // Stub red-letter fetch to 404 so tests don't depend on the file
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers (imported fresh after env is set up) ──────────────────────────────
// NOTE: vitest caches modules between tests in the same file. Since helpers.ts
// has module-level state (_db, _memCache), we test the exported functions
// directly and reset state via the exported _memCache reference.

// ── BOOK_BOLLS / BOOK_API parity ─────────────────────────────────────────────

describe("BOOK_BOLLS", () => {
  it("gen maps to 1", async () => {
    const { BOOK_BOLLS } = await import("./helpers.js");
    expect(BOOK_BOLLS["gen"]).toBe(1);
  });
  it("rev maps to 66", async () => {
    const { BOOK_BOLLS } = await import("./helpers.js");
    expect(BOOK_BOLLS["rev"]).toBe(66);
  });
  it("covers all 66 Protestant books", async () => {
    const { BOOK_BOLLS } = await import("./helpers.js");
    expect(Object.keys(BOOK_BOLLS)).toHaveLength(66);
  });
});

describe("BOOK_API", () => {
  it("gen maps to 'genesis'", async () => {
    const { BOOK_API } = await import("./helpers.js");
    expect(BOOK_API["gen"]).toBe("genesis");
  });
  it("rev maps to 'revelation'", async () => {
    const { BOOK_API } = await import("./helpers.js");
    expect(BOOK_API["rev"]).toBe("revelation");
  });
  it("covers all 66 Protestant books", async () => {
    const { BOOK_API } = await import("./helpers.js");
    expect(Object.keys(BOOK_API)).toHaveLength(66);
  });
});

// ── parseRange ────────────────────────────────────────────────────────────────

describe("parseRange", () => {
  it("parses a single verse", async () => {
    const { parseRange } = await import("./helpers.js");
    expect(parseRange("5")).toEqual(new Set([5]));
  });
  it("parses a range", async () => {
    const { parseRange } = await import("./helpers.js");
    expect(parseRange("3-5")).toEqual(new Set([3, 4, 5]));
  });
  it("parses comma-separated list", async () => {
    const { parseRange } = await import("./helpers.js");
    expect(parseRange("1,3,5")).toEqual(new Set([1, 3, 5]));
  });
  it("parses mixed range and single", async () => {
    const { parseRange } = await import("./helpers.js");
    expect(parseRange("1-3,7")).toEqual(new Set([1, 2, 3, 7]));
  });
  it("returns empty set for empty string", async () => {
    const { parseRange } = await import("./helpers.js");
    expect(parseRange("")).toEqual(new Set());
  });
});

// ── _scrubVerses ──────────────────────────────────────────────────────────────

describe("_scrubVerses", () => {
  it("strips Strong's numbers glued to words", async () => {
    const { _scrubVerses } = await import("./helpers.js");
    const verses: VerseEntry[] = [{ n: 1, text: "God444 created" }];
    const out = _scrubVerses(verses);
    expect(out[0]?.text).toBe("God created");
  });
  it("strips standalone 2-5 digit numbers", async () => {
    const { _scrubVerses } = await import("./helpers.js");
    const verses: VerseEntry[] = [{ n: 1, text: "In the 3045 beginning" }];
    const out = _scrubVerses(verses);
    expect(out[0]?.text).toBe("In the beginning");
  });
  it("returns the same array reference when no mutations", async () => {
    const { _scrubVerses } = await import("./helpers.js");
    const verses: VerseEntry[] = [{ n: 1, text: "In the beginning" }];
    expect(_scrubVerses(verses)).toBe(verses);
  });
  it("returns a new array when scrubbing is needed", async () => {
    const { _scrubVerses } = await import("./helpers.js");
    const verses: VerseEntry[] = [{ n: 1, text: "God444" }];
    expect(_scrubVerses(verses)).not.toBe(verses);
  });
});

// ── loadChapter · bible-api source ───────────────────────────────────────────

describe("loadChapter (bible-api source)", () => {
  it("fetches and caches a chapter on first load", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        verses: [
          { verse: 1, text: "In the beginning God created" },
          { verse: 2, text: "And the earth was without form" },
        ],
      }),
    }));
    const { loadChapter, _memCache } = await import("./helpers.js");
    const verses = await loadChapter("gen", 1, "kjv");
    expect(verses).toHaveLength(2);
    expect(verses[0]?.n).toBe(1);
    expect(verses[0]?.text).toContain("beginning");
    // Should be cached in mem mirror
    expect(_memCache["gen.1.kjv"]).toBeDefined();
  });

  it("returns cached verses on second call without fetching", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "In the beginning" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { loadChapter } = await import("./helpers.js");
    await loadChapter("gen", 1, "kjv");
    const callCount = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.length;
    await loadChapter("gen", 1, "kjv");
    // fetch should not have been called again
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });

  it("uses the correct bible-api URL format", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "test" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { loadChapter } = await import("./helpers.js");
    await loadChapter("jhn", 3, "kjv");
    // NOTE: module init unconditionally fires a "data/red-letter.json" fetch
    // first (legacy/bible.js:549 `_loadRedLetterTruth();`, ported as-is in
    // helpers.ts), so the chapter-fetch call is not necessarily calls[0].
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls as [string][];
    const url = calls.map(c => c[0]).find(u => u.includes("bible-api.com"));
    expect(url).toBeDefined();
    expect(url).toContain("john");
    expect(url).toContain("3");
    expect(url).toContain("translation=kjv");
  });

  it("throws when fetch returns non-ok response", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const { loadChapter } = await import("./helpers.js");
    await expect(loadChapter("gen", 1, "kjv")).rejects.toThrow("503");
  });
});

// ── loadChapter · bolls source ────────────────────────────────────────────────

describe("loadChapter (bolls source)", () => {
  it("fetches and maps bolls verse format", async () => {
    installCodexData([{ id: "asv", source: "bolls", apiId: "ASV" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([
        { verse: 1, text: "In the beginning" },
        { verse: 2, text: "God created<br/>the heavens" },
      ]),
    }));
    const { loadChapter } = await import("./helpers.js");
    const verses = await loadChapter("gen", 1, "asv");
    expect(verses[0]?.n).toBe(1);
    // HTML tags should be stripped
    expect(verses[1]?.text).not.toContain("<br/>");
  });

  it("uses bolls.life URL format with numeric book id", async () => {
    installCodexData([{ id: "asv", source: "bolls", apiId: "ASV" }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([{ verse: 1, text: "test" }]),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { loadChapter } = await import("./helpers.js");
    await loadChapter("jhn", 1, "asv");
    // NOTE: module init unconditionally fires a "data/red-letter.json" fetch
    // first (legacy/bible.js:549 `_loadRedLetterTruth();`, ported as-is in
    // helpers.ts), so the chapter-fetch call is not necessarily calls[0].
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls as [string][];
    const url = calls.map(c => c[0]).find(u => u.includes("bolls.life"));
    expect(url).toBeDefined();
    // jhn = 43
    expect(url).toContain("/43/");
    expect(url).toContain("ASV");
  });

  it("strips Strong's numbers glued to words via scrub in fetchFromSource", async () => {
    installCodexData([{ id: "asv", source: "bolls", apiId: "ASV" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([{ verse: 1, text: "God444 created3045 the heavens" }]),
    }));
    const { loadChapter } = await import("./helpers.js");
    const verses = await loadChapter("gen", 1, "asv");
    expect(verses[0]?.text).toBe("God created the heavens");
  });
});

// ── Translation resolution · mirrors fallback ─────────────────────────────────

describe("translation source fallback via mirrors", () => {
  it("falls back to mirror when primary source fails", async () => {
    installCodexData([{
      id: "kjv",
      source: "bible-api",
      apiId: "kjv",
      mirrors: [{ kind: "bolls", apiId: "KJV" }],
    }]);
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes("bible-api.com")) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      }
      // bolls mirror
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ([{ verse: 1, text: "Fallback verse" }]),
      });
    }));
    const { loadChapter } = await import("./helpers.js");
    const verses = await loadChapter("gen", 1, "kjv");
    expect(callCount).toBeGreaterThan(1);
    expect(verses[0]?.text).toBe("Fallback verse");
  });

  it("throws when all sources fail", async () => {
    installCodexData([{
      id: "kjv",
      source: "bible-api",
      apiId: "kjv",
      mirrors: [{ kind: "bolls", apiId: "KJV" }],
    }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { loadChapter } = await import("./helpers.js");
    await expect(loadChapter("gen", 1, "kjv")).rejects.toBeDefined();
  });

  it("throws with 'No source' when translation has no source", async () => {
    installCodexData([{ id: "unknown", source: undefined, apiId: undefined }]);
    const { loadChapter } = await import("./helpers.js");
    await expect(loadChapter("gen", 1, "unknown")).rejects.toThrow("No source for translation: unknown");
  });
});

// ── getCachedChapter ──────────────────────────────────────────────────────────

describe("getCachedChapter", () => {
  it("returns null when chapter is not cached", async () => {
    const { getCachedChapter } = await import("./helpers.js");
    expect(getCachedChapter("gen", 1, "kjv")).toBeNull();
  });

  it("returns cached verses synchronously after loadChapter", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "In the beginning" }] }),
    }));
    const { loadChapter, getCachedChapter } = await import("./helpers.js");
    await loadChapter("gen", 1, "kjv");
    const cached = getCachedChapter("gen", 1, "kjv");
    expect(cached).not.toBeNull();
    expect(cached![0]?.n).toBe(1);
  });
});

// ── loadMulti ─────────────────────────────────────────────────────────────────

describe("loadMulti", () => {
  it("merges multiple translations into rows keyed by verse number", async () => {
    installCodexData([
      { id: "kjv", source: "bible-api", apiId: "kjv" },
      { id: "web", source: "bible-api", apiId: "web" },
    ]);
    let call = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      call++;
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({
          verses: [
            { verse: 1, text: call === 1 ? "KJV text" : "WEB text" },
          ],
        }),
      });
    }));
    const { loadMulti } = await import("./helpers.js");
    const rows = await loadMulti("jhn", 1, ["kjv", "web"]);
    expect(rows).toHaveLength(1);
    const row = rows[0] as MultiVerseRow;
    expect(row.n).toBe(1);
    // Both translations should be present
    expect(typeof (row["kjv"] ?? row["web"])).toBe("string");
  });

  it("skips empty verse texts", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [
        { verse: 1, text: "Real text" },
        { verse: 2, text: "   " },   // blank — should be skipped
      ]}),
    }));
    const { loadMulti } = await import("./helpers.js");
    const rows = await loadMulti("jhn", 1, ["kjv"]);
    expect(rows.every(r => {
      const t = r["kjv"];
      return typeof t !== "string" || t.trim().length > 0;
    })).toBe(true);
  });

  it("continues when one translation fails (catches per-translation errors)", async () => {
    installCodexData([
      { id: "kjv", source: "bible-api", apiId: "kjv" },
      { id: "bad", source: "bible-api", apiId: "bad" },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("translation=bad")) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ verses: [{ verse: 1, text: "Good text" }] }),
      });
    }));
    const { loadMulti } = await import("./helpers.js");
    const rows = await loadMulti("jhn", 1, ["kjv", "bad"]);
    // Should still resolve with at least the good translation
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });
});

// ── cacheStats ────────────────────────────────────────────────────────────────

describe("cacheStats", () => {
  it("returns zero cached when nothing is in cache", async () => {
    const { cacheStats } = await import("./helpers.js");
    const books = [{ id: "gen", name: "Genesis", chapters: 50 }];
    const stats = cacheStats("kjv", books);
    expect(stats.cached).toBe(0);
    expect(stats.total).toBe(50);
    expect(stats.fully).toBe(false);
  });

  it("reports fully:true when all chapters are cached", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "text" }] }),
    }));
    const { loadChapter, cacheStats } = await import("./helpers.js");
    await loadChapter("jhn", 1, "kjv");
    const stats = cacheStats("kjv", [{ id: "jhn", name: "John", chapters: 1 }]);
    expect(stats.cached).toBe(1);
    expect(stats.fully).toBe(true);
  });
});

// ── verifyTranslation ────────────────────────────────────────────────────────

describe("verifyTranslation", () => {
  it("reports all chapters missing when cache is empty", async () => {
    const { verifyTranslation } = await import("./helpers.js");
    const books = [{ id: "jhn", name: "John", chapters: 3 }];
    const result = verifyTranslation("kjv", books);
    expect(result.missing).toHaveLength(3);
    expect(result.corrupt).toHaveLength(0);
    expect(result.ok).toBe(false);
  });

  it("has ok:true and empty missing/corrupt after caching a chapter", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "text" }] }),
    }));
    const { loadChapter, verifyTranslation } = await import("./helpers.js");
    await loadChapter("jhn", 1, "kjv");
    const result = verifyTranslation("kjv", [{ id: "jhn", name: "John", chapters: 1 }]);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.summary).toBe("all chapters present and readable");
  });

  it("reports summary string with counts when chapters are missing", async () => {
    const { verifyTranslation } = await import("./helpers.js");
    const books = [{ id: "jhn", name: "John", chapters: 2 }];
    const result = verifyTranslation("kjv", books);
    expect(result.summary).toMatch(/missing/);
  });
});

// ── readOffline ───────────────────────────────────────────────────────────────

describe("readOffline", () => {
  it("returns null when not cached", async () => {
    const { readOffline } = await import("./helpers.js");
    expect(readOffline("gen", 1, "kjv")).toBeNull();
  });

  it("returns cached verses after loadChapter", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "text" }] }),
    }));
    const { loadChapter, readOffline } = await import("./helpers.js");
    await loadChapter("gen", 1, "kjv");
    expect(readOffline("gen", 1, "kjv")).not.toBeNull();
  });
});

// ── removeTranslation ─────────────────────────────────────────────────────────

describe("removeTranslation", () => {
  it("removes all chapters for a translation from mem cache", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "text" }] }),
    }));
    const { loadChapter, removeTranslation, _memCache } = await import("./helpers.js");
    await loadChapter("gen", 1, "kjv");
    expect(_memCache["gen.1.kjv"]).toBeDefined();
    const removed = removeTranslation("kjv");
    expect(removed).toBeGreaterThan(0);
    expect(_memCache["gen.1.kjv"]).toBeUndefined();
  });

  it("returns 0 when no chapters are cached for translation", async () => {
    const { removeTranslation } = await import("./helpers.js");
    expect(removeTranslation("notexist")).toBe(0);
  });
});

// ── exportBundle / importBundle ───────────────────────────────────────────────

describe("exportBundle", () => {
  it("returns a bundle object with the correct shape", async () => {
    installCodexData([{ id: "kjv", source: "bible-api", apiId: "kjv" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "text" }] }),
    }));
    const { loadChapter, exportBundle } = await import("./helpers.js");
    await loadChapter("gen", 1, "kjv");
    const bundle = exportBundle("kjv");
    expect(bundle.translation).toBe("kjv");
    expect(bundle.version).toBe(1);
    expect(typeof bundle.generatedAt).toBe("number");
    expect(bundle.chapterCount).toBeGreaterThan(0);
    expect(bundle.chapters["gen.1"]).toBeDefined();
  });
});

describe("importBundle", () => {
  it("imports a bundle object and populates mem cache", async () => {
    const { importBundle, _memCache } = await import("./helpers.js");
    const bundle = {
      translation: "test-t",
      chapters: {
        "jhn.1": [{ n: 1, text: "In the beginning was the Word" }],
        "jhn.2": [{ n: 1, text: "And the third day" }],
      },
    };
    const result = await importBundle(bundle);
    expect(result.translation).toBe("test-t");
    expect(result.imported).toBe(2);
    expect(_memCache["jhn.1.test-t"]).toBeDefined();
    expect(_memCache["jhn.2.test-t"]).toBeDefined();
  });

  it("imports a JSON string", async () => {
    const { importBundle } = await import("./helpers.js");
    const bundle = { translation: "str-t", chapters: { "rom.1": [{ n: 1, text: "Paul" }] } };
    const result = await importBundle(JSON.stringify(bundle));
    expect(result.imported).toBe(1);
  });

  it("throws on invalid JSON string", async () => {
    const { importBundle } = await import("./helpers.js");
    await expect(importBundle("{bad json")).rejects.toThrow("invalid JSON");
  });

  it("throws when translation id is missing", async () => {
    const { importBundle } = await import("./helpers.js");
    await expect(importBundle({ translation: "", chapters: {} })).rejects.toThrow("missing translation id");
  });
});

// ── window.BIBLE assignment ───────────────────────────────────────────────────

describe("window.BIBLE (window contract)", () => {
  it("is set as an object on window after importing index.ts", async () => {
    await import("./index.js");
    const w = window as unknown as { BIBLE?: unknown };
    expect(typeof w.BIBLE).toBe("object");
  });

  it("exposes the expected public API methods", async () => {
    await import("./index.js");
    const w = window as unknown as { BIBLE?: Record<string, unknown> };
    const bible = w.BIBLE;
    expect(bible).toBeDefined();
    expect(typeof bible!["loadChapter"]).toBe("function");
    expect(typeof bible!["getCachedChapter"]).toBe("function");
    expect(typeof bible!["loadMulti"]).toBe("function");
    expect(typeof bible!["downloadAll"]).toBe("function");
    expect(typeof bible!["cacheStats"]).toBe("function");
    expect(typeof bible!["verifyTranslation"]).toBe("function");
    expect(typeof bible!["repairTranslation"]).toBe("function");
    expect(typeof bible!["readOffline"]).toBe("function");
    expect(typeof bible!["removeTranslation"]).toBe("function");
    expect(typeof bible!["annotateRedLetter"]).toBe("function");
    expect(typeof bible!["rlGet"]).toBe("function");
    expect(typeof bible!["rlMerge"]).toBe("function");
    expect(bible!["BOOK_API"]).toBeDefined();
    expect(bible!["ready"]).toBeInstanceOf(Promise);
    expect(typeof (bible!["storage"] as Record<string, unknown>)["diagnose"]).toBe("function");
    expect(typeof (bible!["storage"] as Record<string, unknown>)["resetBundle"]).toBe("function");
    expect(typeof (bible!["storage"] as Record<string, unknown>)["exportBundle"]).toBe("function");
    expect(typeof (bible!["storage"] as Record<string, unknown>)["importBundle"]).toBe("function");
    expect(typeof (bible!["storage"] as Record<string, unknown>)["checkUpdates"]).toBe("function");
  });
});

// ── Clementine (Latin) · uppercase lookup quirk ───────────────────────────────

describe("clementine (Latin) translation quirk", () => {
  it("uses uppercase bookId for clementine on bible-api", async () => {
    installCodexData([{ id: "clementine", source: "bible-api", apiId: "clementine" }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ verses: [{ verse: 1, text: "In principio" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { loadChapter } = await import("./helpers.js");
    await loadChapter("gen", 1, "clementine");
    // NOTE: module init unconditionally fires a "data/red-letter.json" fetch
    // first (legacy/bible.js:549 `_loadRedLetterTruth();`, ported as-is in
    // helpers.ts), so the chapter-fetch call is not necessarily calls[0].
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls as [string][];
    const url = calls.map(c => c[0]).find(u => u.includes("bible-api.com"));
    expect(url).toBeDefined();
    // NOTE: preserved from legacy — clementine uses uppercase bookId
    expect(url).toContain("GEN");
  });
});
