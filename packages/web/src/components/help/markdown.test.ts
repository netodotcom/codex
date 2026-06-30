import { describe, it, expect } from "vitest";
import { escapeHtml, inlineMd, renderMarkdown, makeSnippet } from "./markdown.js";

// Ground truth captured by running the verbatim legacy functions in node.

describe("escapeHtml (ground truth)", () => {
  it("escapes &, <, >, \" and '", () => {
    expect(escapeHtml(`<a href="x">"hi" & 'bye'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&quot;hi&quot; &amp; &#39;bye&#39;&lt;/a&gt;"
    );
  });
});

describe("inlineMd (ground truth)", () => {
  it("renders inline code spans", () => {
    expect(inlineMd("use `npm run build` now")).toBe("use <code>npm run build</code> now");
  });
  it("renders bold then italic", () => {
    expect(inlineMd("a **bold** and *italic* word")).toBe("a <strong>bold</strong> and <em>italic</em> word");
  });
  it("renders a safe link", () => {
    expect(inlineMd("see [docs](https://x.io/a)")).toBe(
      'see <a href="https://x.io/a" target="_blank" rel="noopener noreferrer">docs</a>'
    );
  });
  it("strips javascript: links to plain text (preserving the quirk leftover paren)", () => {
    expect(inlineMd("evil [click](javascript:alert(1))")).toBe("evil click)");
  });
  it("strips data: links to plain text", () => {
    expect(inlineMd("evil [click](data:text/html,x)")).toBe("evil click");
  });
});

describe("renderMarkdown (ground truth)", () => {
  it("renders headings, paragraphs, lists, quotes, and a fenced code block", () => {
    const input = "# Title\n\nIntro para line one\ncontinues.\n\n## Section\n\n- one\n- two\n\n1. first\n2. second\n\n> a quote line\n\n```js\nconst x = 1;\n<tag>\n```\n\ndone `c`";
    const expected =
      "<h1>Title</h1>\n" +
      "<p>Intro para line one continues.</p>\n" +
      "<h2>Section</h2>\n" +
      "<ul><li>one</li><li>two</li></ul>\n" +
      "<ol><li>first</li><li>second</li></ol>\n" +
      '<blockquote class="cx-help-quote">a quote line</blockquote>\n' +
      '<div class="cx-help-code"><button class="cx-help-code-copy" data-copy="const x = 1;\n&lt;tag&gt;" aria-label="Copy code">⎘ copy</button><pre><code>const x = 1;\n&lt;tag&gt;</code></pre></div>\n' +
      "<p>done <code>c</code></p>";
    expect(renderMarkdown(input)).toBe(expected);
  });
  it("returns empty string for empty / null input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown(null)).toBe("");
    expect(renderMarkdown(undefined)).toBe("");
  });
});

describe("makeSnippet (ground truth)", () => {
  it("strips markdown noise when there is no query", () => {
    expect(makeSnippet("# Heading\nSome **body** text here with `code` and more words", "")).toBe(
      "Heading Some body text here with code and more words"
    );
  });
  it("wraps the first match in a highlight span", () => {
    expect(
      makeSnippet("The quick brown fox jumps over the lazy dog and keeps running far away into the night beyond", "lazy")
    ).toBe(
      'The quick brown fox jumps over the <span class="cx-help-hl">lazy</span> dog and keeps running far away into the night beyond'
    );
  });
  it("truncates at max with an ellipsis when there is no hit", () => {
    expect(makeSnippet("x".repeat(200), "zzz")).toBe("x".repeat(140) + "…");
  });
});
