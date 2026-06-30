// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  parseVerseKey,
  shortRef,
  formatRef,
  normalizeKey,
  bookMeta,
  rgba,
  themeColor,
  chapterVerses,
  snippetFor,
} from "./helpers.js";
import type { CodexBook } from "./crossref-window.js";

const BOOKS: CodexBook[] = [
  { id: "jhn", name: "John", testament: "NT" },
  { id: "gen", name: "Genesis", testament: "OT" },
  { id: "rom", name: "Romans", testament: "NT" },
  { id: "1co", name: "1 Corinthians", testament: "NT" },
];

interface TestWindow {
  CODEX_DATA?: { books?: CodexBook[] };
  BIBLE?: { getCachedChapter?: (b: string, c: number, tr: string) => unknown };
}
const tw = (): TestWindow => window as unknown as TestWindow;

beforeEach(() => {
  tw().CODEX_DATA = { books: BOOKS };
  delete tw().BIBLE;
});

describe("parseVerseKey (ground truth)", () => {
  it("parses book.chapter.verse and lowercases the book", () => {
    expect(parseVerseKey("jhn.3.16")).toEqual({ bookId: "jhn", chapter: 3, verse: 16 });
    expect(parseVerseKey("GEN.1")).toEqual({ bookId: "gen", chapter: 1, verse: null });
  });
  it("rejects bad input", () => {
    expect(parseVerseKey("gen.x.1")).toBeNull(); // NaN chapter
    expect(parseVerseKey("foo")).toBeNull(); // < 2 parts
    expect(parseVerseKey("")).toBeNull();
    expect(parseVerseKey(null)).toBeNull();
  });
});

describe("shortRef (ground truth)", () => {
  it("uppercases the book id, no name lookup", () => {
    expect(shortRef("jhn.3.16")).toBe("JHN 3:16");
    expect(shortRef("gen.1")).toBe("GEN 1");
  });
});

describe("formatRef (book-name lookup via CODEX_DATA)", () => {
  it("renders Book C:V / Book C", () => {
    expect(formatRef("jhn.3.16")).toBe("John 3:16");
    expect(formatRef("gen.1")).toBe("Genesis 1");
  });
  it("falls back to the raw book id when unknown, and to the key when unparseable", () => {
    expect(formatRef("xxx.1.1")).toBe("xxx 1:1");
    expect(formatRef("notakey")).toBe("notakey");
  });
});

describe("normalizeKey (key OR human ref → key)", () => {
  it("passes through a key shape", () => {
    expect(normalizeKey("gen.1.1")).toBe("gen.1.1");
    expect(normalizeKey("gen.1")).toBe("gen.1");
  });
  it("resolves a human ref by name or id", () => {
    expect(normalizeKey("Genesis 1:1")).toBe("gen.1.1");
    expect(normalizeKey("1 Corinthians 13:4")).toBe("1co.13.4");
    expect(normalizeKey("John 3")).toBe("jhn.3");
  });
  it("returns null for an unknown book", () => {
    expect(normalizeKey("Nonesuch 1:1")).toBeNull();
    expect(normalizeKey("")).toBeNull();
  });
});

describe("bookMeta (canonical index + testament)", () => {
  it("returns the index and testament", () => {
    expect(bookMeta("jhn")).toEqual({ index: 0, testament: "NT" });
    expect(bookMeta("gen")).toEqual({ index: 1, testament: "OT" });
  });
  it("returns -1 / null for an unknown id", () => {
    expect(bookMeta("zzz")).toEqual({ index: -1, testament: null });
  });
});

describe("rgba (ground truth)", () => {
  it("expands hex to rgba", () => {
    expect(rgba("#7ee0ff", 0.26)).toBe("rgba(126,224,255,0.26)");
    expect(rgba("#e8b465", 0.9)).toBe("rgba(232,180,101,0.9)");
    expect(rgba("fff", 1)).toBe("rgba(255,255,255,1)");
  });
  it("falls back to cyan when hex is empty or invalid", () => {
    expect(rgba(null, 0.5)).toBe("rgba(126,224,255,0.5)");
    expect(rgba("zzz", 1)).toBe("rgba(126,224,255,1)");
  });
});

describe("themeColor (ground truth, deterministic hash)", () => {
  it("maps a theme to a stable hue", () => {
    expect(themeColor("love")).toBe("#b3a4ff");
    expect(themeColor("mercy")).toBe("#7ee0ff");
    expect(themeColor("covenant")).toBe("#ff9db1");
  });
});

describe("chapterVerses (shape tolerance)", () => {
  it("accepts a bare array, a {verses} wrapper, and degrades to []", () => {
    expect(chapterVerses([{ n: 1 }])).toEqual([{ n: 1 }]);
    expect(chapterVerses({ verses: [{ n: 2 }] })).toEqual([{ n: 2 }]);
    expect(chapterVerses(null)).toEqual([]);
    expect(chapterVerses({})).toEqual([]);
  });
});

describe("snippetFor (window.BIBLE cache)", () => {
  it("pulls + trims the cached verse text for the translation", () => {
    tw().BIBLE = {
      getCachedChapter: () => [{ n: 16, kjv: "For God so loved the world  " }],
    };
    expect(snippetFor("jhn.3.16", "kjv")).toBe("For God so loved the world");
  });
  it("returns null when the cache is unavailable", () => {
    expect(snippetFor("jhn.3.16", "kjv")).toBeNull();
  });
});
