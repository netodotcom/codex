// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MarketplacePanel } from "./MarketplacePanel.js";
import type { MarketplaceWindow } from "./marketplace-window.js";

const W = (): MarketplaceWindow => window as unknown as MarketplaceWindow;

beforeEach(() => {
  delete W().CODEX_MODULES;
  delete W().CODEX_PLUGINS_API;
  // Reset module-level index cache between tests by clearing fetch mock
});

describe("MarketplacePanel", () => {
  it("renders the panel heading and installed-count section with no modules API", () => {
    render(<MarketplacePanel />);
    expect(screen.getByText("⌬ Module Marketplace")).toBeTruthy();
    expect(screen.getByText(/Installed \(0\)/)).toBeTruthy();
    expect(screen.getByText(/Nothing installed yet/)).toBeTruthy();
  });

  it("renders the add-by-URL and add-by-file sections", () => {
    render(<MarketplacePanel />);
    expect(screen.getByText("Add by URL")).toBeTruthy();
    expect(screen.getByText("Add by file")).toBeTruthy();
    expect(screen.getByText(/Drop a .json module here/)).toBeTruthy();
  });

  it("renders category chips", () => {
    render(<MarketplacePanel />);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Lexicons")).toBeTruthy();
    expect(screen.getByText("Commentaries")).toBeTruthy();
  });

  it("renders installed modules from CODEX_MODULES.listModules", async () => {
    W().CODEX_MODULES = {
      listModules: async () => [
        { id: "test-lex", name: "Test Lexicon", type: "lexicon", version: "1.0.0" },
      ],
      loadModuleFromUrl: async () => ({}),
      removeModule: async () => ({}),
    };
    render(<MarketplacePanel />);
    expect(await screen.findByText("Test Lexicon")).toBeTruthy();
    expect(screen.getByText(/Installed \(1\)/)).toBeTruthy();
  });

  it("shows URL install validation error when URL is empty", () => {
    render(<MarketplacePanel />);
    const btn = screen.getByText("Install");
    fireEvent.click(btn);
    expect(screen.getByText("Enter a URL first.")).toBeTruthy();
  });

  it("navigates to detail view on row click and back button returns", async () => {
    // Patch fetch to return a small index
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({ ok: true, json: async () => ({ modules: [{ id: "m1", name: "Alpha Module", type: "lexicon", featured: false }] }) } as Response);
    render(<MarketplacePanel />);
    const row = await screen.findByText("Alpha Module");
    fireEvent.click(row);
    expect(screen.getByText("‹ BACK TO MARKETPLACE")).toBeTruthy();
    fireEvent.click(screen.getByText("‹ BACK TO MARKETPLACE"));
    expect(screen.getByText("⌬ Module Marketplace")).toBeTruthy();
    globalThis.fetch = origFetch;
  });
});
