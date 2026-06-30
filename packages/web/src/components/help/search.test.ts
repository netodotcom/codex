import { describe, it, expect } from "vitest";
import { scoreArticle } from "./search.js";
import type { Article } from "./data.js";

// Ground truth captured by running the verbatim legacy scoreArticle in node
// (8-language fallback, empty translation cache — matching this env).
const A: Article = {
  id: "a1",
  title: "Reading Modes",
  category: "Reading",
  tags: ["theme", "serif"],
  body: "Switch between reading modes and serif themes easily.",
};

describe("scoreArticle (ground truth)", () => {
  it("scores a title prefix highest", () => {
    expect(scoreArticle(A, "reading")).toBe(1279.25);
  });
  it("scores a mid-title substring with the word-boundary bonus", () => {
    expect(scoreArticle(A, "modes")).toBe(870.85);
  });
  it("scores a tag hit", () => {
    expect(scoreArticle(A, "serif")).toBe(372.35);
  });
  it("scores a body-only hit", () => {
    expect(scoreArticle(A, "switch")).toBe(80);
  });
  it("returns 0 for an empty query", () => {
    expect(scoreArticle(A, "")).toBe(0);
  });
  it("returns 0 when nothing matches", () => {
    expect(scoreArticle(A, "zzzzz")).toBe(0);
  });
});
