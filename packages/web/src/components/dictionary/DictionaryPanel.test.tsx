// @vitest-environment jsdom
// dictionary — component tests for DictionaryPanel.
// The module cache (_modPromise) persists across tests; _resetDictModuleCache()
// is called in beforeEach so each test gets a fresh load cycle.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { DictionaryPanel } from "./DictionaryPanel.js";
import { _resetDictModuleCache } from "./helpers.js";

interface DictTestWindow {
  CODEX_MODULES?: { loadModule: (id: string) => Promise<unknown> };
  CODEX_DATA?: { books?: Array<{ id: string; name: string }> };
}
const tw = (): DictTestWindow => window as unknown as DictTestWindow;

const MOCK_MOD = {
  entries: {
    "abraham": {
      title: "Abraham",
      kind: "person",
      body: "Father of many nations.",
      refs: ["gen.12.1"],
      related: ["Isaac"],
    },
    "bethlehem": {
      title: "Bethlehem",
      kind: "place",
      body: "A city in Judah, birthplace of David.",
    },
  },
  meta: { _partial: true },
};

const BOOKS = [
  { id: "gen", name: "Genesis" },
  { id: "jhn", name: "John" },
];

beforeEach(() => {
  _resetDictModuleCache();
  delete tw().CODEX_MODULES;
  tw().CODEX_DATA = { books: BOOKS };
});

describe("DictionaryPanel", () => {
  it("renders the loading state while the module is loading", () => {
    tw().CODEX_MODULES = {
      loadModule: () => new Promise<never>(() => {}), // never resolves
    };
    render(<DictionaryPanel />);
    expect(screen.getByText("Loading dictionary…")).toBeTruthy();
  });

  it("renders an error message when CODEX_MODULES is unavailable", async () => {
    // No CODEX_MODULES set — loadDict() rejects immediately
    render(<DictionaryPanel />);
    expect(await screen.findByText(/Couldn't load dictionary/)).toBeTruthy();
  });

  it("renders the panel header and SAMPLE pill once the module loads", async () => {
    tw().CODEX_MODULES = {
      loadModule: () => Promise.resolve(MOCK_MOD),
    };
    render(<DictionaryPanel />);
    expect(await screen.findByText("Bible Dictionary")).toBeTruthy();
    expect(screen.getByText(/SAMPLE/)).toBeTruthy();
  });

  it("shows the empty browse state prompt when loaded with no picks or query", async () => {
    tw().CODEX_MODULES = {
      loadModule: () => Promise.resolve(MOCK_MOD),
    };
    render(<DictionaryPanel />);
    await screen.findByText("Bible Dictionary");
    expect(screen.getByText(/Search above/)).toBeTruthy();
  });

  it("populates the search field when codex:dict-open fires with a capitalised word", async () => {
    tw().CODEX_MODULES = {
      loadModule: () => Promise.resolve(MOCK_MOD),
    };
    render(<DictionaryPanel />);
    await screen.findByText("Bible Dictionary");

    window.dispatchEvent(
      new CustomEvent("codex:dict-open", {
        detail: { text: "Abraham was a patriarch." },
      }),
    );

    await waitFor(() => {
      const input = screen.getByLabelText("Search the dictionary") as HTMLInputElement;
      expect(input.value).toBe("Abraham");
    });
  });

  it("shows search results and entry view when an entry is clicked", async () => {
    tw().CODEX_MODULES = {
      loadModule: () => Promise.resolve(MOCK_MOD),
    };
    render(<DictionaryPanel />);
    await screen.findByText("Bible Dictionary");

    const input = screen.getByLabelText("Search the dictionary");
    fireEvent.change(input, { target: { value: "Abraham" } });

    // The entry title appears in results
    expect(await screen.findByText(/Father of many nations/)).toBeTruthy();

    // Click the result button to open the entry
    fireEvent.click(screen.getByText("Abraham"));

    // Entry view is shown
    await waitFor(() => {
      expect(screen.getByTitle("Close entry")).toBeTruthy();
    });
  });

  it("renders the footer with source attribution", async () => {
    tw().CODEX_MODULES = {
      loadModule: () => Promise.resolve(MOCK_MOD),
    };
    render(<DictionaryPanel />);
    await screen.findByText("Bible Dictionary");
    expect(screen.getByText(/Easton's Bible Dictionary/)).toBeTruthy();
  });
});
