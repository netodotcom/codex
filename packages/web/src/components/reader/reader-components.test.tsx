// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VerseRow } from "./VerseRow.js";
import { MarkRow } from "./MarkRow.js";
import { Reader } from "./Reader.js";
import { StatusBar } from "./StatusBar.js";
import { computeSolar } from "./solar.js";
import type { Verse, Passage } from "./types.js";

const CODEX_DATA = {
  translations: [
    { id: "kjv", name: "King James", glyph: "K", year: 1611, lang: "EN", license: "PD" },
    { id: "vul", name: "Vulgate", glyph: "V", year: 405, lang: "LA", license: "PD" },
  ],
  books: [{ id: "john", name: "John", chapters: 21, testament: "NT" }],
};

beforeEach(() => {
  (window as unknown as { CODEX_DATA?: unknown }).CODEX_DATA = CODEX_DATA;
});

describe("VerseRow", () => {
  it("renders the verse number, text, and toggles the highlight on the gutter star", () => {
    const v: Verse = { n: 3, kjv: "For God so loved the world" };
    const onToggle = vi.fn();
    render(
      <VerseRow
        v={v}
        isHl={false}
        isLatin={false}
        text="For God so loved the world"
        redLetter={false}
        primary="kjv"
        onSelectVerse={() => {}}
        onToggleHighlight={onToggle}
      />,
    );
    expect(screen.getByText("For God so loved the world")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Highlight verse"));
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it("paints red-letter quotes when redLetter is on", () => {
    const v: Verse = { n: 5, kjv: "And Jesus said Follow me now", red: { kjv: ["Follow me now"] } };
    const { container } = render(
      <VerseRow v={v} isHl={false} isLatin={false} text="And Jesus said Follow me now" redLetter primary="kjv" onSelectVerse={() => {}} />,
    );
    expect(container.querySelector(".cx-red")?.textContent).toBe("Follow me now");
  });
});

describe("MarkRow", () => {
  it("renders the ref, a swatch, and fires clear/pin", () => {
    const mark = { key: "john.3.16", ref: "John 3:16", color: "gold", text: "loved" };
    const onClear = vi.fn();
    const onPin = vi.fn();
    render(<MarkRow mark={mark} onSelect={() => {}} onClear={onClear} onTogglePin={onPin} swatch="#ffd700" />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove mark"));
    expect(onClear).toHaveBeenCalledWith(mark);
    fireEvent.click(screen.getByLabelText("Pin mark"));
    expect(onPin).toHaveBeenCalledWith(mark);
  });
});

describe("Reader", () => {
  const passage: Passage = {
    book: "John",
    bookId: "john",
    chapter: 1,
    verses: [
      { n: 1, kjv: "In the beginning was the Word" },
      { n: 2, kjv: "The same was in the beginning with God" },
    ],
  };

  it("renders the chapter title, verses, and pager position", () => {
    render(
      <Reader
        passage={passage}
        primary="kjv"
        compareTranslations={[]}
        sideBySide={false}
        gnosisOn={false}
        redLetter={false}
        fontScale={22}
        onSelectVerse={() => {}}
      />,
    );
    expect(screen.getByText("John 1")).toBeTruthy();
    expect(screen.getByText("In the beginning was the Word")).toBeTruthy();
    expect(screen.getByText(/1 of 21/)).toBeTruthy();
  });

  it("shows the loading state while the passage is in flight", () => {
    render(
      <Reader
        passage={{ ...passage, loading: true, verses: [] }}
        primary="kjv"
        compareTranslations={[]}
        sideBySide={false}
        gnosisOn={false}
        redLetter={false}
        fontScale={22}
        onSelectVerse={() => {}}
      />,
    );
    expect(screen.getByText(/RETRIEVING/)).toBeTruthy();
  });
});

describe("StatusBar", () => {
  it("renders the clock, bookmark count, and logo", () => {
    const now = new Date(2024, 0, 1, 9, 5, 0);
    render(
      <StatusBar now={now} solar={computeSolar(9)} dark={false} autoTheme={false} onToggleTheme={() => {}} onToggleAuto={() => {}} bookmarkCount={7} />,
    );
    expect(screen.getByText("09:05:00")).toBeTruthy();
    expect(screen.getByText("07")).toBeTruthy(); // pad(7)
    expect(screen.getAllByText(/CODEX/).length).toBeGreaterThan(0);
  });
});
