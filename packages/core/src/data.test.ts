import { describe, it, expect } from "vitest";
import {
  books,
  translations,
  seedPanels,
  defaultPassage,
  bookById,
  translationById,
} from "./data.js";

// These tests double as runtime validation of the JSON extracted from data.js.

describe("books", () => {
  it("has the expected canon counts (39 OT + 27 NT + 35 DC = 101)", () => {
    expect(books.length).toBe(101);
    expect(books.filter((b) => b.testament === "OT").length).toBe(39);
    expect(books.filter((b) => b.testament === "NT").length).toBe(27);
    expect(books.filter((b) => b.testament === "DC").length).toBe(35);
  });

  it("has unique ids and positive chapter counts", () => {
    const ids = books.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(books.every((b) => b.chapters > 0)).toBe(true);
  });

  it("looks up a book by id", () => {
    expect(bookById("jhn")).toMatchObject({ name: "John", testament: "NT", chapters: 21 });
    expect(bookById("nope")).toBeUndefined();
  });
});

describe("translations", () => {
  it("registers 42 translations with unique ids and required fields", () => {
    expect(translations.length).toBe(42);
    const ids = translations.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(translations.every((t) => t.id && t.name && t.source && t.apiId)).toBe(true);
  });

  it("looks up KJV (bible-api source)", () => {
    expect(translationById("kjv")).toMatchObject({ name: "King James", source: "bible-api" });
  });
});

describe("defaultPassage", () => {
  it("points at a real book", () => {
    expect(bookById(defaultPassage.bookId)).toBeDefined();
    expect(defaultPassage).toEqual({ bookId: "jhn", chapter: 1 });
  });
});

describe("seedPanels", () => {
  it("ships warm content for John 1", () => {
    const p = seedPanels["jhn.1"];
    expect(p).toBeDefined();
    expect(p?.title).toContain("Prologue");
    const logos = p?.gematria?.find((g) => g.term === "λόγος");
    expect(logos?.value).toBe(373);
  });
});
