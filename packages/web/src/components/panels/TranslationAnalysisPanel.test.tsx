// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TranslationAnalysisPanel, type TxAnalysisService, type TxAnalysisData } from "./TranslationAnalysisPanel.js";

// kjv + web are both in @codex/core's registry; verse carries both texts.
const passage = {
  bookId: "jhn",
  book: "John",
  chapter: 1,
  verses: [{ n: 1, kjv: "In the beginning was the Word", web: "In the beginning was the Word" }],
};

function service(over: Partial<TxAnalysisService> = {}): TxAnalysisService {
  return { getCached: () => null, getMeta: () => null, load: async () => ({ renderings: [] }), purge: () => {}, ...over };
}

describe("TranslationAnalysisPanel", () => {
  it("requires 2+ translations", () => {
    render(<TranslationAnalysisPanel passage={passage} primary="kjv" compareSet={[]} service={service()} />);
    expect(screen.getByText("NEED 2+ TRANSLATIONS")).toBeTruthy();
  });

  it("previews loaded translations and fetches the analysis", async () => {
    const data: TxAnalysisData = {
      renderings: [{ translation: "KJV", year: "1611", philosophy: "Formal", text: "…", key_choice: "Word" }],
      best_for_study: "NASB",
    };
    const load = vi.fn(async () => data);
    render(<TranslationAnalysisPanel passage={passage} primary="kjv" compareSet={["web"]} service={service({ load })} />);
    expect(screen.getByText("Currently loaded")).toBeTruthy();
    fireEvent.click(screen.getByText(/DRAFT VIA ORACLE/));
    expect(load).toHaveBeenCalledOnce();
    expect(await screen.findByText("COMPARISON TABLE")).toBeTruthy();
    expect(screen.getByText("KJV")).toBeTruthy();
  });
});
