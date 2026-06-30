import { describe, it, expect } from "vitest";
import { tokenize, parseQuery, prettyRef, snippet, createSearchIndex } from "./search.js";

describe("tokenize", () => {
  it("lowercases, normalizes quotes, strips punctuation, keeps *", () => {
    expect(tokenize("In the Beginning, God’s love*")).toEqual(["in", "the", "beginning", "god's", "love*"]);
  });
});

describe("parseQuery", () => {
  it("separates tokens, wildcards, phrases, and @translation", () => {
    expect(parseQuery('@KJV "in the beginning" love begin*')).toEqual({
      translation: "kjv",
      phrases: ["in the beginning"],
      tokens: ["love"],
      wildcards: ["begin"],
    });
  });
});

describe("prettyRef", () => {
  it("resolves the book name and builds a label", () => {
    expect(prettyRef("jhn.3.16")).toMatchObject({
      bookName: "John",
      bookId: "jhn",
      chapter: 3,
      verse: 16,
      label: "John 3:16",
    });
  });
});

describe("snippet", () => {
  it("wraps the matched term in <mark> and escapes HTML", () => {
    const out = snippet("For God so loved the world", ["loved"]);
    expect(out).toContain("<mark>loved</mark>");
    // no hit → head is returned, HTML-escaped (no <mark>)
    expect(snippet("a <b> & c", ["zzz"])).toBe("a &lt;b&gt; &amp; c");
  });
});

describe("createSearchIndex", () => {
  function seeded() {
    const idx = createSearchIndex();
    idx.index("kjv", {
      "jhn.3": [
        { n: 16, text: "For God so loved the world" },
        { n: 17, text: "For God sent not his Son to condemn the world" },
      ],
      "1co.13": [{ n: 4, text: "Charity suffereth long, and is kind" }],
    });
    idx.index("web", { "jhn.3": [{ n: 16, text: "For God so loved the world" }] });
    return idx;
  }

  it("finds verses by token and ranks phrase matches high", () => {
    const idx = seeded();
    const r = idx.search("loved world");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.ref).toBe("jhn.3.16"); // both tokens + contiguity bonus
    expect(r[0]?.snippet).toContain("<mark>");
  });

  it("supports phrase, wildcard, and @translation filters", () => {
    const idx = seeded();
    expect(idx.search('"so loved"').every((x) => x.text.toLowerCase().includes("so loved"))).toBe(true);
    expect(idx.search("condemn*").map((x) => x.ref)).toContain("jhn.3.17");
    expect(idx.search("@web loved").every((x) => x.translation === "web")).toBe(true);
  });

  it("weights recent translations and reports stats", () => {
    const idx = seeded();
    const withRecent = idx.search("loved", { recent: new Set(["web"]) });
    expect(withRecent[0]?.translation).toBe("web");
    expect(idx.stats()).toMatchObject({ verses: 4, built: true });
    expect(idx.stats().translationList.sort()).toEqual(["kjv", "web"]);
  });

  it("dedupes and clears", () => {
    const idx = seeded();
    idx.index("kjv", { "jhn.3": [{ n: 16, text: "For God so loved the world" }] }); // dup
    expect(idx.stats().verses).toBe(4);
    idx.clear();
    expect(idx.stats().verses).toBe(0);
    expect(idx.search("loved")).toEqual([]);
  });
});
