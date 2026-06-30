import { describe, it, expect } from "vitest";
import {
  validateModule,
  summarizeModule,
  defaultModuleUrl,
  createModuleLoader,
  VALID_TYPES,
  type StudyModule,
  type ModuleStore,
} from "./modules.js";

function mod(id: string, version: string, type = "lexicon"): StudyModule {
  return { meta: { id, version, type: type as StudyModule["meta"]["type"], name: id }, body: {} };
}

// In-memory ModuleStore + scriptable fetch — lets us drive the full loader
// logic with zero IndexedDB / network.
function memStore(seed: StudyModule[] = []): ModuleStore & { map: Map<string, StudyModule> } {
  const map = new Map<string, StudyModule>(seed.map((m) => [m.meta.id, m]));
  return {
    map,
    async get(id) {
      return map.get(id);
    },
    async put(m) {
      map.set(m.meta.id, m);
    },
    async del(id) {
      map.delete(id);
    },
    async all() {
      return [...map.values()];
    },
  };
}

describe("validateModule", () => {
  it("accepts a well-formed module", () => {
    expect(validateModule(mod("tsk", "1.0.0", "cross-reference")).meta.id).toBe("tsk");
  });
  it("rejects malformed input", () => {
    expect(() => validateModule(null)).toThrow(/not an object/);
    expect(() => validateModule({})).toThrow(/missing meta/);
    expect(() => validateModule({ meta: {} })).toThrow(/meta.id missing/);
    expect(() => validateModule({ meta: { id: "x" } })).toThrow(/meta.version missing/);
    expect(() => validateModule({ meta: { id: "x", version: "1", type: "bogus" } })).toThrow(/not recognized/);
  });
  it("exposes the 10 valid types", () => {
    expect(VALID_TYPES).toContain("lexicon");
    expect(VALID_TYPES.length).toBe(10);
  });
});

describe("summarizeModule / defaultModuleUrl", () => {
  it("summarizes meta and defaults installedAt to null", () => {
    expect(summarizeModule(mod("a", "2.0.0"))).toEqual({
      id: "a",
      type: "lexicon",
      version: "2.0.0",
      name: "a",
      lang: undefined,
      installedAt: null,
    });
  });
  it("derives the default url", () => {
    expect(defaultModuleUrl("tsk")).toBe("data/modules/tsk.json");
  });
});

describe("createModuleLoader", () => {
  const clock = () => 1700000000000;

  it("loadModule fetches + caches on a cache miss (sets installedAt)", async () => {
    const store = memStore();
    const loader = createModuleLoader({ store, fetchJson: async () => mod("tsk", "1.0.0"), now: clock });
    const out = await loader.loadModule("tsk");
    expect(out.meta.version).toBe("1.0.0");
    expect(out.meta.installedAt).toBe(clock());
    expect(store.map.has("tsk")).toBe(true);
  });

  it("loadModule returns cache when network reports the same version", async () => {
    const cached = mod("tsk", "1.0.0");
    cached.meta.installedAt = 1;
    const store = memStore([cached]);
    const loader = createModuleLoader({ store, fetchJson: async () => mod("tsk", "1.0.0"), now: clock });
    const out = await loader.loadModule("tsk");
    expect(out).toBe(cached); // untouched, installedAt stays 1
    expect(out.meta.installedAt).toBe(1);
  });

  it("loadModule upgrades when the network has a newer version", async () => {
    const store = memStore([mod("tsk", "1.0.0")]);
    const loader = createModuleLoader({ store, fetchJson: async () => mod("tsk", "2.0.0"), now: clock });
    const out = await loader.loadModule("tsk");
    expect(out.meta.version).toBe("2.0.0");
    expect(store.map.get("tsk")?.meta.version).toBe("2.0.0");
  });

  it("loadModule falls back to cache on a network error", async () => {
    const store = memStore([mod("tsk", "1.0.0")]);
    const loader = createModuleLoader({
      store,
      fetchJson: async () => {
        throw new Error("offline");
      },
      now: clock,
    });
    expect((await loader.loadModule("tsk")).meta.version).toBe("1.0.0");
  });

  it("loadModuleFromUrl requires url + expectedId and checks id", async () => {
    const store = memStore();
    const loader = createModuleLoader({ store, fetchJson: async () => mod("other", "1.0.0"), now: clock });
    await expect(loader.loadModuleFromUrl("", "x")).rejects.toThrow(/url required/);
    await expect(loader.loadModuleFromUrl("u", "")).rejects.toThrow(/expectedId required/);
    await expect(loader.loadModuleFromUrl("u", "tsk")).rejects.toThrow(/!= expected/);
  });

  it("loadModuleFromUrl serves cache on a network error, else rethrows", async () => {
    const fail: ModuleStore["get"] = async () => undefined;
    const noNet = async () => {
      throw new Error("offline");
    };
    const empty = memStore();
    const loaderNoCache = createModuleLoader({ store: empty, fetchJson: noNet, now: clock });
    await expect(loaderNoCache.loadModuleFromUrl("u", "tsk")).rejects.toThrow(/offline/);

    const withCache = memStore([mod("tsk", "1.0.0")]);
    const loaderCached = createModuleLoader({ store: withCache, fetchJson: noNet, now: clock });
    expect((await loaderCached.loadModuleFromUrl("u", "tsk")).meta.version).toBe("1.0.0");
    void fail;
  });

  it("listModules / hasModule / removeModule", async () => {
    const store = memStore([mod("a", "1.0.0"), mod("b", "1.0.0")]);
    const loader = createModuleLoader({ store, fetchJson: async () => ({}), now: clock });
    expect((await loader.listModules()).map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(await loader.hasModule("a")).toBe(true);
    expect(await loader.hasModule("z")).toBe(false);
    await loader.removeModule("a");
    expect(await loader.hasModule("a")).toBe(false);
  });
});
