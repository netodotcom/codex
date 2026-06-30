// modules — loader logic (faithful port from legacy/modules.js).
// Loads JSON study modules (lexicons, cross-refs, commentaries, …) with
// IndexedDB caching. Pure browser JS, no deps beyond DOM globals.
import type { Module, ModuleListItem, ValidType } from "./types.js";

const DB_NAME = "codex-modules";
const STORE = "modules";
const DB_VERSION = 1;

export const VALID_TYPES: ValidType[] = [
  "lexicon",
  "concordance",
  "cross-reference",
  "commentary",
  "reading-plan",
  "timeline",
  "map-overlay",
  "dictionary",
  "parsha",
  "cantillation",
];

// ---------- IndexedDB tiny promise wrapper ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      // NOTE: preserved from legacy — use req.result directly (same reference as e.target)
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "meta.id" });
      }
    };
    req.onsuccess = () => { resolve(req.result); };
    req.onerror = () => { reject(req.error); };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => { resolve(req.result); };
    req.onerror = () => { reject(req.error); };
  });
}

function idbTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result: T | undefined;
        // NOTE: preserved from legacy — result captured in fn's .then(); oncomplete fires after
        Promise.resolve(fn(store)).then((r) => { result = r; }, reject);
        tx.oncomplete = () => { resolve(result as T); };
        tx.onerror = () => { reject(tx.error); };
        tx.onabort = () => { reject(tx.error); };
      }),
  );
}

function cacheGet(id: string): Promise<Module | undefined> {
  return idbTx<Module | undefined>(
    "readonly",
    (s) => idbReq(s.get(id) as IDBRequest<Module | undefined>),
  );
}

function cachePut(mod: Module): Promise<IDBValidKey> {
  return idbTx<IDBValidKey>(
    "readwrite",
    (s) => idbReq(s.put(mod) as IDBRequest<IDBValidKey>),
  );
}

function cacheDel(id: string): Promise<undefined> {
  return idbTx<undefined>(
    "readwrite",
    (s) => idbReq(s.delete(id) as IDBRequest<undefined>),
  );
}

function cacheAll(): Promise<Module[]> {
  return idbTx<Module[]>(
    "readonly",
    (s) => idbReq(s.getAll() as IDBRequest<Module[]>),
  );
}

// ---------- Validation ----------

export function validate(mod: unknown): Module {
  if (!mod || typeof mod !== "object") throw new Error("invalid module: not an object");
  const obj = mod as Record<string, unknown>;
  const m = obj["meta"];
  if (!m || typeof m !== "object") throw new Error("invalid module: missing meta");
  const meta = m as Record<string, unknown>;
  if (!meta["id"] || typeof meta["id"] !== "string")
    throw new Error("invalid module: meta.id missing");
  if (!meta["version"] || typeof meta["version"] !== "string")
    throw new Error("invalid module: meta.version missing");
  // NOTE: preserved from legacy — indexOf kept (not .includes()) to match exact original guard
  if (VALID_TYPES.indexOf(meta["type"] as ValidType) === -1)
    throw new Error(
      "invalid module: meta.type '" + String(meta["type"]) + "' not recognized",
    );
  return mod as Module;
}

// ---------- Fetch ----------

function fetchJson(url: string): Promise<unknown> {
  return fetch(url, { credentials: "same-origin" }).then((r) => {
    if (!r.ok) throw new Error("fetch failed " + r.status + " for " + url);
    return r.json() as Promise<unknown>;
  });
}

function defaultUrl(id: string): string {
  return "data/modules/" + id + ".json";
}

// ---------- Core loaders ----------

function loadFromUrl(url: string, expectedId: string, source: string): Promise<Module> {
  return fetchJson(url).then((mod) => {
    const validated = validate(mod);
    if (expectedId && validated.meta.id !== expectedId) {
      throw new Error(
        "invalid module: meta.id '" +
          validated.meta.id +
          "' != expected '" +
          expectedId +
          "'",
      );
    }
    validated.meta.installedAt = Date.now();
    return cachePut(validated).then(() => {
      console.log(
        "[modules] loaded " +
          validated.meta.id +
          " v" +
          validated.meta.version +
          " from " +
          source,
      );
      return validated;
    });
  });
}

export async function loadModule(id: string): Promise<Module> {
  if (!id) throw new Error("loadModule: id required");
  const url = defaultUrl(id);
  const cached = await cacheGet(id);
  if (!cached) return loadFromUrl(url, id, "network");

  // Revalidate version against network; on any network error, use cache.
  let freshRaw: unknown;
  try {
    freshRaw = await fetchJson(url);
  } catch {
    console.log("[modules] loaded " + id + " v" + cached.meta.version + " from cache");
    return cached;
  }

  let fresh: Module;
  // NOTE: preserved from legacy — validate errors silently fall back to cache
  try {
    fresh = validate(freshRaw);
  } catch {
    return cached;
  }

  if (fresh.meta.id !== id) return cached;
  if (fresh.meta.version !== cached.meta.version) {
    fresh.meta.installedAt = Date.now();
    await cachePut(fresh);
    console.log("[modules] loaded " + id + " v" + fresh.meta.version + " from network");
    return fresh;
  }
  console.log("[modules] loaded " + id + " v" + cached.meta.version + " from cache");
  return cached;
}

export async function loadModuleFromUrl(
  url: string,
  expectedId: string,
): Promise<Module> {
  if (!url) throw new Error("loadModuleFromUrl: url required");
  if (!expectedId) throw new Error("loadModuleFromUrl: expectedId required");

  const cached = await cacheGet(expectedId);

  let freshRaw: unknown;
  try {
    freshRaw = await fetchJson(url);
  } catch (err: unknown) {
    if (cached) {
      console.log(
        "[modules] loaded " + expectedId + " v" + cached.meta.version + " from cache",
      );
      return cached;
    }
    // NOTE: preserved from legacy — rethrow when no cache fallback is available
    throw err;
  }

  const fresh = validate(freshRaw);
  if (fresh.meta.id !== expectedId) {
    throw new Error(
      "invalid module: meta.id '" +
        fresh.meta.id +
        "' != expected '" +
        expectedId +
        "'",
    );
  }

  if (cached && cached.meta.version === fresh.meta.version) {
    console.log(
      "[modules] loaded " + expectedId + " v" + cached.meta.version + " from cache",
    );
    return cached;
  }

  fresh.meta.installedAt = Date.now();
  await cachePut(fresh);
  console.log(
    "[modules] loaded " + expectedId + " v" + fresh.meta.version + " from network",
  );
  return fresh;
}

export async function listModules(): Promise<ModuleListItem[]> {
  const all = await cacheAll();
  // NOTE: preserved from legacy — defensive `|| []`; cacheAll() always resolves an array
  return (all || []).map((m) => ({
    id: m.meta.id,
    type: m.meta.type,
    version: m.meta.version,
    name: m.meta.name,
    lang: m.meta.lang,
    // NOTE: preserved from legacy — `|| null` coerces 0 and undefined to null (not ??)
    installedAt: m.meta.installedAt || null,
  }));
}

export async function removeModule(id: string): Promise<void> {
  if (!id) throw new Error("removeModule: id required");
  await cacheDel(id);
}

export async function hasModule(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const m = await cacheGet(id);
    return !!m;
  } catch {
    return false;
  }
}
