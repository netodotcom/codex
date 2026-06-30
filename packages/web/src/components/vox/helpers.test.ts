// @vitest-environment jsdom
// jsdom env: helpers that read window globals (CODEX_DATA, BIBLE) and localStorage
// need a DOM. Ground-truth values for the pure helpers were captured by running a
// faithful copy of the originals in node.
import { describe, it, expect, beforeEach } from "vitest";
import {
  isNaturalVoice, langDisplay, verseNum, verseTextOf,
  prefsKey, loadPrefs, savePrefs,
  bookName, activeTranslationLang, loadChapterVerses,
} from "./helpers.js";
import { badgeStyle } from "./styles.js";
import type { VoxWindow } from "./vox-window.js";

const W = (): VoxWindow => window as unknown as VoxWindow;

function voice(name: string, lang = "en-US"): SpeechSynthesisVoice {
  return { name, lang, voiceURI: name, localService: true, default: false } as SpeechSynthesisVoice;
}

// jsdom here ships a localStorage object with no methods; install an in-memory
// Storage so the prefs round-trip is actually exercised.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  delete W().CODEX_DATA;
  delete W().BIBLE;
});

describe("isNaturalVoice (ground truth)", () => {
  it("detects premium keywords case-insensitively", () => {
    expect(isNaturalVoice(voice("Samantha (Enhanced)"))).toBe(true);
    expect(isNaturalVoice(voice("Ava (Premium)"))).toBe(true);
    expect(isNaturalVoice(voice("WaveNet D"))).toBe(true);
    expect(isNaturalVoice(voice("Google US English"))).toBe(false);
    expect(isNaturalVoice(null)).toBe(false);
  });
});

describe("langDisplay (ground truth)", () => {
  it("maps known codes and uppercases the rest", () => {
    expect(langDisplay("en")).toBe("English");
    expect(langDisplay("he")).toBe("עברית");
    expect(langDisplay("xx")).toBe("XX");
  });
});

describe("verseNum (ground truth)", () => {
  it("prefers n, then verse, then num", () => {
    expect(verseNum({ n: 5 })).toBe(5);
    expect(verseNum({ verse: 7 })).toBe(7);
    expect(verseNum({ num: 9 })).toBe(9);
    expect(verseNum({ n: 0 })).toBe(0);
    expect(verseNum(null)).toBeUndefined();
  });
});

describe("verseTextOf (ground truth)", () => {
  it("prefers the requested translation, then kjv/web/text/t, then any string", () => {
    expect(verseTextOf({ esv: "E", kjv: "K" }, "esv")).toBe("E");
    expect(verseTextOf({ kjv: "K", web: "W" }, "esv")).toBe("K");
    expect(verseTextOf({ web: "W" })).toBe("W");
    expect(verseTextOf({ text: "T" })).toBe("T");
    expect(verseTextOf({ t: "TT" })).toBe("TT");
    expect(verseTextOf({ n: 3, foo: "F" })).toBe("F");
    expect(verseTextOf({ n: 3 })).toBe("");
    expect(verseTextOf(null)).toBe("");
  });
});

describe("prefs persistence", () => {
  it("keys per voice and round-trips through localStorage", () => {
    expect(prefsKey(undefined)).toBe("codex.vox.prefs.default");
    expect(prefsKey("v1")).toBe("codex.vox.prefs.v1");
    expect(loadPrefs("missing")).toEqual({ rate: 1.0, pitch: 1.0, volume: 1.0 });
    savePrefs("v1", { rate: 1.5, pitch: 0.8, volume: 0.5 });
    expect(loadPrefs("v1")).toEqual({ rate: 1.5, pitch: 0.8, volume: 0.5 });
  });
});

describe("bookName / activeTranslationLang (window.CODEX_DATA)", () => {
  it("resolves a book name, falling back to the id", () => {
    W().CODEX_DATA = { books: [{ id: "gen", name: "Genesis" }] };
    expect(bookName("gen")).toBe("Genesis");
    expect(bookName("zzz")).toBe("zzz");
  });
  it("lowercases the translation's language, defaulting to en", () => {
    W().CODEX_DATA = { translations: [{ id: "rvr", lang: "ES" }, { id: "lxx", language: "EL" }] };
    expect(activeTranslationLang("rvr")).toBe("es");
    expect(activeTranslationLang("lxx")).toBe("el");
    expect(activeTranslationLang("unknown")).toBe("en");
    expect(activeTranslationLang(undefined)).toBe("en");
  });
});

describe("loadChapterVerses (window.BIBLE)", () => {
  it("returns [] with no BIBLE store", async () => {
    expect(await loadChapterVerses("gen", 1, "kjv")).toEqual([]);
  });
  it("uses loadChapter when it returns an array", async () => {
    W().BIBLE = { loadChapter: async () => [{ n: 1, kjv: "a" }] };
    expect(await loadChapterVerses("gen", 1, "kjv")).toEqual([{ n: 1, kjv: "a" }]);
  });
  it("unwraps a { verses } shape from loadChapter", async () => {
    W().BIBLE = { loadChapter: async () => ({ verses: [{ n: 2 }] }) };
    expect(await loadChapterVerses("gen", 1, "kjv")).toEqual([{ n: 2 }]);
  });
  it("falls back to getCachedChapter when loadChapter yields nothing usable", async () => {
    W().BIBLE = { loadChapter: async () => null, getCachedChapter: () => [{ n: 3 }] };
    expect(await loadChapterVerses("gen", 1, "kjv")).toEqual([{ n: 3 }]);
  });
});

describe("badgeStyle (ground truth)", () => {
  it("maps known traditions and falls back to interfaith", () => {
    expect(badgeStyle("jewish").background).toBe("#102438");
    expect(badgeStyle("nope").background).toBe("#241d10");
    expect(badgeStyle(undefined).background).toBe("#241d10");
    expect(badgeStyle("jewish").textTransform).toBe("uppercase");
  });
});
