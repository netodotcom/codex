// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DisarmPanel, type DisarmData } from "./DisarmPanel.js";

const passage = { book: "John", chapter: 1 };

describe("DisarmPanel", () => {
  it("shows the empty state when there are no entries", () => {
    render(<DisarmPanel panelData={{ entries: [] }} status={{}} passage={passage} onRegenerate={() => {}} />);
    expect(screen.getByText(/No weaponizations on record/)).toBeTruthy();
  });

  it("expands a pair to reveal the weaponization + rebuttal duel", () => {
    const data: DisarmData = {
      entries: [{ verse: "1:11", weaponization: "deicide charge", rebuttal: "see Romans 8:28", quote: "q", source: "src", era: "4th c." }],
    };
    render(<DisarmPanel panelData={data} status={{}} passage={passage} onRegenerate={() => {}} />);
    expect(screen.getByText(/1 entry/)).toBeTruthy();
    // collapsed: duel sections not shown
    expect(screen.queryByText("WEAPONIZATION")).toBeNull();
    fireEvent.click(screen.getByText("deicide charge"));
    expect(screen.getByText("WEAPONIZATION")).toBeTruthy();
    expect(screen.getByText("REBUTTAL · SCHOLARLY")).toBeTruthy();
    expect(screen.getByText("Romans 8:28").tagName).toBe("A"); // linkified rebuttal
  });
});
