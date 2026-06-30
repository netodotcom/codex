// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CxrText } from "./CxrText.js";
import { CxrGloss, type GlossItem } from "./CxrGloss.js";
import { CxrSpawn } from "./CxrSpawn.js";
import { CodexReaderX } from "./CodexReaderX.js";
import type { SoulWindow } from "./soul-window.js";

function win(): SoulWindow {
  return window as unknown as SoulWindow;
}

// jsdom under vitest ships a non-functional localStorage; stub a real in-memory
// Storage (the repo-wide pattern).
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

const CODEX_DATA = {
  translations: [
    { id: "web", name: "World English Bible", year: 2000, canons: ["protestant"], license: "PD" },
    { id: "kjv", name: "King James", year: 1611, canons: ["protestant"] },
  ],
  books: [{ id: "jhn", name: "John", chapters: 21, testament: "NT" }],
};

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  win().CODEX_DATA = CODEX_DATA;
  win().BIBLE = undefined;
  win().CODEX_NOW = undefined;
  win().CODEX_PANELS = undefined;
  win().codexNewReader = undefined;
});

describe("CxrText", () => {
  it("renders plain text when gold is off", () => {
    const { container } = render(<CxrText text="the LORD God" gold={{ on: false, hebrew: false }} />);
    expect(screen.getByText("the LORD God")).toBeTruthy();
    expect(container.querySelector(".cxr-name")).toBeNull();
  });

  it("gilds the Name when gold is on", () => {
    const { container } = render(<CxrText text="the LORD God" gold={{ on: true }} />);
    const names = Array.from(container.querySelectorAll(".cxr-name")).map((n) => n.textContent);
    expect(names).toEqual(["LORD", "God"]);
  });

  it("substitutes יהוה for the Tetragrammaton when hebrew is on", () => {
    const { container } = render(<CxrText text="the LORD" gold={{ on: true, hebrew: true }} />);
    const yhwh = container.querySelector(".cxr-name-yhwh");
    expect(yhwh?.textContent).toBe("יהוה");
  });
});

describe("CxrGloss", () => {
  const g: GlossItem = { ov: "gnosis", e: { title: "The Logos", body: "Esoteric reading here" }, key: "gnosis.0" };

  it("shows the head collapsed and reveals the body on toggle", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CxrGloss g={g} open={false} onToggle={onToggle} />);
    expect(screen.getByText("The Logos")).toBeTruthy();
    expect(screen.queryByText("Esoteric reading here")).toBeNull();

    fireEvent.click(screen.getByText("The Logos"));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<CxrGloss g={g} open={true} onToggle={onToggle} />);
    expect(screen.getByText("Esoteric reading here")).toBeTruthy();
  });
});

describe("CxrSpawn", () => {
  it("opens the spawn menu and fires codexNewReader", () => {
    const newReader = vi.fn();
    win().codexNewReader = newReader;
    render(<CxrSpawn />);
    fireEvent.click(screen.getByLabelText("Open another reader"));
    fireEvent.click(screen.getByText("⧉ NEW READER WINDOW"));
    expect(newReader).toHaveBeenCalledTimes(1);
  });
});

describe("CodexReaderX", () => {
  beforeEach(() => {
    win().BIBLE = {
      loadMulti: vi.fn(async (_bookId: string, chapter: number) =>
        chapter === 1
          ? [
              { n: 1, web: "In the beginning was the Word" },
              { n: 2, web: "The same was in the beginning" },
            ]
          : [{ n: 1, web: "Chapter two verse one" }]),
    };
  });

  it("renders the chapter title, the verses, the translation chip and RED-LETTER label", async () => {
    render(<CodexReaderX independent initialNow={{ bookId: "jhn", book: "John", chapter: 1, verse: 1 }} />);
    expect(await screen.findByText("In the beginning was the Word")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("John 1");
    expect(screen.getByText("WEB")).toBeTruthy();
    expect(screen.getByText("RED-LETTER")).toBeTruthy();
  });

  it("turns the page on the Next chapter button (independent reader)", async () => {
    render(<CodexReaderX independent initialNow={{ bookId: "jhn", book: "John", chapter: 1, verse: 1 }} />);
    await screen.findByText("In the beginning was the Word");
    fireEvent.click(screen.getByLabelText("Next chapter"));
    expect(await screen.findByText("Chapter two verse one")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("John 2");
  });

  it("shows the dark-page error when every source fails", async () => {
    win().BIBLE = { loadMulti: vi.fn(async () => { throw new Error("boom"); }) };
    render(<CodexReaderX independent initialNow={{ bookId: "jhn", book: "John", chapter: 1, verse: 1 }} />);
    expect(await screen.findByText("THE PAGE IS DARK")).toBeTruthy();
  });
});
