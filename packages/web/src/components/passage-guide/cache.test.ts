// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cacheKey, getCached, putCached } from "./cache.js";
import type { Guide } from "./json.js";

// The runner's global localStorage shim is broken; stub a real in-memory one.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

interface LangWindow {
  CODEX_LANG?: string;
}
function setLang(lang: string | undefined): void {
  (window as unknown as LangWindow).CODEX_LANG = lang;
}

const sampleGuide: Guide = {
  _schema: 1,
  overview: "ov",
  outline: [{ title: "t" }],
  themes: [],
  key_words: [],
  historical_context: "",
  synthesis: "",
};

describe("cache", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    setLang(undefined);
  });
  afterEach(() => {
    setLang(undefined);
  });

  it("builds the English key with no suffix", () => {
    expect(cacheKey("gen", 1)).toBe("codex.passage-guide.gen.1");
  });
  it("suffixes non-English languages", () => {
    setLang("pt");
    expect(cacheKey("gen", 1)).toBe("codex.passage-guide.gen.1.pt");
  });
  it("round-trips a guide through put/get", () => {
    putCached("gen", 3, sampleGuide);
    expect(getCached("gen", 3)).toEqual(sampleGuide);
  });
  it("returns null for a missing entry", () => {
    expect(getCached("gen", 99)).toBeNull();
  });
  it("returns null when the stored wrapper lacks _v:1", () => {
    localStorage.setItem("codex.passage-guide.gen.4", JSON.stringify({ data: sampleGuide }));
    expect(getCached("gen", 4)).toBeNull();
  });
  it("returns null on corrupt JSON", () => {
    localStorage.setItem("codex.passage-guide.gen.5", "{not json");
    expect(getCached("gen", 5)).toBeNull();
  });
});
