// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  artPrimaryTranslation,
  artParseJSON,
  artSetTweak,
  artOpenPanel,
  artRunAction,
  ART_DESK_IDS,
} from "./actions.js";

interface TestWindow {
  CODEX_NOW?: { translation?: string; ref?: string };
  CODEX_INTEL?: { intelParseJSON?(t: string): unknown };
  CODEX_KERNEL?: { parseRef?(s: string): { bookId: string; chapter: number; v1?: number } | null };
  codexGoto?: (bookId: string, chapter: number, verse: number) => void;
  codexJumpToRef?: (ref: string) => void;
  codexDesk?: { on?: () => boolean; open?: (id: string) => void };
  codexDeskPanels?: { open?: (id: string) => void };
}
function tw(): TestWindow {
  return window as unknown as TestWindow;
}

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

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  const w = tw();
  delete w.CODEX_NOW;
  delete w.CODEX_INTEL;
  delete w.CODEX_KERNEL;
  delete w.codexGoto;
  delete w.codexJumpToRef;
  delete w.codexDesk;
  delete w.codexDeskPanels;
});

describe("artPrimaryTranslation", () => {
  it("defaults to kjv with no signal", () => {
    expect(artPrimaryTranslation()).toBe("kjv");
  });
  it("reads the tweaks store when present", () => {
    localStorage.setItem("codex.tweaks.v1", JSON.stringify({ primaryTranslation: "vul" }));
    expect(artPrimaryTranslation()).toBe("vul");
  });
  it("prefers CODEX_NOW.translation over the store", () => {
    localStorage.setItem("codex.tweaks.v1", JSON.stringify({ primaryTranslation: "vul" }));
    tw().CODEX_NOW = { translation: "lxx" };
    expect(artPrimaryTranslation()).toBe("lxx");
  });
});

describe("artParseJSON", () => {
  it("parses valid JSON", () => {
    expect(artParseJSON('{"a":1}')).toEqual({ a: 1 });
    expect(artParseJSON("[1,2,3]")).toEqual([1, 2, 3]);
  });
  it("returns undefined for invalid JSON with no intel fallback", () => {
    expect(artParseJSON("not json")).toBeUndefined();
  });
  it("falls back to CODEX_INTEL.intelParseJSON for invalid JSON", () => {
    tw().CODEX_INTEL = { intelParseJSON: () => ({ healed: true }) };
    expect(artParseJSON("{a:1}")).toEqual({ healed: true });
  });
});

describe("artSetTweak", () => {
  it("writes the key, returns the previous value, and dispatches tweakchange + toast", () => {
    localStorage.setItem("codex.tweaks.v1", JSON.stringify({ fontScale: 18 }));
    const tweak = vi.fn();
    const toast = vi.fn();
    window.addEventListener("tweakchange", tweak);
    window.addEventListener("codex:toast", toast);

    const prev = artSetTweak("fontScale", 22);

    expect(prev).toBe(18);
    expect(JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}")).toEqual({ fontScale: 22 });
    expect(tweak).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    const detail = (tweak.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail).toEqual({ fontScale: 22 });

    window.removeEventListener("tweakchange", tweak);
    window.removeEventListener("codex:toast", toast);
  });
});

describe("artOpenPanel", () => {
  it("returns false for an empty id", () => {
    expect(artOpenPanel("")).toBe(false);
    expect(artOpenPanel(null)).toBe(false);
  });
  it("uses codexDesk.open for a desk id when the desk is on", () => {
    const open = vi.fn();
    tw().codexDesk = { on: () => true, open };
    expect(ART_DESK_IDS).toContain("reader");
    expect(artOpenPanel("reader")).toBe(true);
    expect(open).toHaveBeenCalledWith("reader");
  });
  it("falls back to codexDeskPanels.open", () => {
    const open = vi.fn();
    tw().codexDeskPanels = { open };
    expect(artOpenPanel("gem")).toBe(true);
    expect(open).toHaveBeenCalledWith("gem");
  });
  it("dispatches codex:open-builtin-tab as the last resort", () => {
    const handler = vi.fn();
    window.addEventListener("codex:open-builtin-tab", handler);
    expect(artOpenPanel("trans")).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ tabId: "trans" });
    window.removeEventListener("codex:open-builtin-tab", handler);
  });
});

describe("artRunAction", () => {
  it("ignores non-objects", () => {
    expect(() => artRunAction(null)).not.toThrow();
    expect(() => artRunAction("x")).not.toThrow();
  });
  it("routes goto {ref} through codexJumpToRef", () => {
    const jump = vi.fn();
    tw().codexJumpToRef = jump;
    artRunAction({ kind: "goto", ref: "John 1:1" });
    expect(jump).toHaveBeenCalledWith("John 1:1");
  });
  it("routes goto {book} through CODEX_KERNEL.parseRef + codexGoto", () => {
    const goto = vi.fn();
    tw().codexGoto = goto;
    tw().CODEX_KERNEL = { parseRef: () => ({ bookId: "jhn", chapter: 1, v1: 1 }) };
    artRunAction({ kind: "goto", book: "John", chapter: 1, verse: 1 });
    expect(goto).toHaveBeenCalledWith("jhn", 1, 1);
  });
  it("routes setting {key,value} through the tweak store", () => {
    artRunAction({ kind: "setting", key: "redLetter", value: true });
    expect(JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}")).toEqual({ redLetter: true });
  });
  it("routes console {console,ref} through codex:os-open", () => {
    const handler = vi.fn();
    window.addEventListener("codex:os-open", handler);
    artRunAction({ kind: "console", console: "map", ref: "John 1:1" });
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ kind: "map", ref: "John 1:1" });
    window.removeEventListener("codex:os-open", handler);
  });
});
