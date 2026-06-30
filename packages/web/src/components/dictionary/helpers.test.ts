// @vitest-environment jsdom
// dictionary — ground-truth tests for pure helpers.
// Window globals are needed because booksList() / bookName() read CODEX_DATA.
import { describe, it, expect, beforeEach } from "vitest";
import {
  parseRefKey,
  formatRef,
  kindLabel,
  kindColor,
  entryMatchesQuery,
  booksList,
  bookName,
} from "./helpers.js";

interface TestWindow {
  CODEX_DATA?: { books?: Array<{ id: string; name: string }> };
}
const tw = (): TestWindow => window as unknown as TestWindow;

const BOOKS = [
  { id: "gen", name: "Genesis" },
  { id: "jhn", name: "John" },
  { id: "mat", name: "Matthew" },
];

beforeEach(() => {
  tw().CODEX_DATA = { books: BOOKS };
});

describe("parseRefKey (ground truth)", () => {
  it("parses book.chapter.verse", () => {
    expect(parseRefKey("gen.1.1")).toEqual({ bookId: "gen", chapter: 1, verse: 1 });
  });
  it("parses book.chapter only (verse = null)", () => {
    expect(parseRefKey("jhn.3")).toEqual({ bookId: "jhn", chapter: 3, verse: null });
  });
  it("lowercases the book id", () => {
    expect(parseRefKey("GEN.1.1")).toMatchObject({ bookId: "gen" });
  });
  it("returns null for fewer than 2 parts", () => {
    expect(parseRefKey("foo")).toBeNull();
  });
  it("returns null for null / empty", () => {
    expect(parseRefKey(null)).toBeNull();
    expect(parseRefKey("")).toBeNull();
  });
});

describe("formatRef (book-name lookup via CODEX_DATA)", () => {
  it("formats book.chapter.verse with book name", () => {
    expect(formatRef("gen.1.1")).toBe("Genesis 1:1");
    expect(formatRef("jhn.3")).toBe("John 3");
  });
  it("falls back to the raw book id when the book is unknown", () => {
    expect(formatRef("xxx.1.1")).toBe("xxx 1:1");
  });
  it("returns the raw key when it cannot be parsed", () => {
    expect(formatRef("notakey")).toBe("notakey");
  });
});

describe("booksList / bookName", () => {
  it("booksList returns the CODEX_DATA books array", () => {
    expect(booksList().length).toBe(3);
  });
  it("bookName resolves an id to its display name", () => {
    expect(bookName("gen")).toBe("Genesis");
    expect(bookName("jhn")).toBe("John");
  });
  it("bookName falls back to the id for unknown books", () => {
    expect(bookName("rev")).toBe("rev");
  });
});

describe("kindLabel (ground truth)", () => {
  it("uppercases the kind string", () => {
    expect(kindLabel("person")).toBe("PERSON");
    expect(kindLabel("place")).toBe("PLACE");
    expect(kindLabel("concept")).toBe("CONCEPT");
  });
  it("defaults to ENTRY when kind is absent or empty", () => {
    expect(kindLabel(null)).toBe("ENTRY");
    expect(kindLabel(undefined)).toBe("ENTRY");
    expect(kindLabel("")).toBe("ENTRY");
  });
});

describe("kindColor (ground truth)", () => {
  it("maps each known kind to its colour", () => {
    expect(kindColor("person")).toBe("#7ee0ff");
    expect(kindColor("place")).toBe("#ffc46b");
    expect(kindColor("concept")).toBe("#c8a8ff");
    expect(kindColor("people")).toBe("#9be39c");
  });
  it("uses the default colour for unknown kinds and null", () => {
    expect(kindColor(null)).toBe("#c9d4dc");
    expect(kindColor("other")).toBe("#c9d4dc");
    expect(kindColor(undefined)).toBe("#c9d4dc");
  });
});

describe("entryMatchesQuery (ground truth)", () => {
  const entry = {
    title: "Abraham",
    body: "Father of many nations.",
    related: ["Isaac", "Sarah"],
  };

  it("exact title match (case-insensitive) scores 1000", () => {
    expect(entryMatchesQuery("abraham", entry, "Abraham")).toBe(1000);
    expect(entryMatchesQuery("abraham", entry, "abraham")).toBe(1000);
  });

  it("prefix match scores ≥500 and <1000", () => {
    const s = entryMatchesQuery("abraham", entry, "Abr");
    expect(s).toBeGreaterThanOrEqual(500);
    expect(s).toBeLessThan(1000);
  });

  it("substring match scores 200", () => {
    expect(entryMatchesQuery("abraham", entry, "ham")).toBe(200);
  });

  it("related entry match scores 80", () => {
    expect(entryMatchesQuery("abraham", entry, "Isaac")).toBe(80);
  });

  it("body text match scores 20", () => {
    expect(entryMatchesQuery("abraham", entry, "nations")).toBe(20);
  });

  it("no match scores 0", () => {
    expect(entryMatchesQuery("abraham", entry, "Pharaoh")).toBe(0);
  });

  it("empty query always scores 0", () => {
    expect(entryMatchesQuery("abraham", entry, "")).toBe(0);
  });
});
