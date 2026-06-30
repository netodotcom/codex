// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { HelpWiki } from "./HelpWiki.js";
import type { ArticlesDoc } from "./data.js";

const ARTICLES: ArticlesDoc = {
  version: "1.0",
  updated: "2026-06-01",
  categories: ["Reading", "Basics"],
  articles: [
    {
      id: "r1",
      title: "Reading Modes",
      category: "Reading",
      tags: ["theme", "serif"],
      body: "Switch between **reading** modes and serif themes.\n\n## Setup\n\n- one\n- two",
    },
    { id: "r2", title: "Side by Side", category: "Reading", tags: ["serif", "compare"], body: "Compare translations side by side." },
    { id: "b1", title: "Getting Started", category: "Basics", tags: ["intro"], body: "Welcome to CODEX." },
  ],
};

function stubFetchResolving(doc: ArticlesDoc, ok = true, status = 200): void {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => doc } as unknown as Response)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HelpWiki", () => {
  it("shows the loading manual state before articles resolve", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => { /* never resolves */ })));
    render(<HelpWiki />);
    expect(screen.getByText("HELP & DOCS")).toBeTruthy();
    expect(screen.getByText("Loading manual…")).toBeTruthy();
  });

  it("renders the index with category cards once articles load", async () => {
    stubFetchResolving(ARTICLES);
    render(<HelpWiki />);
    expect(await screen.findByText("Help & Reference")).toBeTruthy();
    expect(screen.getByText("CODEX MANUAL · v1.0 · 2026-06-01")).toBeTruthy();
    // category cards
    expect(screen.getByText("Reading")).toBeTruthy();
    expect(screen.getByText("Basics")).toBeTruthy();
  });

  it("shows the error state when the fetch is not ok", async () => {
    stubFetchResolving(ARTICLES, false, 500);
    render(<HelpWiki />);
    expect(await screen.findByText("Could not load help articles: HTTP 500")).toBeTruthy();
  });

  it("predictive search opens the top match and renders its markdown", async () => {
    stubFetchResolving(ARTICLES);
    render(<HelpWiki />);
    await screen.findByText("Help & Reference");

    const input = screen.getByPlaceholderText("Search articles, or ask a question…");
    fireEvent.change(input, { target: { value: "reading modes" } });

    // Searching renders BOTH the predictive list and the full browse accordion
    // (faithful to the legacy), so scope to the predictive listbox for the match.
    const predict = await screen.findByRole("listbox", { name: "Matching articles" });
    expect(within(predict).getByText("press ↵")).toBeTruthy();
    const row = within(predict).getByText("Reading Modes");

    fireEvent.click(row);

    // article view: back affordance + rendered markdown (## Setup -> h2, - one -> li)
    expect(await screen.findByText("← BACK")).toBeTruthy();
    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByText("one")).toBeTruthy();
    // inline bold preserved
    expect(screen.getByText("reading").tagName).toBe("STRONG");
  });

  it("opens an article and shows its category + paragraph body", async () => {
    stubFetchResolving(ARTICLES);
    render(<HelpWiki />);
    await screen.findByText("Help & Reference");

    const input = screen.getByPlaceholderText("Search articles, or ask a question…");
    fireEvent.change(input, { target: { value: "side by side" } });

    const predict = await screen.findByRole("listbox", { name: "Matching articles" });
    fireEvent.click(within(predict).getByText("Side by Side"));

    expect(await screen.findByText("← BACK")).toBeTruthy();
    expect(screen.getByText("Compare translations side by side.")).toBeTruthy();
  });
});
