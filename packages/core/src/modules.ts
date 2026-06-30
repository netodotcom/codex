// Study-module loader (lexicons, cross-refs, commentaries, ...).
//
// Ported from modules.js. The original hard-wired IndexedDB + fetch; here the
// IO is injected (ModuleStore + FetchJson) so the full load/revalidate/cache
// logic is testable with in-memory fakes. The platform layer supplies an
// IndexedDB-backed store and a real fetch when wiring window.CODEX_MODULES.

export type ModuleType =
  | "lexicon"
  | "concordance"
  | "cross-reference"
  | "commentary"
  | "reading-plan"
  | "timeline"
  | "map-overlay"
  | "dictionary"
  | "parsha"
  | "cantillation";

export const VALID_TYPES: readonly ModuleType[] = [
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

export interface ModuleMeta {
  id: string;
  type: ModuleType;
  version: string;
  name?: string;
  lang?: string;
  installedAt?: number;
  [key: string]: unknown;
}

export interface StudyModule {
  meta: ModuleMeta;
  [key: string]: unknown;
}

export interface ModuleSummary {
  id: string;
  type: ModuleType;
  version: string;
  name?: string;
  lang?: string;
  installedAt: number | null;
}

// ── pure helpers ────────────────────────────────────────────────────────
export function validateModule(mod: unknown): StudyModule {
  if (!mod || typeof mod !== "object") throw new Error("invalid module: not an object");
  const meta = (mod as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") throw new Error("invalid module: missing meta");
  const m = meta as Record<string, unknown>;
  if (!m["id"] || typeof m["id"] !== "string") throw new Error("invalid module: meta.id missing");
  if (!m["version"] || typeof m["version"] !== "string") {
    throw new Error("invalid module: meta.version missing");
  }
  if (!VALID_TYPES.includes(m["type"] as ModuleType)) {
    throw new Error("invalid module: meta.type '" + String(m["type"]) + "' not recognized");
  }
  return mod as StudyModule;
}

export function summarizeModule(m: StudyModule): ModuleSummary {
  return {
    id: m.meta.id,
    type: m.meta.type,
    version: m.meta.version,
    name: m.meta.name,
    lang: m.meta.lang,
    installedAt: m.meta.installedAt ?? null,
  };
}

export function defaultModuleUrl(id: string): string {
  return "data/modules/" + id + ".json";
}

// ── injected IO ─────────────────────────────────────────────────────────
export interface ModuleStore {
  get(id: string): Promise<StudyModule | undefined>;
  put(mod: StudyModule): Promise<void>;
  del(id: string): Promise<void>;
  all(): Promise<StudyModule[]>;
}

export type FetchJson = (url: string) => Promise<unknown>;

export interface ModuleLoaderDeps {
  store: ModuleStore;
  fetchJson: FetchJson;
  /** injectable clock; defaults to Date.now */
  now?: () => number;
}

export interface ModuleLoader {
  loadModule(id: string): Promise<StudyModule>;
  loadModuleFromUrl(url: string, expectedId: string): Promise<StudyModule>;
  listModules(): Promise<ModuleSummary[]>;
  removeModule(id: string): Promise<void>;
  hasModule(id: string): Promise<boolean>;
  readonly VALID_TYPES: readonly ModuleType[];
}

export function createModuleLoader(deps: ModuleLoaderDeps): ModuleLoader {
  const { store, fetchJson } = deps;
  const now = deps.now ?? (() => Date.now());

  async function loadFromUrl(url: string, expectedId: string): Promise<StudyModule> {
    const mod = validateModule(await fetchJson(url));
    if (mod.meta.id !== expectedId) {
      throw new Error("invalid module: meta.id '" + mod.meta.id + "' != expected '" + expectedId + "'");
    }
    mod.meta.installedAt = now();
    await store.put(mod);
    return mod;
  }

  async function loadModule(id: string): Promise<StudyModule> {
    if (!id) throw new Error("loadModule: id required");
    const url = defaultModuleUrl(id);
    const cached = await store.get(id);
    if (!cached) return loadFromUrl(url, id);
    // Revalidate version against network; on any network error, use cache.
    let fresh: unknown;
    try {
      fresh = await fetchJson(url);
    } catch {
      return cached;
    }
    let valid: StudyModule;
    try {
      valid = validateModule(fresh);
    } catch {
      return cached;
    }
    if (valid.meta.id !== id) return cached;
    if (valid.meta.version !== cached.meta.version) {
      valid.meta.installedAt = now();
      await store.put(valid);
      return valid;
    }
    return cached;
  }

  async function loadModuleFromUrl(url: string, expectedId: string): Promise<StudyModule> {
    if (!url) throw new Error("loadModuleFromUrl: url required");
    if (!expectedId) throw new Error("loadModuleFromUrl: expectedId required");
    const cached = await store.get(expectedId);
    let fresh: unknown;
    try {
      fresh = await fetchJson(url);
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
    const valid = validateModule(fresh);
    if (valid.meta.id !== expectedId) {
      throw new Error("invalid module: meta.id '" + valid.meta.id + "' != expected '" + expectedId + "'");
    }
    if (cached && cached.meta.version === valid.meta.version) return cached;
    valid.meta.installedAt = now();
    await store.put(valid);
    return valid;
  }

  async function listModules(): Promise<ModuleSummary[]> {
    const all = await store.all();
    return (all || []).map(summarizeModule);
  }

  async function removeModule(id: string): Promise<void> {
    if (!id) throw new Error("removeModule: id required");
    await store.del(id);
  }

  async function hasModule(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      return !!(await store.get(id));
    } catch {
      return false;
    }
  }

  return { loadModule, loadModuleFromUrl, listModules, removeModule, hasModule, VALID_TYPES };
}
