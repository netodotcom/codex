// app — API key store (migrated from app.jsx). localStorage is the synchronous
// source of truth (direct-api.js reads it); IndexedDB is a write-through mirror
// so keys survive iOS Safari ITP eviction and localStorage quota failures. The
// active-provider selection is pure and ground-truth tested.
export const API_KEYS_STORE = "codex.api.keys.v1";
export const OLLAMA_URL_LS = "codex.ollama.url.v1";
export const OLLAMA_MODEL_LS = "codex.ollama.model.v1";
export const OLLAMA_DEFAULT_URL = "http://localhost:11434";

const _KEYS_IDB_NAME = "codex-keys";
const _KEYS_IDB_STORE = "kv";

export type Provider = "anthropic" | "grok" | "groq" | "gemini" | "ollama";
export interface ApiKeys {
  active: Provider;
  anthropic: string;
  grok: string;
  groq: string;
  gemini: string;
}

let _keysIdb: IDBDatabase | null = null;

function openKeysIdb(): Promise<IDBDatabase | null> {
  if (_keysIdb) return Promise.resolve(_keysIdb);
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(_KEYS_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(_KEYS_IDB_STORE);
      };
      req.onsuccess = () => {
        _keysIdb = req.result;
        resolve(_keysIdb);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetKeys(): Promise<ApiKeys | null> {
  const db = await openKeysIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readonly");
      const r = tx.objectStore(_KEYS_IDB_STORE).get("api");
      r.onsuccess = () => resolve((r.result as ApiKeys) || null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetKeys(v: ApiKeys): Promise<boolean> {
  const db = await openKeysIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(_KEYS_IDB_STORE, "readwrite");
      tx.objectStore(_KEYS_IDB_STORE).put(v, "api");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// Hydrate localStorage from IDB on cold start if LS is empty (iOS ITP may have
// cleared LS but IDB survived). Best-effort; fires once on import.
export function hydrateKeysFromIdb(): void {
  try {
    const ls = localStorage.getItem(API_KEYS_STORE);
    if (ls) return;
    idbGetKeys().then((v) => {
      if (!v || typeof v !== "object") return;
      try {
        if (!localStorage.getItem(API_KEYS_STORE)) {
          localStorage.setItem(API_KEYS_STORE, JSON.stringify(v));
          window.dispatchEvent(new CustomEvent("codex:keys:restored", { detail: v }));
        }
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

// Pure: normalise a stored blob and pick the active provider. Falls back through
// anthropic → grok → groq → gemini when the chosen provider has no key.
export function normalizeKeys(stored: Partial<ApiKeys> | null): ApiKeys {
  let v: ApiKeys = { active: "anthropic", anthropic: "", grok: "", groq: "", gemini: "" };
  v = { ...v, ...(stored || {}) };
  v.anthropic = String(v.anthropic || "").trim();
  v.grok = String(v.grok || "").trim();
  v.groq = String(v.groq || "").trim();
  v.gemini = String(v.gemini || "").trim();
  const VALID = new Set<Provider>(["anthropic", "grok", "groq", "gemini", "ollama"]);
  const has = (a: Provider): boolean => (a === "ollama" ? true : a === "groq" ? !!v.groq : a === "grok" ? !!v.grok : a === "gemini" ? !!v.gemini : !!v.anthropic);
  if (!VALID.has(v.active) || (v.active !== "ollama" && !has(v.active))) {
    if (v.anthropic) v.active = "anthropic";
    else if (v.grok) v.active = "grok";
    else if (v.groq) v.active = "groq";
    else if (v.gemini) v.active = "gemini";
    else v.active = "anthropic";
  }
  return v;
}

export function loadApiKeys(): ApiKeys {
  let stored: Partial<ApiKeys> | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(API_KEYS_STORE) || "null") as Partial<ApiKeys> | null;
  } catch {
    stored = null;
  }
  return normalizeKeys(stored);
}

// Returns { ok, where } so callers can surface real persistence failures to the
// user instead of silently swallowing QuotaExceededError.
export function saveApiKeys(v: ApiKeys): { ok: boolean; where: string } {
  let lsOk = false;
  try {
    localStorage.setItem(API_KEYS_STORE, JSON.stringify(v));
    lsOk = true;
  } catch {
    /* quota / ITP */
  }
  idbSetKeys(v).catch(() => {});
  return { ok: lsOk, where: lsOk ? "localStorage+idb" : "idb-only" };
}
