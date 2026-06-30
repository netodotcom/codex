// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GnosisPanel } from "./GnosisPanel.js";
import type { PanelData, Passage } from "./types.js";

const passage: Passage = { book: "John", chapter: 1 };
const base = (): PanelData => ({ talmud: [], commentary: [], gematria: [], gnosis: [], crossRefs: [] });

describe("GnosisPanel", () => {
  it("reflects overlay state and fires the toggle", () => {
    const onToggle = vi.fn();
    render(
      <GnosisPanel panelData={base()} status={{}} passage={passage} onRegenerate={() => {}} gnosisOn={false} onToggleGnosis={onToggle} />,
    );
    expect(screen.getByText("OVERLAY DORMANT")).toBeTruthy();
    fireEvent.click(screen.getByText("ENGAGE"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("expands a band on click to reveal its body", () => {
    const data = { ...base(), gnosis: [{ sigil: "✶", title: "Pleroma", body: "fullness" }] };
    render(
      <GnosisPanel panelData={data} status={{}} passage={passage} onRegenerate={() => {}} gnosisOn onToggleGnosis={() => {}} />,
    );
    expect(screen.queryByText("fullness")).toBeNull(); // collapsed by default
    fireEvent.click(screen.getByText("Pleroma"));
    expect(screen.getByText("fullness")).toBeTruthy();
  });

  it("shows the empty-field state when there are no readings", () => {
    render(
      <GnosisPanel panelData={base()} status={{}} passage={passage} onRegenerate={() => {}} gnosisOn onToggleGnosis={() => {}} />,
    );
    expect(screen.getByText(/No esoteric readings on record/)).toBeTruthy();
  });
});
