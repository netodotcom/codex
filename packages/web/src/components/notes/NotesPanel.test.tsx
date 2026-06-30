// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import * as ReactDOM from "react-dom";
import { Notes } from "./NotesPanel.js";
import type { NotesWindow } from "./notes-window.js";
import { NOTES_VIS, NOTES_LIST_OP, NOTES_KEY } from "./helpers.js";
import type { SavedNote } from "./helpers.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function W(): NotesWindow {
  return window as unknown as NotesWindow;
}

function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  // Provide CDN ReactDOM via window boundary — matches runtime behaviour.
  W().ReactDOM = {
    createPortal: ReactDOM.createPortal,
  };
});

// ── Notes — main render ──────────────────────────────────────────────────────

describe("Notes", () => {
  it("renders the panel into document.body as a portal", () => {
    render(<Notes />);
    // The <aside role="complementary"> lands in document.body (portal target).
    expect(screen.getByRole("complementary")).toBeTruthy();
    // Header contains the ✎ glyph + i18n key (window.t absent in tests → key returned)
    expect(document.querySelector(".cx-notes-h-tag")).toBeTruthy();
  });

  it("returns null when ReactDOM is not available on window", () => {
    W().ReactDOM = undefined;
    render(<Notes />);
    expect(document.querySelector(".cx-notes")).toBeNull();
  });

  it("returns null when visible is persisted as '0'", () => {
    localStorage.setItem(NOTES_VIS, "0");
    render(<Notes />);
    expect(document.querySelector(".cx-notes")).toBeNull();
  });

  it("renders the SAVE button and PIN button in the toolbar", () => {
    render(<Notes />);
    // Without window.t, ntx("notes.save") returns "notes.save" (the key itself),
    // so the || "SAVE" fallback is never reached. Check by class instead.
    expect(document.querySelector(".cx-notes-save")).toBeTruthy();
    expect(document.querySelector(".cx-notes-pin")).toBeTruthy();
  });

  it("renders the saved-notes toggle with count", () => {
    render(<Notes />);
    // List toggle button is present; the count span lives beside the arrow.
    expect(document.querySelector(".cx-notes-listtoggle")).toBeTruthy();
    // Count "0" is always rendered as a text node
    expect(document.querySelector(".cx-notes-listtoggle-arr")).toBeTruthy();
  });

  it("shows the saved-notes list when listOpen is true", () => {
    localStorage.setItem(NOTES_LIST_OP, "1");
    render(<Notes />);
    // Empty state: cx-notes-empty li is present (text is i18n key in tests)
    expect(document.querySelector(".cx-notes-empty")).toBeTruthy();
  });

  it("renders a pre-existing note when list is open", () => {
    const note: SavedNote = { id: "n_test", text: "Genesis insight", ref: "Gen 1:1", ts: Date.now() - 70_000 };
    localStorage.setItem(NOTES_KEY, JSON.stringify([note]));
    localStorage.setItem(NOTES_LIST_OP, "1");
    render(<Notes />);
    expect(screen.getByText("Genesis insight")).toBeTruthy();
    expect(screen.getByText("Gen 1:1")).toBeTruthy();
  });

  it("hides when the close button is clicked", () => {
    render(<Notes />);
    const closeBtn = screen.getByRole("button", { name: /Close notes/ });
    act(() => { fireEvent.click(closeBtn); });
    expect(document.querySelector(".cx-notes")).toBeNull();
  });

  it("fires onDisable when the close button is clicked", () => {
    let called = false;
    render(<Notes onDisable={() => { called = true; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Close notes/ }));
    expect(called).toBe(true);
  });

  it("shows currentRef in the header when passage and currentVerse are provided", () => {
    render(<Notes passage={{ book: "John", chapter: 3 }} currentVerse={16} />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("opens the format popup when ⋯ is clicked", () => {
    render(<Notes />);
    const fmtBtn = screen.getByRole("button", { name: /Format and export/ });
    act(() => { fireEvent.click(fmtBtn); });
    expect(screen.getByText("FORMAT")).toBeTruthy();
    expect(screen.getByText("EXPORT")).toBeTruthy();
  });

  it("responds to codex:notes:show event and becomes visible", () => {
    localStorage.setItem(NOTES_VIS, "0");
    render(<Notes />);
    // Initially hidden
    expect(document.querySelector(".cx-notes")).toBeNull();
    // Dispatch show event
    act(() => {
      window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: {} }));
    });
    expect(document.querySelector(".cx-notes")).not.toBeNull();
  });

  it("prefixes draft with ref when codex:notes:show carries a ref", () => {
    render(<Notes />);
    act(() => {
      window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: { ref: "Rev 22:20" } }));
    });
    const ta = document.querySelector("textarea.cx-notes-textarea") as HTMLTextAreaElement | null;
    expect(ta?.value).toBe("[Rev 22:20] ");
  });
});
