// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadTsk, getCrossRefs, MODULE_ID, __resetTskCache } from "./data.js";
import type { TskModule } from "./crossref-window.js";

const sampleMod: TskModule = {
  verses: {
    "jhn.3.16": ["gen.1.1", { ref: "rom.5.8", theme: "love" }],
  },
  meta: { totalRefs: 42 },
};

interface ModWindow {
  CODEX_MODULES?: { loadModule: (id: string) => Promise<TskModule> };
}
function setModules(loadModule: (id: string) => Promise<TskModule>): void {
  (window as unknown as ModWindow).CODEX_MODULES = { loadModule };
}

describe("loadTsk / getCrossRefs", () => {
  beforeEach(() => {
    __resetTskCache();
  });

  it("loads the module by MODULE_ID and caches the promise", async () => {
    const loadModule = vi.fn(async () => sampleMod);
    setModules(loadModule);
    const a = await loadTsk();
    expect(a).toBe(sampleMod);
    expect(MODULE_ID).toBe("tsk-sample");
    expect(loadModule).toHaveBeenCalledWith("tsk-sample");
    await loadTsk();
    expect(loadModule).toHaveBeenCalledTimes(1); // served from the shared cache
  });

  it("getCrossRefs lowercases a string key", async () => {
    setModules(vi.fn(async () => sampleMod));
    expect(await getCrossRefs("JHN.3.16")).toEqual(["gen.1.1", { ref: "rom.5.8", theme: "love" }]);
  });

  it("getCrossRefs builds a key from an object and drops an empty verse", async () => {
    setModules(vi.fn(async () => sampleMod));
    expect(await getCrossRefs({ bookId: "jhn", chapter: 3, verse: 16 })).toEqual([
      "gen.1.1",
      { ref: "rom.5.8", theme: "love" },
    ]);
    // no verse → "jhn.3" → not present → []
    expect(await getCrossRefs({ bookId: "jhn", chapter: 3 })).toEqual([]);
  });

  it("rejects when CODEX_MODULES is unavailable", async () => {
    delete (window as unknown as ModWindow).CODEX_MODULES;
    await expect(loadTsk()).rejects.toThrow("CODEX_MODULES not available");
  });
});
