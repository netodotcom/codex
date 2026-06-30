// @vitest-environment jsdom
// Ground truth (readerSourceChain) captured from a faithful node copy of the
// original reader.jsx before migration.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readerSourceChain,
  readerLoad,
  readerHighlights,
  _readerSourceMemo,
  READER_HL,
  READER_FONTS,
} from "./source.js";
import type { SoulWindow } from "./soul-window.js";

const TR = [
  { id: "web", canons: ["protestant"] },
  { id: "kjv", canons: ["protestant"] },
  { id: "lxx", canons: ["ot"] },
  { id: "enoch", canons: ["pseudepigrapha"] },
  { id: "dra", canons: ["catholic"] },
];
const BOOKS = [
  { id: "jhn", name: "John", chapters: 21, testament: "NT" },
  { id: "gen", name: "Genesis", chapters: 50, testament: "OT" },
  { id: "enoch", name: "1 Enoch", chapters: 108, testament: "DC", canon: "pseudepigrapha" },
];

function win(): SoulWindow {
  return window as unknown as SoulWindow;
}

// jsdom under vitest ships a non-functional localStorage; stub a real in-memory
// Storage (the repo-wide pattern).
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  win().CODEX_DATA = { translations: TR, books: BOOKS };
  win().BIBLE = undefined;
  for (const k of Object.keys(_readerSourceMemo)) delete _readerSourceMemo[k];
});

describe("readerSourceChain", () => {
  it("puts the covering primary first for an NT book", () => {
    expect(readerSourceChain({ id: "jhn", testament: "NT" }, "web")).toEqual(["web", "kjv"]);
  });

  it("keeps a non-protestant primary first for OT, then protestant fallbacks", () => {
    expect(readerSourceChain({ id: "gen", testament: "OT" }, "lxx")).toEqual(["lxx", "web", "kjv"]);
  });

  it("matches the explicit canon for a DC book", () => {
    expect(readerSourceChain({ id: "enoch", testament: "DC", canon: "pseudepigrapha" }, "web")).toEqual(["enoch"]);
    expect(readerSourceChain({ id: "x", testament: "DC", canon: "catholic" }, "web")).toEqual(["dra"]);
  });

  it("falls back to the primary when nothing covers an unknown canon", () => {
    expect(readerSourceChain({ id: "x", testament: "DC", canon: "zzz" }, "web")).toEqual(["web"]);
  });

  it("uses protestant coverage when there is no book", () => {
    expect(readerSourceChain(undefined, "web")).toEqual(["web", "kjv"]);
  });
});

describe("readerLoad", () => {
  it("returns the primary translation when it carries the chapter", async () => {
    win().BIBLE = { loadMulti: vi.fn(async () => [{ n: 1, web: "In the beginning" }]) };
    const r = await readerLoad("jhn", 1, "web");
    expect(r.translation).toBe("web");
    expect(r.fallback).toBe(false);
    expect(r.verses).toHaveLength(1);
    expect(_readerSourceMemo["jhn"]).toBe("web");
  });

  it("walks the chain and flags a fallback source", async () => {
    const loadMulti = vi.fn(async (_b: string, _c: number, trs: string[]) =>
      trs[0] === "web" ? [] : [{ n: 1, kjv: "And the LORD" }]);
    win().BIBLE = { loadMulti };
    const r = await readerLoad("jhn", 1, "web");
    expect(r.translation).toBe("kjv");
    expect(r.fallback).toBe(true);
    expect(_readerSourceMemo["jhn"]).toBe("kjv");
  });

  it("throws when no source carries the chapter", async () => {
    win().BIBLE = { loadMulti: vi.fn(async () => []) };
    await expect(readerLoad("jhn", 1, "web")).rejects.toThrow(/No source carries jhn 1/);
  });
});

describe("readerHighlights", () => {
  it("parses the codex.highlights.v1 store", () => {
    localStorage.setItem("codex.highlights.v1", JSON.stringify({ "jhn.3.16": { color: "gold" } }));
    expect(readerHighlights()).toEqual({ "jhn.3.16": { color: "gold" } });
  });

  it("returns an empty map when the store is empty", () => {
    expect(readerHighlights()).toEqual({});
  });
});

describe("constants", () => {
  it("keeps the highlight palette and font ladder", () => {
    expect(READER_HL.amber).toBe("#ffd479");
    expect(READER_HL.gold).toBe("#ffd479");
    expect(READER_FONTS).toEqual([16, 19, 22, 26, 30]);
  });
});
