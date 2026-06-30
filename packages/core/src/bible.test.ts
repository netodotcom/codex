import { describe, it, expect } from "vitest";
import {
  chapterKey,
  resolveTranslation,
  bollsBookNumber,
  bibleApiSlug,
  bollsChapterUrl,
  bibleApiChapterUrl,
  cleanBollsText,
  cleanBibleApiText,
  parseBollsResponse,
  parseBibleApiResponse,
  sourceChain,
  createChapterLoader,
  type ChapterStore,
  type VerseRow,
} from "./bible.js";

function memChapterStore(): ChapterStore & { map: Map<string, VerseRow[]> } {
  const map = new Map<string, VerseRow[]>();
  return {
    map,
    async get(k) {
      return map.get(k);
    },
    async put(k, v) {
      map.set(k, v);
    },
  };
}

describe("book maps", () => {
  it("maps bookId to bolls number and bible-api slug", () => {
    expect(bollsBookNumber("jhn")).toBe(43);
    expect(bollsBookNumber("gen")).toBe(1);
    expect(bollsBookNumber("rev")).toBe(66);
    expect(bibleApiSlug("jhn")).toBe("john");
    expect(bibleApiSlug("1co")).toBe("1 corinthians");
    expect(bollsBookNumber("nope")).toBeUndefined();
  });
});

describe("chapterKey", () => {
  it("builds the cache key", () => {
    expect(chapterKey("jhn", 1, "kjv")).toBe("jhn.1.kjv");
  });
});

describe("resolveTranslation", () => {
  it("resolves known translations from the registry", () => {
    expect(resolveTranslation("kjv")).toEqual({ source: "bible-api", apiId: "kjv" });
    expect(resolveTranslation("esv")).toEqual({ source: "bolls", apiId: "ESV" });
  });
  it("falls back to bible-api for unknown ids", () => {
    expect(resolveTranslation("madeup")).toEqual({ source: "bible-api", apiId: "madeup" });
  });
});

describe("source URLs", () => {
  it("bolls chapter url", () => {
    expect(bollsChapterUrl("KJV", "jhn", 3)).toBe("https://bolls.life/get-text/KJV/43/3/");
  });
  it("bible-api chapter url", () => {
    expect(bibleApiChapterUrl("kjv", "jhn", 3)).toBe("https://bible-api.com/john+3?translation=kjv");
  });
  it("bible-api uses uppercase bookId for the Latin Clementine", () => {
    expect(bibleApiChapterUrl("clementine", "gen", 1)).toBe(
      "https://bible-api.com/GEN+1?translation=clementine",
    );
  });
  it("throws on an unknown book", () => {
    expect(() => bollsChapterUrl("KJV", "zzz", 1)).toThrow(/Unknown book/);
    expect(() => bibleApiChapterUrl("kjv", "zzz", 1)).toThrow(/Unknown book/);
  });
});

describe("text normalization", () => {
  it("cleanBollsText strips tags, glued + standalone Strong's, collapses space", () => {
    expect(cleanBollsText("<i>In</i>  the   beginning")).toBe("In the beginning");
    expect(cleanBollsText("love143 the")).toBe("love the"); // glued strong's
    expect(cleanBollsText("the 1234 word")).toBe("the word"); // standalone (2-5 digits)
    expect(cleanBollsText("chapter 1 verse")).toBe("chapter 1 verse"); // single digit kept
  });
  it("cleanBibleApiText just collapses whitespace", () => {
    expect(cleanBibleApiText("  a\n  b ")).toBe("a b");
  });
});

describe("response parsing", () => {
  it("parses a bolls response into {n,text}", () => {
    expect(parseBollsResponse([{ verse: 1, text: "<b>In</b> the beginning444" }])).toEqual([
      { n: 1, text: "In the beginning" },
    ]);
    expect(parseBollsResponse(null)).toEqual([]);
  });
  it("parses a bible-api response into {n,text}", () => {
    expect(parseBibleApiResponse({ verses: [{ verse: 1, text: "In the   beginning" }] })).toEqual([
      { n: 1, text: "In the beginning" },
    ]);
    expect(parseBibleApiResponse(null)).toEqual([]);
  });
});

describe("sourceChain", () => {
  it("puts the primary source first, then mirrors", () => {
    expect(
      sourceChain({ source: "bolls", apiId: "ESV", mirrors: [{ kind: "bible-api", apiId: "esv" }] }),
    ).toEqual([
      { kind: "bolls", apiId: "ESV" },
      { kind: "bible-api", apiId: "esv" },
    ]);
    expect(sourceChain(undefined)).toEqual([]);
  });
});

describe("createChapterLoader", () => {
  it("returns cached chapters without fetching", async () => {
    const store = memChapterStore();
    store.map.set("jhn.1.kjv", [{ n: 1, text: "cached" }]);
    let calls = 0;
    const loader = createChapterLoader({
      store,
      fetchJson: async () => {
        calls++;
        return {};
      },
    });
    expect(await loader.loadChapter("jhn", 1, "kjv")).toEqual([{ n: 1, text: "cached" }]);
    expect(calls).toBe(0);
  });

  it("fetches the primary source and caches the result", async () => {
    const store = memChapterStore();
    // kjv → primary bible-api, mirror bolls
    const loader = createChapterLoader({
      store,
      fetchJson: async (url) => {
        if (url.startsWith("https://bible-api.com")) return { verses: [{ verse: 1, text: "In the beginning" }] };
        throw new Error("unexpected " + url);
      },
    });
    const out = await loader.loadChapter("gen", 1, "kjv");
    expect(out).toEqual([{ n: 1, text: "In the beginning" }]);
    expect(store.map.get("gen.1.kjv")).toEqual(out);
  });

  it("falls back to a mirror when the primary source fails", async () => {
    const store = memChapterStore();
    const loader = createChapterLoader({
      store,
      fetchJson: async (url) => {
        if (url.startsWith("https://bible-api.com")) throw new Error("primary down");
        if (url.startsWith("https://bolls.life")) return [{ verse: 1, text: "mirror text" }];
        throw new Error("unexpected " + url);
      },
    });
    expect(await loader.loadChapter("gen", 1, "kjv")).toEqual([{ n: 1, text: "mirror text" }]);
  });

  it("throws for a translation with no registered source", async () => {
    const loader = createChapterLoader({ store: memChapterStore(), fetchJson: async () => ({}) });
    await expect(loader.loadChapter("gen", 1, "nope")).rejects.toThrow(/No source/);
  });

  it("dedupes concurrent loads of the same chapter", async () => {
    const store = memChapterStore();
    let calls = 0;
    const loader = createChapterLoader({
      store,
      fetchJson: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return { verses: [{ verse: 1, text: "x" }] };
      },
    });
    const [a, b] = await Promise.all([loader.loadChapter("gen", 1, "kjv"), loader.loadChapter("gen", 1, "kjv")]);
    expect(a).toEqual(b);
    expect(calls).toBe(1);
  });
});
