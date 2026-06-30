// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CodexTranslationsX } from "./TranslationsPanel.js";
import type { TranslationsWindow, TxCodexData } from "./translations-window.js";

const TW = (): TranslationsWindow => window as unknown as TranslationsWindow;

const BASE_DATA: TxCodexData = {
  translations: [
    { id: "kjv", name: "King James Version", lang: "EN", year: 1611, source: "bundle" },
    { id: "web", name: "World English Bible", lang: "EN", year: 2000, source: "network" },
  ],
  books: [],
};

const BASE_PASSAGE = {
  book: "John",
  chapter: 3,
  verses: [{ n: 16, kjv: "For God so loved the world...", web: "For God so loved the world..." }],
};

beforeEach(() => {
  TW().CODEX_DATA = { ...BASE_DATA, translations: [...BASE_DATA.translations] };
  TW().CODEX_TRANS_STATE = undefined;
  TW().loadRepos = undefined;
  TW().removeRepo = undefined;
  TW().RepoAdd = undefined;
});

describe("CodexTranslationsX", () => {
  it("renders the translations region with lane headings and card names", () => {
    render(
      <CodexTranslationsX
        primary="kjv"
        onPrimary={() => {}}
        compareSet={[]}
        onToggleCompare={() => {}}
        passage={BASE_PASSAGE}
        currentVerse={16}
      />
    );
    expect(screen.getByRole("region", { name: "Translations" })).toBeTruthy();
    // "King James Version" appears in both the identity block and the card name — that's expected
    expect(screen.getAllByText("King James Version").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("World English Bible")).toBeTruthy();
    // Lane header tag and name
    expect(screen.getByText("EN")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
  });

  it("renders the verse text from the primary translation", () => {
    render(
      <CodexTranslationsX
        primary="kjv"
        onPrimary={() => {}}
        compareSet={[]}
        onToggleCompare={() => {}}
        passage={BASE_PASSAGE}
        currentVerse={16}
      />
    );
    expect(screen.getByText("For God so loved the world...")).toBeTruthy();
    // The reference is rendered as a cite
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("filters translations by name query — only matching card remains visible", () => {
    render(
      <CodexTranslationsX
        primary="kjv"
        onPrimary={() => {}}
        compareSet={[]}
        onToggleCompare={() => {}}
        passage={BASE_PASSAGE}
        currentVerse={16}
      />
    );
    const input = screen.getByPlaceholderText("Filter · name, lang, id, year");
    fireEvent.change(input, { target: { value: "World" } });
    // WEB card should be visible
    expect(screen.getByText("World English Bible")).toBeTruthy();
    // KJV card pick button should no longer appear (identity block still shows primary name)
    expect(screen.queryByTitle("King James Version — you are reading this")).toBeNull();
    expect(screen.queryByTitle("Read in King James Version")).toBeNull();
  });

  it("shows empty state when filter has no matches", () => {
    render(
      <CodexTranslationsX
        primary="kjv"
        onPrimary={() => {}}
        compareSet={[]}
        onToggleCompare={() => {}}
        passage={BASE_PASSAGE}
        currentVerse={16}
      />
    );
    const input = screen.getByPlaceholderText("Filter · name, lang, id, year");
    fireEvent.change(input, { target: { value: "zzznomatch" } });
    expect(screen.getByText(/no translation matches/)).toBeTruthy();
  });

  it("renders compare rows for ids in compareSet (excluding primary)", () => {
    render(
      <CodexTranslationsX
        primary="kjv"
        onPrimary={() => {}}
        compareSet={["kjv", "web"]}
        onToggleCompare={() => {}}
        passage={BASE_PASSAGE}
        currentVerse={16}
      />
    );
    // "web" is in compareSet and not primary → compare block appears (div, not a section)
    expect(document.querySelector(".cx-tx-compare")).not.toBeNull();
    // The compare tag renders id.toUpperCase() when no glyph
    expect(document.querySelector(".cx-tx-cmp-tag")?.textContent).toBe("WEB");
  });

  it("falls back to em-dash for missing verse text", () => {
    render(
      <CodexTranslationsX
        primary="nkjv"
        onPrimary={() => {}}
        compareSet={[]}
        onToggleCompare={() => {}}
        passage={{ book: "John", chapter: 3, verses: [{ n: 16, kjv: "text" }] }}
        currentVerse={16}
      />
    );
    // "nkjv" key is not in the verse object → falls back to "—"
    expect(screen.getByText("—")).toBeTruthy();
  });
});
