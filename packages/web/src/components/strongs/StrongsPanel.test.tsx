// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { StrongsPanel } from "./StrongsPanel.js";
import { _lex } from "./helpers.js";
import type { StrongsLexicon, AlignmentModule } from "./strongs-window.js";

interface PanelWindow {
  CODEX_MODULES?: { loadModule: () => Promise<never> };
}
const pw = (): PanelWindow => window as unknown as PanelWindow;

beforeEach(() => {
  // Keep ensureLoaded hanging so loading state persists during sync assertions.
  pw().CODEX_MODULES = { loadModule: () => new Promise<never>(() => {}) };
  // Reset shared _lex — tests that want data populate it explicitly.
  _lex.hebrew = null;
  _lex.greek = null;
  _lex.alignment = null;
});

describe("StrongsPanel", () => {
  it("renders the loading state when lexicons are not yet loaded", () => {
    // _lex all null → loading starts true; CODEX_MODULES never resolves → stays true.
    render(React.createElement(StrongsPanel, {}));
    // Use regex to match regardless of apostrophe code-point (U+0027 vs U+2019).
    expect(screen.getByText(/Loading Strong.s lexicons/)).toBeTruthy();
  });

  it("renders the panel body with search input when lexicons are populated", () => {
    _lex.hebrew = { entries: {} } as StrongsLexicon;
    _lex.greek = { entries: {} } as StrongsLexicon;
    _lex.alignment = { verses: {} } as AlignmentModule;

    render(React.createElement(StrongsPanel, { book: "John", chapter: 3, verse: 16 }));

    // Search input — found by its aria-label (immune to apostrophe encoding).
    expect(screen.getByLabelText(/Strong.s number lookup/)).toBeTruthy();
    // Verse heading.
    expect(screen.getByText("Words in John 3:16")).toBeTruthy();
    // No alignment → fallback message.
    expect(screen.getByText(/No alignment data for this verse yet/)).toBeTruthy();
  });

  it("renders word list from alignment data and shows entry detail on click", () => {
    _lex.hebrew = {
      entries: {
        H430: { word: "אֱלֹהִים", translit: "elohim", gloss: "God, gods", usage: 2606 },
      },
    } as StrongsLexicon;
    _lex.greek = { entries: {} } as StrongsLexicon;
    _lex.alignment = {
      verses: {
        "gen.1.1": [
          { en: "In the beginning", strongs: "H7225" },
          { en: "God", strongs: "H430" },
        ],
      },
    } as AlignmentModule;

    render(React.createElement(StrongsPanel, { book: "Gen", bookId: "gen", chapter: 1, verse: 1 }));

    // Word list items.
    expect(screen.getByText("God")).toBeTruthy();
    expect(screen.getByText("H430")).toBeTruthy();

    // Click a word — entry detail should appear.
    fireEvent.click(screen.getByText("H430"));
    // The Hebrew word and transliteration should now be visible.
    expect(screen.getByText("elohim")).toBeTruthy();
  });

  it("shows entry detail when user types a valid Strong's number", () => {
    _lex.greek = {
      entries: {
        G2316: { word: "θεός", translit: "theos", gloss: "God", usage: 1317 },
      },
    } as StrongsLexicon;
    _lex.hebrew = { entries: {} } as StrongsLexicon;
    _lex.alignment = { verses: {} } as AlignmentModule;

    render(React.createElement(StrongsPanel, {}));

    const input = screen.getByLabelText(/Strong.s number lookup/);
    fireEvent.change(input, { target: { value: "G2316" } });

    expect(screen.getByText("theos")).toBeTruthy();
    expect(screen.getByText("G2316")).toBeTruthy();
  });

  it("shows 'no entry' note for an unrecognised lookup", () => {
    _lex.hebrew = { entries: {} } as StrongsLexicon;
    _lex.greek = { entries: {} } as StrongsLexicon;
    _lex.alignment = { verses: {} } as AlignmentModule;

    render(React.createElement(StrongsPanel, {}));

    const input = screen.getByLabelText(/Strong.s number lookup/);
    fireEvent.change(input, { target: { value: "H9999" } });

    expect(screen.getByText(/No entry for H9999 in the starter lexicon/)).toBeTruthy();
  });
});
