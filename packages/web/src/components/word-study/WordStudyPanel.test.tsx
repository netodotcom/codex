// @vitest-environment jsdom
// WordStudyPanel tests — verify: the empty-state prompt renders when there is no
// prior query, the search form submits and shows the hero section, cross-feature
// event listeners fire correctly, and the "configure AI" hint appears for Strong's
// entries when no AI key is configured.
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { WordStudyPanel } from "./WordStudyPanel.js";
import type { WordStudyWindow } from "./word-study-window.js";

const W = (): WordStudyWindow => window as unknown as WordStudyWindow;

// jsdom ships a localStorage stub with no working methods; install in-memory storage.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] ?? null : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  // Clear any prior last-studied so each test starts fresh
  localStorage.clear?.();
  delete W().CODEX_DATA;
  delete W().CODEX_SEARCH;
  delete W().CODEX_StrongsLookup;
  delete W().CODEX_PLUGINS_API;
});

describe("WordStudyPanel — empty state", () => {
  it("renders the search form and the onboarding prompt when no prior query", () => {
    render(<WordStudyPanel />);
    // search form
    expect(screen.getByRole("button", { name: "Study" })).toBeTruthy();
    expect(screen.getByLabelText("Word study search")).toBeTruthy();
    // onboarding copy
    expect(screen.getByText("Word Study")).toBeTruthy();
    expect(screen.getByText("G25")).toBeTruthy();
    expect(screen.getByText("H157")).toBeTruthy();
  });
});

describe("WordStudyPanel — search submit", () => {
  it("submitting the form with a plain word shows the hero section", async () => {
    render(<WordStudyPanel />);
    const input = screen.getByLabelText("Word study search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "love" } });
      fireEvent.submit(input.closest("form")!);
    });
    // Hero section should show the searched word
    expect(screen.getByText("love")).toBeTruthy();
    // Frequency section heading should appear
    expect(screen.getByText("Frequency in your library")).toBeTruthy();
  });

  it("submitting a Strong's number resolves the hero via CODEX_StrongsLookup", async () => {
    W().CODEX_StrongsLookup = (s) =>
      s === "G25" ? { word: "ἀγάπη", gloss: "love", translit: "agape" } : null;

    render(<WordStudyPanel />);
    const input = screen.getByLabelText("Word study search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "G25" } });
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByText("ἀγάπη")).toBeTruthy();
    expect(screen.getByText("G25")).toBeTruthy();
    expect(screen.getByText("agape")).toBeTruthy();
  });
});

describe("WordStudyPanel — cross-feature event listeners", () => {
  it("codex:word-study-open event updates the query", async () => {
    render(<WordStudyPanel />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("codex:word-study-open", {
        detail: { word: "grace" },
      }));
    });
    expect(screen.getByText("grace")).toBeTruthy();
  });

  it("codex:strongs-open event updates the query with the Strong's number", async () => {
    W().CODEX_StrongsLookup = (s) =>
      s === "H157" ? { word: "אָהַב", gloss: "love (Hebrew)" } : null;
    render(<WordStudyPanel />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("codex:strongs-open", {
        detail: { strongs: "H157" },
      }));
    });
    expect(screen.getByText("אָהַב")).toBeTruthy();
    expect(screen.getByText("H157")).toBeTruthy();
  });
});

describe("WordStudyPanel — AI section hint", () => {
  it("shows 'Configure an AI engine' hint for a Strong's entry when no AI key is set", async () => {
    W().CODEX_StrongsLookup = (s) =>
      s === "G26" ? { word: "ἀγαθός", gloss: "good" } : null;
    // No CODEX_DATA.tweaks.provider/model → hasAiKey() returns false
    render(<WordStudyPanel />);
    const input = screen.getByLabelText("Word study search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "G26" } });
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByText("Related words")).toBeTruthy();
    expect(screen.getByText(/Configure an AI engine/)).toBeTruthy();
  });
});

describe("WordStudyPanel — semantic range", () => {
  it("renders semantic range bullets from the Strong's def field", async () => {
    W().CODEX_StrongsLookup = (s) =>
      s === "G25"
        ? { word: "ἀγάπη", gloss: "love", def: "1) brotherly love 2) charity 3) divine love" }
        : null;
    render(<WordStudyPanel />);
    const input = screen.getByLabelText("Word study search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "G25" } });
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByText("Semantic range")).toBeTruthy();
    expect(screen.getByText("brotherly love")).toBeTruthy();
    expect(screen.getByText("charity")).toBeTruthy();
    expect(screen.getByText("divine love")).toBeTruthy();
  });
});
