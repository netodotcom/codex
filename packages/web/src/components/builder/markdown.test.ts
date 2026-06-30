// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bookName, formatRef, studyToMarkdown, escapeHtml, mdInline, mdToHtml } from "./markdown.js";
import type { Study } from "./store.js";

type WinData = { CODEX_DATA?: { books?: Array<{ id?: string; name?: string }> } };
const setBooks = (books?: Array<{ id?: string; name?: string }>): void => {
  (window as unknown as WinData).CODEX_DATA = books ? { books } : undefined;
};

beforeEach(() => setBooks(undefined));
afterEach(() => setBooks(undefined));

describe("escapeHtml / mdInline (ground truth)", () => {
  it("escapes the five HTML-significant chars", () => {
    expect(escapeHtml(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });
  it("renders bold/italic and still escapes around them", () => {
    expect(mdInline("**bold** and *em* and <x> & y")).toBe("<strong>bold</strong> and <em>em</em> and &lt;x&gt; &amp; y");
  });
});

describe("bookName / formatRef (ground truth)", () => {
  it("formats refs with the raw id when CODEX_DATA is absent", () => {
    expect(formatRef("gen.1.1")).toBe("gen 1:1");
    expect(formatRef("gen.5")).toBe("gen 5");
  });
  it("returns the ref unchanged when there's no chapter", () => {
    expect(formatRef("gen")).toBe("gen");
  });
  it("returns '' for empty / non-string input", () => {
    expect(formatRef("")).toBe("");
    expect(formatRef(null)).toBe("");
    expect(formatRef(undefined)).toBe("");
  });
  it("resolves the friendly book name from CODEX_DATA when present", () => {
    setBooks([{ id: "gen", name: "Genesis" }]);
    expect(bookName("gen")).toBe("Genesis");
    expect(formatRef("gen.1.1")).toBe("Genesis 1:1");
    expect(formatRef("xyz.2.3")).toBe("xyz 2:3"); // unknown id → raw id
  });
});

describe("studyToMarkdown (ground truth)", () => {
  const study: Study = {
    id: "study-1",
    title: "My Study",
    created: 1,
    modified: 1,
    sections: [
      {
        id: "s1",
        heading: "I. Intro",
        items: [
          { type: "verse", ref: "gen.1.1", text: "  In the beginning  ", translation: "kjv" },
          { type: "note", body: "  a note  " },
        ],
      },
      {
        id: "s2",
        heading: "II. Body",
        items: [
          { type: "panel", kind: "Gematria", source: "gen.1.2", body: "value 913" },
          { type: "crossref", ref: "jhn.1.1", note: "echo" },
          { type: "crossref", ref: "rev.1", note: "" },
        ],
      },
    ],
  };

  it("returns '' for a null study", () => {
    expect(studyToMarkdown(null)).toBe("");
  });

  it("emits the exact legacy Markdown", () => {
    expect(studyToMarkdown(study)).toBe(
      "# My Study\n\n## I. Intro\n\n> **gen 1:1** *(KJV)*\n> In the beginning\n\na note\n\n\n## II. Body\n\n**Gematria — gen 1:2:** value 913\n\n- ↗ **jhn 1:1** — echo\n- ↗ **rev 1**\n",
    );
  });

  it("converts that Markdown to the exact legacy print HTML", () => {
    const md = studyToMarkdown(study);
    expect(mdToHtml(md)).toBe(
      "<h1>My Study</h1>\n\n<h2>I. Intro</h2>\n\n<blockquote>\n<div><strong>gen 1:1</strong> <em>(KJV)</em></div>\n<div>In the beginning</div>\n</blockquote>\n\n<p>a note</p>\n\n\n<h2>II. Body</h2>\n\n<p><strong>Gematria — gen 1:2:</strong> value 913</p>\n\n<ul>\n<li>↗ <strong>jhn 1:1</strong> — echo</li>\n<li>↗ <strong>rev 1</strong></li>\n</ul>\n",
    );
  });
});
