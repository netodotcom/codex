// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ReelsFeed, ReelsPanel } from "./ReelsPanel.js";
import { State } from "./data.js";
import type { ReelsWindow } from "./reels-window.js";

const W = (): ReelsWindow => window as unknown as ReelsWindow;

// jsdom ships a localStorage stub with no backing store; install an in-memory
// store so deck reads/writes behave correctly.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) =>
        Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  // Reset State between tests to avoid cross-contamination.
  State.deck = [];
  State.curated = null;
  State.seen = null;
  State.busy = false;
  State.listeners = new Set();
  delete W().CODEX_MODULES;
  delete W().CODEX_ENGAGE;
  delete W().CODEX_ENGAGEMENT;
  delete W().ReactDOM;
  // Prevent real network calls in refillDeck by supplying an empty module.
  W().CODEX_MODULES = {
    loadModule: async () => ({ cards: [] }),
  };
});

describe("ReelsFeed", () => {
  it("shows the loading message when the deck is empty", () => {
    render(<ReelsFeed ctx={{}} />);
    expect(screen.getByText("loading the feed…")).toBeTruthy();
  });

  it("renders a card and its type badge when the deck has items", () => {
    State.deck = [
      {
        type: "light-verse",
        id: "v1",
        title: "Test Title",
        body: "Test Body",
        anchor: "gen.1.1",
      },
    ];
    render(<ReelsFeed ctx={{}} />);
    expect(screen.getByText("Test Body")).toBeTruthy();
    // TYPE_LABELS badge for light-verse
    expect(screen.getByText("✦ LIGHT")).toBeTruthy();
  });

  it("renders a question card with a reveal button", () => {
    State.deck = [
      {
        type: "question",
        id: "q1",
        question: "What is the meaning of life?",
        answer: "42",
      },
    ];
    render(<ReelsFeed ctx={{}} />);
    expect(screen.getByText("What is the meaning of life?")).toBeTruthy();
    expect(screen.getByText("tap to reveal")).toBeTruthy();
  });

  it("reveals the answer when the reveal button is clicked", () => {
    State.deck = [
      {
        type: "question",
        id: "q2",
        question: "Who created the heavens?",
        answer: "God, in the beginning",
      },
    ];
    render(<ReelsFeed ctx={{}} />);
    fireEvent.click(screen.getByText("tap to reveal"));
    expect(screen.getByText("God, in the beginning")).toBeTruthy();
  });

  it("renders an art-verse card with its title and an img tag", () => {
    State.deck = [
      {
        type: "art-verse",
        id: "art1",
        title: "The Creation",
        artist: "Michelangelo",
        image: "https://example.com/art.jpg",
        anchor: "gen.1.1",
      },
    ];
    render(<ReelsFeed ctx={{}} />);
    expect(screen.getByText("The Creation")).toBeTruthy();
    expect(screen.getByAltText("The Creation")).toBeTruthy();
    expect(screen.getByText("⌖ ART")).toBeTruthy();
  });

  it("shows close button in fullscreen mode", () => {
    State.deck = [{ type: "light-verse", id: "v1", body: "Light" }];
    const onClose = (): void => {};
    render(<ReelsFeed ctx={{}} fullscreen={true} onClose={onClose} />);
    expect(screen.getByLabelText("Close reels")).toBeTruthy();
  });
});

describe("ReelsPanel", () => {
  it("renders the launcher pane with the REELS title and Open button", () => {
    render(<ReelsPanel />);
    expect(screen.getByText("REELS")).toBeTruthy();
    expect(screen.getByTitle("Open reels")).toBeTruthy();
    expect(screen.getByText("fullscreen only")).toBeTruthy();
  });

  it("shows the feed overlay on initial mount (fs starts true)", () => {
    // With an empty deck the feed shows its loading message inside the overlay.
    render(<ReelsPanel />);
    // The overlay is rendered inline (no ReactDOM.createPortal in tests).
    expect(screen.getByText("loading the feed…")).toBeTruthy();
  });
});
