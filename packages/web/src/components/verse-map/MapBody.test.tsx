// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MapBody, type MapData } from "./MapBody.js";
import type { VerseMapDeps } from "./deps.js";

const deps: VerseMapDeps = {
  fmtYear: (y) => String(y),
  chat: async () => ({ text: "{}" }),
  touristPrompt: "",
  fetchYearContext: async () => ({ headline: "" }),
  fetchEmpirePolygon: async () => null,
  resolvePoiWiki: async () => ({ summary: "", thumbUrl: null, pageUrl: null }),
  resolvePoiRefs: async () => ({ refs: [], src: "" }),
  gotoOsis: () => {},
};

const data: MapData = {
  lat: 31.78,
  lng: 35.22,
  place: "Jerusalem",
  era: "Second Temple",
  summary: "The holy city.",
  populations: "dense",
  polities: [{ name: "Rome", from: -27, to: 476 }],
  verseYear: 30,
};

function renderBody(): void {
  render(<MapBody data={data} mirrorKey="codex.mirrors.jhn.1.1" refStr="John 1:1" deps={deps} cur={{ bookId: "jhn", chapter: 1, verse: 1 }} />);
}

describe("MapBody", () => {
  it("renders the info column, overlay layers and composed children", () => {
    renderBody();
    expect(screen.getByRole("heading", { name: "Jerusalem" })).toBeTruthy();
    expect(screen.getByText("The holy city.")).toBeTruthy();
    expect(screen.getByText("dense")).toBeTruthy(); // MapField POPULATIONS
    expect(screen.getByTitle("Biblical events")).toBeTruthy(); // overlay layer button
    expect(screen.getByText(/⌖ Jerusalem/)).toBeTruthy(); // a11y POI list entry
    // PolityTimeline (polities present) renders its CHRONO tag
    expect(screen.getByText("CHRONO")).toBeTruthy();
  });

  it("toggling Tourist mode requests GPS (unsupported in jsdom → error shown)", () => {
    renderBody();
    fireEvent.click(screen.getByTitle(/Tourist mode/));
    expect(screen.getByText(/Geolocation not supported/)).toBeTruthy();
  });
});
