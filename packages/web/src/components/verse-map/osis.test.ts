import { describe, it, expect } from "vitest";
import { mapResolveBook, osisDisplay } from "./osis.js";

describe("mapResolveBook", () => {
  it("resolves a book id from @codex/core", () => {
    expect(mapResolveBook("gen")?.name).toBe("Genesis");
    expect(mapResolveBook("JHN")?.name).toBe("John");
  });
  it("returns null for an unknown id", () => {
    expect(mapResolveBook("zzz")).toBeNull();
  });
});

describe("osisDisplay", () => {
  it("formats book.chapter.verse", () => {
    expect(osisDisplay("gen.11.31")).toBe("Genesis 11:31");
  });
  it("formats book.chapter and book-only", () => {
    expect(osisDisplay("jhn.1")).toBe("John 1");
    expect(osisDisplay("gen")).toBe("Genesis");
  });
  it("uses the first ref of a range and uppercases unknown books", () => {
    expect(osisDisplay("gen.11.31-32")).toBe("Genesis 11:31");
    expect(osisDisplay("zzz.1.1")).toBe("ZZZ 1:1");
  });
});
