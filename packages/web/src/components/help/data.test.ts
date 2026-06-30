// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  catMeta,
  currentUiLang,
  getSupportedLangs,
  SUPPORTED_LANGS,
  LANG_NAME,
  CATEGORY_META,
} from "./data.js";
import type { HelpWindow } from "./help-window.js";

const w = (): HelpWindow => window as unknown as HelpWindow;

// This environment's localStorage lacks clear(); use a clean in-memory store.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage;
}

beforeEach(() => { vi.stubGlobal("localStorage", makeStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("catMeta", () => {
  it("returns the registered meta for a known category", () => {
    expect(catMeta("Reading")).toEqual(CATEGORY_META["Reading"]);
    expect(catMeta("Reading").icon).toBe("📜");
  });
  it("falls back gracefully for an unknown category", () => {
    expect(catMeta("Nope")).toEqual({ icon: "✧", blurb: "" });
  });
});

describe("LANG_NAME", () => {
  it("maps codes to English language names", () => {
    expect(LANG_NAME["he"]).toBe("Hebrew");
    expect(LANG_NAME["la"]).toBe("Latin");
  });
});

describe("SUPPORTED_LANGS (captured at module load — CODEX_LANGS unset)", () => {
  it("is the 8-language fallback", () => {
    expect(SUPPORTED_LANGS).toHaveLength(8);
    expect(SUPPORTED_LANGS[0]).toEqual({ code: "es", label: "Español" });
    expect(SUPPORTED_LANGS.map((l) => l.code)).toEqual(["es", "de", "pt", "fr", "la", "he", "el", "hi"]);
  });
});

describe("getSupportedLangs", () => {
  afterEach(() => { w().CODEX_LANGS = undefined; });

  it("returns the fallback when CODEX_LANGS is absent", () => {
    w().CODEX_LANGS = undefined;
    expect(getSupportedLangs()).toHaveLength(8);
  });
  it("maps CODEX_LANGS, dropping English and falling back label→id", () => {
    w().CODEX_LANGS = [
      { id: "en", label: "English" },
      { id: "es", label: "Spanish" },
      { id: "zz" },
    ];
    expect(getSupportedLangs()).toEqual([
      { code: "es", label: "Spanish" },
      { code: "zz", label: "zz" },
    ]);
  });
});

describe("currentUiLang", () => {
  beforeEach(() => { w().CODEX_LANG = undefined; });
  afterEach(() => { w().CODEX_LANG = undefined; });

  it("prefers window.CODEX_LANG", () => {
    w().CODEX_LANG = "pt";
    localStorage.setItem("codex.lang", "de");
    expect(currentUiLang()).toBe("pt");
  });
  it("falls back to localStorage codex.lang", () => {
    localStorage.setItem("codex.lang", "fr");
    expect(currentUiLang()).toBe("fr");
  });
  it("defaults to en", () => {
    expect(currentUiLang()).toBe("en");
  });
});
