// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PassageGuide } from "./PassageGuide.js";
import type { Guide } from "./json.js";

// The runner's global localStorage shim is broken; stub a real in-memory one.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

const cachedGuide: Guide = {
  _schema: 1,
  overview: "The overview sentence.",
  outline: [{ title: "First section", range: "1-5", summary: "Stuff happens here." }],
  themes: [{ name: "Grace", verse_anchor: 3 }],
  key_words: [{ word: "love", original: "ἀγάπη", translit: "agape", verse_anchor: 16, strongs: "G26" }],
  historical_context: "Some historical context.",
  synthesis: "A synthesis paragraph.",
  _provider: "anthropic",
  _model: "claude",
};

describe("PassageGuide", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
  });

  it("renders the empty state with no chapter open", () => {
    render(<PassageGuide />);
    expect(screen.getByText("Open a chapter to see its Passage Guide.")).toBeTruthy();
  });

  it("renders a cached guide: hero, overview, sections, provider, footer", () => {
    localStorage.setItem("codex.passage-guide.gen.3", JSON.stringify({ _v: 1, data: cachedGuide, fetchedAt: Date.now() }));
    render(<PassageGuide book="Genesis" bookId="gen" chapter={3} />);

    // hero title (appears in both meta + h2) and overview
    expect(screen.getAllByText("Genesis 3").length).toBeGreaterThan(0);
    expect(screen.getByText("The overview sentence.")).toBeTruthy();
    // provider chip
    expect(screen.getByText("via anthropic")).toBeTruthy();
    // section content
    expect(screen.getByText("First section")).toBeTruthy();
    expect(screen.getByText("Grace")).toBeTruthy();
    expect(screen.getByText("love")).toBeTruthy();
    expect(screen.getByText("A synthesis paragraph.")).toBeTruthy();
    // footer
    expect(screen.getByText(/CODEX Passage Guide/)).toBeTruthy();
    // a collapsible section header
    expect(screen.getByText("Outline")).toBeTruthy();
  });

  it("collapses a section when its header is clicked", () => {
    localStorage.setItem("codex.passage-guide.gen.3", JSON.stringify({ _v: 1, data: cachedGuide, fetchedAt: Date.now() }));
    render(<PassageGuide book="Genesis" bookId="gen" chapter={3} />);
    expect(screen.getByText("First section")).toBeTruthy();
    fireEvent.click(screen.getByText("Outline"));
    expect(screen.queryByText("First section")).toBeNull();
  });
});
