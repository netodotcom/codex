// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validate,
  loadModule,
  loadModuleFromUrl,
  listModules,
  removeModule,
  hasModule,
  VALID_TYPES,
} from "./helpers.js";
import type { Module } from "./types.js";

// ── Minimal IndexedDB mock ─────────────────────────────────────────────────
// jsdom ships without IndexedDB. We install a tiny in-memory shim that mirrors
// the exact IDBRequest / IDBTransaction event sequence that helpers.ts expects.

function makeRequest<T>(compute: () => T): IDBRequest<T> {
  let _onsuccess: ((e: Event) => void) | null = null;
  let _onerror: ((e: Event) => void) | null = null;
  let _result: T;
  const obj: Record<string, unknown> = { error: null };

  Object.defineProperty(obj, "result", { get: () => _result });
  Object.defineProperty(obj, "onsuccess", {
    get: () => _onsuccess,
    set: (fn: ((e: Event) => void) | null) => { _onsuccess = fn; },
  });
  Object.defineProperty(obj, "onerror", {
    get: () => _onerror,
    set: (fn: ((e: Event) => void) | null) => { _onerror = fn; },
  });

  // Fire async (after onsuccess/onerror are set by idbReq)
  Promise.resolve().then(() => {
    try {
      _result = compute();
      _onsuccess?.({} as Event);
    } catch (e) {
      obj["error"] = e;
      _onerror?.({} as Event);
    }
  });

  return obj as unknown as IDBRequest<T>;
}

function makeObjectStore(store: Map<string, Module>): IDBObjectStore {
  return {
    get: (key: IDBValidKey) =>
      makeRequest<Module | undefined>(() => store.get(key as string)),
    put: (val: unknown) =>
      makeRequest<IDBValidKey>(() => {
        const mod = val as Module;
        store.set(mod.meta.id, mod);
        return mod.meta.id;
      }),
    delete: (key: IDBValidKey) =>
      makeRequest<undefined>(() => {
        store.delete(key as string);
        return undefined;
      }),
    getAll: () => makeRequest<Module[]>(() => [...store.values()]),
  } as unknown as IDBObjectStore;
}

function makeTx(storeMap: Map<string, Module>): IDBTransaction {
  let _oncomplete: ((e: Event) => void) | null = null;
  let _onerror: ((e: Event) => void) | null = null;
  let _onabort: ((e: Event) => void) | null = null;

  const objStore = makeObjectStore(storeMap);
  const tx: Record<string, unknown> = { error: null };

  Object.defineProperty(tx, "oncomplete", {
    get: () => _oncomplete,
    set: (fn: ((e: Event) => void) | null) => { _oncomplete = fn; },
  });
  Object.defineProperty(tx, "onerror", {
    get: () => _onerror,
    set: (fn: ((e: Event) => void) | null) => { _onerror = fn; },
  });
  Object.defineProperty(tx, "onabort", {
    get: () => _onabort,
    set: (fn: ((e: Event) => void) | null) => { _onabort = fn; },
  });
  tx["objectStore"] = () => objStore;

  // setTimeout fires after all pending microtasks (onsuccess + idbTx result capture),
  // so oncomplete is guaranteed to see the captured result.
  setTimeout(() => { _oncomplete?.({} as Event); }, 0);

  return tx as unknown as IDBTransaction;
}

function installFakeIdb(): Map<string, Module> {
  const modulesStore = new Map<string, Module>();

  const fakeDb: Record<string, unknown> = {
    objectStoreNames: { contains: () => true },
    transaction: (_name: string, _mode: string) => makeTx(modulesStore),
  };

  const fakeIndexedDb = {
    open: (_name: string, _version: number): IDBOpenDBRequest => {
      let _onsuccess: ((e: Event) => void) | null = null;
      let _onerror: ((e: Event) => void) | null = null;
      let _onupgradeneeded: ((e: IDBVersionChangeEvent) => void) | null = null;

      const req: Record<string, unknown> = {
        error: null,
        result: fakeDb as unknown as IDBDatabase,
      };
      Object.defineProperty(req, "onsuccess", {
        get: () => _onsuccess,
        set: (fn: ((e: Event) => void) | null) => { _onsuccess = fn; },
      });
      Object.defineProperty(req, "onerror", {
        get: () => _onerror,
        set: (fn: ((e: Event) => void) | null) => { _onerror = fn; },
      });
      Object.defineProperty(req, "onupgradeneeded", {
        get: () => _onupgradeneeded,
        set: (fn: ((e: IDBVersionChangeEvent) => void) | null) => { _onupgradeneeded = fn; },
      });

      Promise.resolve().then(() => { _onsuccess?.({} as Event); });

      return req as unknown as IDBOpenDBRequest;
    },
  };

  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    writable: true,
    value: fakeIndexedDb,
  });

  return modulesStore;
}

// ── Test fixtures ──────────────────────────────────────────────────────────

function makeModule(overrides: Partial<Module["meta"]> = {}): Module {
  return {
    meta: {
      id: "test-lexicon",
      version: "1.0.0",
      type: "lexicon",
      name: "Test Lexicon",
      lang: "en",
      ...overrides,
    },
  };
}

function mockFetch(data: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(data),
    }),
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────

let store: Map<string, Module>;

beforeEach(() => {
  store = installFakeIdb();
  vi.restoreAllMocks();
});

// ── validate ──────────────────────────────────────────────────────────────

describe("validate", () => {
  it("throws on null", () => {
    expect(() => validate(null)).toThrow("invalid module: not an object");
  });

  it("throws on missing meta", () => {
    expect(() => validate({})).toThrow("invalid module: missing meta");
  });

  it("throws on missing meta.id", () => {
    expect(() => validate({ meta: { version: "1", type: "lexicon" } })).toThrow(
      "invalid module: meta.id missing",
    );
  });

  it("throws on missing meta.version", () => {
    expect(() => validate({ meta: { id: "x", type: "lexicon" } })).toThrow(
      "invalid module: meta.version missing",
    );
  });

  it("throws on unrecognized type", () => {
    expect(() => validate({ meta: { id: "x", version: "1", type: "unknown" } })).toThrow(
      "invalid module: meta.type 'unknown' not recognized",
    );
  });

  it("accepts every entry in VALID_TYPES", () => {
    for (const t of VALID_TYPES) {
      expect(() => validate({ meta: { id: "x", version: "1", type: t } })).not.toThrow();
    }
  });

  it("returns the module as Module on success", () => {
    const mod = makeModule();
    expect(validate(mod)).toBe(mod);
  });
});

// ── loadModule ────────────────────────────────────────────────────────────

describe("loadModule", () => {
  it("rejects when id is empty", async () => {
    await expect(loadModule("")).rejects.toThrow("loadModule: id required");
  });

  it("fetches and caches on first load (no cache)", async () => {
    const mod = makeModule();
    mockFetch(mod);

    const result = await loadModule("test-lexicon");

    expect(result.meta.id).toBe("test-lexicon");
    expect(result.meta.version).toBe("1.0.0");
    // Module should now be in the store
    expect(store.get("test-lexicon")).toBeDefined();
  });

  it("sets installedAt on first load", async () => {
    const mod = makeModule();
    mockFetch(mod);

    const result = await loadModule("test-lexicon");

    expect(typeof result.meta.installedAt).toBe("number");
  });

  it("returns cached when version matches network", async () => {
    const cached = makeModule();
    cached.meta.installedAt = 12345;
    store.set("test-lexicon", cached);

    const fresh = makeModule(); // same version
    mockFetch(fresh);

    const result = await loadModule("test-lexicon");

    expect(result).toBe(cached); // exact same reference → from cache
  });

  it("updates cache and returns fresh when version differs", async () => {
    const cached = makeModule({ version: "1.0.0" });
    store.set("test-lexicon", cached);

    const fresh = makeModule({ version: "2.0.0" });
    mockFetch(fresh);

    const result = await loadModule("test-lexicon");

    expect(result.meta.version).toBe("2.0.0");
    expect(result).not.toBe(cached);
    // Cache should reflect the new version
    expect(store.get("test-lexicon")?.meta.version).toBe("2.0.0");
  });

  it("falls back to cache on network error", async () => {
    const cached = makeModule();
    store.set("test-lexicon", cached);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await loadModule("test-lexicon");

    expect(result).toBe(cached);
  });

  it("falls back to cache when fresh JSON fails validation", async () => {
    const cached = makeModule();
    store.set("test-lexicon", cached);

    mockFetch({ meta: { id: "test-lexicon" } }); // missing version → invalid

    const result = await loadModule("test-lexicon");

    expect(result).toBe(cached);
  });

  it("falls back to cache when fresh meta.id does not match", async () => {
    const cached = makeModule();
    store.set("test-lexicon", cached);

    const wrong = makeModule({ id: "other-lexicon" });
    mockFetch(wrong);

    const result = await loadModule("test-lexicon");

    expect(result).toBe(cached);
  });

  it("rejects when no cache and fetch returns non-ok response", async () => {
    mockFetch(null, false, 404);

    await expect(loadModule("missing")).rejects.toThrow("fetch failed 404");
  });
});

// ── loadModuleFromUrl ─────────────────────────────────────────────────────

describe("loadModuleFromUrl", () => {
  it("rejects when url is empty", async () => {
    await expect(loadModuleFromUrl("", "x")).rejects.toThrow(
      "loadModuleFromUrl: url required",
    );
  });

  it("rejects when expectedId is empty", async () => {
    await expect(loadModuleFromUrl("http://x/m.json", "")).rejects.toThrow(
      "loadModuleFromUrl: expectedId required",
    );
  });

  it("fetches, validates, caches and resolves", async () => {
    const mod = makeModule();
    mockFetch(mod);

    const result = await loadModuleFromUrl("http://x/m.json", "test-lexicon");

    expect(result.meta.id).toBe("test-lexicon");
    expect(store.get("test-lexicon")).toBeDefined();
  });

  it("returns cached object when version matches (no cache update)", async () => {
    const cached = makeModule({ installedAt: 999 });
    store.set("test-lexicon", cached);

    const fresh = makeModule(); // same version
    mockFetch(fresh);

    const result = await loadModuleFromUrl("http://x/m.json", "test-lexicon");

    expect(result).toBe(cached);
  });

  it("updates cache when version differs", async () => {
    const cached = makeModule({ version: "1.0.0" });
    store.set("test-lexicon", cached);

    const fresh = makeModule({ version: "2.0.0" });
    mockFetch(fresh);

    const result = await loadModuleFromUrl("http://x/m.json", "test-lexicon");

    expect(result.meta.version).toBe("2.0.0");
    expect(store.get("test-lexicon")?.meta.version).toBe("2.0.0");
  });

  it("falls back to cache on network error", async () => {
    const cached = makeModule();
    store.set("test-lexicon", cached);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await loadModuleFromUrl("http://x/m.json", "test-lexicon");

    expect(result).toBe(cached);
  });

  it("rethrows network error when no cache exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(loadModuleFromUrl("http://x/m.json", "test-lexicon")).rejects.toThrow(
      "offline",
    );
  });

  it("throws when meta.id does not match expectedId", async () => {
    const wrong = makeModule({ id: "other" });
    mockFetch(wrong);

    await expect(
      loadModuleFromUrl("http://x/m.json", "test-lexicon"),
    ).rejects.toThrow("invalid module: meta.id 'other' != expected 'test-lexicon'");
  });
});

// ── listModules ───────────────────────────────────────────────────────────

describe("listModules", () => {
  it("returns [] when cache is empty", async () => {
    const result = await listModules();
    expect(result).toEqual([]);
  });

  it("maps cached modules to list items", async () => {
    store.set("test-lexicon", makeModule({ installedAt: 1000 }));

    const result = await listModules();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "test-lexicon",
      type: "lexicon",
      version: "1.0.0",
      name: "Test Lexicon",
      lang: "en",
      installedAt: 1000,
    });
  });

  it("coerces undefined installedAt to null (legacy || null quirk)", async () => {
    const mod = makeModule();
    delete mod.meta.installedAt; // leave undefined
    store.set("test-lexicon", mod);

    const result = await listModules();

    expect(result[0]?.installedAt).toBeNull();
  });

  it("returns one item per cached module", async () => {
    store.set("a-lexicon", makeModule({ id: "a-lexicon" }));
    store.set(
      "b-concordance",
      makeModule({ id: "b-concordance", type: "concordance" }),
    );

    const result = await listModules();

    expect(result).toHaveLength(2);
  });
});

// ── removeModule ──────────────────────────────────────────────────────────

describe("removeModule", () => {
  it("rejects when id is empty", async () => {
    await expect(removeModule("")).rejects.toThrow("removeModule: id required");
  });

  it("removes a cached module", async () => {
    store.set("test-lexicon", makeModule());

    await removeModule("test-lexicon");

    expect(store.has("test-lexicon")).toBe(false);
  });

  it("resolves without error for a non-existent id", async () => {
    await expect(removeModule("not-there")).resolves.toBeUndefined();
  });
});

// ── hasModule ─────────────────────────────────────────────────────────────

describe("hasModule", () => {
  it("returns false for empty id", async () => {
    expect(await hasModule("")).toBe(false);
  });

  it("returns false when module is not in cache", async () => {
    expect(await hasModule("test-lexicon")).toBe(false);
  });

  it("returns true when module is cached", async () => {
    store.set("test-lexicon", makeModule());
    expect(await hasModule("test-lexicon")).toBe(true);
  });
});
