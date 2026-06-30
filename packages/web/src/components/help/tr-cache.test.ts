// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TR_KEY, TR_TITLE_KEY, readTrCache, writeTrCache, cachedLangsFor } from "./tr-cache.js";

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

describe("translation cache keys", () => {
  it("builds the storage keys", () => {
    expect(TR_KEY("intro", "pt")).toBe("codex.help.tr.intro.pt");
    expect(TR_TITLE_KEY("intro", "pt")).toBe("codex.help.tr.intro.pt.title");
  });
});

describe("read/write translation cache", () => {
  it("returns null when nothing is cached", () => {
    expect(readTrCache("intro", "pt")).toBeNull();
  });

  it("round-trips body + title", () => {
    writeTrCache("intro", "pt", "corpo traduzido", "Título");
    expect(readTrCache("intro", "pt")).toEqual({ body: "corpo traduzido", title: "Título" });
  });

  it("writes no title key when title is null and reads back title null", () => {
    writeTrCache("intro", "pt", "só corpo", null);
    expect(localStorage.getItem(TR_TITLE_KEY("intro", "pt"))).toBeNull();
    expect(readTrCache("intro", "pt")).toEqual({ body: "só corpo", title: null });
  });
});

describe("cachedLangsFor", () => {
  it("lists the supported langs that have a cached body", () => {
    writeTrCache("intro", "es", "cuerpo", "Título");
    writeTrCache("intro", "fr", "corps", null);
    // a title-only entry without a body does not count
    localStorage.setItem(TR_TITLE_KEY("intro", "de"), "Titel");
    expect(cachedLangsFor("intro")).toEqual(["es", "fr"]);
  });

  it("returns an empty array when nothing is cached", () => {
    expect(cachedLangsFor("intro")).toEqual([]);
  });
});
