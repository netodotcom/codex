// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { VerseCompare } from "./VerseCompare.js";
import type { VerseCompareWindow } from "./verse-compare-window.js";

const W = (): VerseCompareWindow => window as unknown as VerseCompareWindow;

const TRANSLATIONS = [
  { id: "kjv", name: "King James Version", glyph: "K", year: 1611, lang: "en" },
  { id: "web", name: "World English Bible", glyph: "W", year: 2000, lang: "en" },
];

const PASSAGE = { bookId: "jhn", chapter: 3, book: "John" };

beforeEach(() => {
  W().CODEX_DATA = { translations: TRANSLATIONS };
  // Hold chapters in a permanent loading state: never resolves, so we avoid
  // the async BIBLE path and can test the component synchronously.
  W().BIBLE = { loadChapter: () => new Promise<never>(() => {}) };
});

describe("VerseCompare", () => {
  it("renders the CODEX · COMPARE header tag", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 16 }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("CODEX · COMPARE")).toBeTruthy();
  });

  it("renders the passage reference in the header", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 16 }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/John 3:16/)).toBeTruthy();
  });

  it("renders a column header for each selected translation", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("King James Version")).toBeTruthy();
    expect(screen.getByText("World English Bible")).toBeTruthy();
  });

  it("shows the loading indicator while chapters are pending", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {}}
      />,
    );
    const loadingCells = screen.getAllByText("loading…");
    expect(loadingCells.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose when the close button is clicked", () => {
    let closed = false;
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(closed).toBe(true);
  });

  it("calls onClose when the ESC key is pressed", () => {
    let closed = false;
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });

  it("calls onClose when the backdrop is clicked", () => {
    let closed = false;
    const { container } = render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const backdrop = container.querySelector(".cx-cmp-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(closed).toBe(true);
  });

  it("shows the translation picker when the dropdown button is clicked", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        verse={{ n: 1 }}
        onClose={() => {}}
      />,
    );
    // Initially the picker menu is hidden
    expect(screen.queryByText("SHOW · TRANSLATIONS")).toBeNull();
    // Click the translations count button to open the picker
    fireEvent.click(screen.getByTitle("Choose which translations to include"));
    expect(screen.getByText("SHOW · TRANSLATIONS")).toBeTruthy();
  });

  it("falls back to verse 1 when verse prop is omitted", () => {
    render(
      <VerseCompare
        passage={PASSAGE}
        primary="kjv"
        onClose={() => {}}
      />,
    );
    // Should show "John 3:1"
    expect(screen.getByText(/John 3:1/)).toBeTruthy();
  });
});
