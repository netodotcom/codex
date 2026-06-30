// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadRepos, saveRepos, removeRepo, REPOS_KEY } from "./helpers.js";
import type { Repo } from "./data.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// The runner's global localStorage shim is broken; install a real in-memory one.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

type WindowWithData = Window & {
  CODEX_DATA?: { translations: Array<{ id: string; [key: string]: unknown }> };
};

const w = (): WindowWithData => window as unknown as WindowWithData;

const sampleRepo: Repo = {
  id: "esv",
  name: "English Standard",
  year: "2001",
  license: "User-added",
  glyph: "ESV",
  lang: "EN",
  source: "bolls",
  apiId: "ESV",
};

beforeEach(() => {
  installStorage();
  w().CODEX_DATA = undefined;
});

describe("loadRepos / saveRepos (ground truth)", () => {
  it("returns [] when nothing is stored", () => {
    expect(loadRepos()).toEqual([]);
  });

  it("returns [] on corrupt JSON", () => {
    localStorage.setItem(REPOS_KEY, "{broken");
    expect(loadRepos()).toEqual([]);
  });

  it("round-trips a single repo", () => {
    saveRepos([sampleRepo]);
    expect(loadRepos()).toEqual([sampleRepo]);
  });

  it("round-trips multiple repos", () => {
    const two: Repo[] = [
      sampleRepo,
      { ...sampleRepo, id: "niv", name: "New International", apiId: "NIV", glyph: "NIV" },
    ];
    saveRepos(two);
    expect(loadRepos()).toEqual(two);
  });

  it("saveRepos does not throw", () => {
    expect(() => saveRepos([sampleRepo])).not.toThrow();
  });
});

describe("removeRepo (ground truth)", () => {
  it("returns false when CODEX_DATA is absent", () => {
    saveRepos([sampleRepo]);
    expect(removeRepo("esv")).toBe(false);
  });

  it("returns false when the id is not in the stored repos (not user-added)", () => {
    w().CODEX_DATA = { translations: [{ id: "kjv" }, { id: "esv" }] };
    saveRepos([sampleRepo]); // only "esv" is user-added
    expect(removeRepo("kjv")).toBe(false);
  });

  it("returns false when stored list is empty", () => {
    w().CODEX_DATA = { translations: [] };
    expect(removeRepo("esv")).toBe(false);
  });

  it("removes the repo from storage and from CODEX_DATA.translations", () => {
    w().CODEX_DATA = { translations: [{ id: "esv" }, { id: "kjv" }] };
    saveRepos([sampleRepo]);

    const result = removeRepo("esv");

    expect(result).toBe(true);
    expect(loadRepos()).toEqual([]);
    expect(w().CODEX_DATA?.translations).toEqual([{ id: "kjv" }]);
  });

  it("purges matching cache entries from codex.bible.cache.v2", () => {
    w().CODEX_DATA = { translations: [{ id: "esv" }] };
    saveRepos([sampleRepo]);
    const cache = { "gen.1.esv": "cached", "gen.1.kjv": "keep" };
    localStorage.setItem("codex.bible.cache.v2", JSON.stringify(cache));

    removeRepo("esv");

    const remaining = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}") as Record<string, unknown>;
    expect(remaining["gen.1.esv"]).toBeUndefined();
    expect(remaining["gen.1.kjv"]).toBe("keep");
  });

  it("dispatches codex:translations-changed event", () => {
    w().CODEX_DATA = { translations: [{ id: "esv" }] };
    saveRepos([sampleRepo]);

    let detail: unknown = null;
    window.addEventListener("codex:translations-changed", (e) => {
      detail = (e as CustomEvent).detail;
    }, { once: true });

    removeRepo("esv");
    expect(detail).toEqual({ id: "esv" });
  });
});
