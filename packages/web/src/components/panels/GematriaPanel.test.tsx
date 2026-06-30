// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GematriaPanel } from "./GematriaPanel.js";
import type { GemServices } from "./gem-services.js";
import type { PanelData, Passage } from "./types.js";

const passage: Passage = { book: "John", chapter: 1 };
const services: GemServices = {
  index: null,
  jumpRef: () => {},
  openStrongs: () => {},
  emitDepth: () => {},
  loadKabMap: async () => null,
};
const base = (): PanelData => ({ talmud: [], commentary: [], gematria: [], gematriaNotes: [], gnosis: [], crossRefs: [] });

describe("GematriaPanel", () => {
  it("computes the live ∑ calculator on input", () => {
    render(<GematriaPanel panelData={null} status={{}} passage={passage} onRegenerate={() => {}} services={services} />);
    const input = screen.getByPlaceholderText("λόγος / אהבה");
    fireEvent.change(input, { target: { value: "λόγος" } });
    expect(screen.getAllByText("373").length).toBeGreaterThan(0); // sum + extra
    expect(screen.getByText(/Greek isopsephy · live/)).toBeTruthy();
  });

  it("shows the draft state when there is no panel data", () => {
    render(<GematriaPanel panelData={null} status={{}} passage={passage} onRegenerate={() => {}} services={services} />);
    expect(screen.getByText(/Generate companion material for John 1/)).toBeTruthy();
  });

  it("renders the lexical-value grid", () => {
    const data = { ...base(), gematria: [{ term: "λόγος", translit: "logos", meaning: "Word", value: 373, system: "Greek" }] };
    render(<GematriaPanel panelData={data} status={{}} passage={passage} onRegenerate={() => {}} services={services} />);
    expect(screen.getByText("LEXICAL VALUES")).toBeTruthy();
    expect(screen.getByText("logos")).toBeTruthy();
    expect(screen.getByText("Word")).toBeTruthy();
  });
});
