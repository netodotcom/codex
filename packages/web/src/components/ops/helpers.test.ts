// ops/helpers — pure-logic unit tests. Ground-truth values were verified by
// running a faithful copy of the originals (ops.jsx regex, copyArtifact md
// template) in node before asserting.
import { describe, it, expect } from "vitest";
import { parseArtifactBody } from "./helpers.js";
import { artifactToMarkdown } from "./helpers.js";
import type { OpsArtifact } from "./ops-window.js";

describe("parseArtifactBody (ground truth)", () => {
  it("returns an empty array for an empty string", () => {
    expect(parseArtifactBody("")).toEqual([]);
  });

  it("returns a single text part when there are no refs", () => {
    expect(parseArtifactBody("no references here")).toEqual([
      { t: "text", v: "no references here" },
    ]);
  });

  it("finds a simple Book Chapter:Verse reference", () => {
    expect(parseArtifactBody("See John 3:16 today")).toEqual([
      { t: "text", v: "See " },
      { t: "ref", v: "John 3:16" },
      { t: "text", v: " today" },
    ]);
  });

  it("handles a numbered book prefix (1 Kings 19:1)", () => {
    const parts = parseArtifactBody("1 Kings 19:1 describes Elijah");
    expect(parts[0]).toEqual({ t: "ref", v: "1 Kings 19:1" });
    expect(parts[1]).toEqual({ t: "text", v: " describes Elijah" });
  });

  it("handles 'Book of X' form (Song of Solomon 1:1)", () => {
    const parts = parseArtifactBody("Song of Solomon 1:1 is the first verse");
    expect(parts[0]).toEqual({ t: "ref", v: "Song of Solomon 1:1" });
  });

  it("handles verse ranges with hyphen (Romans 8:1-5)", () => {
    const parts = parseArtifactBody("Romans 8:1-5");
    expect(parts[0]).toEqual({ t: "ref", v: "Romans 8:1-5" });
  });

  it("parses multiple refs interspersed with text", () => {
    const parts = parseArtifactBody("From Genesis 1:1 through Revelation 22:21.");
    expect(parts).toEqual([
      { t: "text", v: "From " },
      { t: "ref", v: "Genesis 1:1" },
      { t: "text", v: " through " },
      { t: "ref", v: "Revelation 22:21" },
      { t: "text", v: "." },
    ]);
  });

  it("does not match lowercase book names", () => {
    const parts = parseArtifactBody("john 3:16");
    expect(parts).toEqual([{ t: "text", v: "john 3:16" }]);
  });
});

describe("artifactToMarkdown (ground truth)", () => {
  it("serialises title, summary, and sections faithfully", () => {
    const a: OpsArtifact = {
      title: "The Logos",
      summary: "A study of the word.",
      sections: [
        { heading: "Genesis", body: "In the beginning was the Word." },
        { heading: "John", body: "The Word became flesh." },
      ],
    };
    const md = artifactToMarkdown(a, "unused intent");
    expect(md).toBe(
      "# The Logos\n\nA study of the word.\n\n## Genesis\n\nIn the beginning was the Word.\n## John\n\nThe Word became flesh."
    );
  });

  it("falls back to intent when title is empty", () => {
    const a: OpsArtifact = { title: "", summary: "", sections: [] };
    const md = artifactToMarkdown(a, "my intent");
    expect(md.startsWith("# my intent")).toBe(true);
  });
});
