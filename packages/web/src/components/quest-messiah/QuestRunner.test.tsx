// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { QuestRunner } from "./QuestRunner.js";
import type { QuestMessiahWindow } from "./quest-messiah-window.js";

const W = (): QuestMessiahWindow => window as unknown as QuestMessiahWindow;

// Install an in-memory Storage so loadProgress / saveProgress don't throw.
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
  delete W().CODEX_ENGAGEMENT;
  delete W().codexJumpToRef;
});

describe("QuestRunner", () => {
  it("renders the header, first card, and bottom navigation on initial mount", () => {
    render(<QuestRunner onClose={() => {}} />);

    // header
    expect(screen.getByText("SIDE QUEST")).toBeTruthy();
    expect(screen.getByText("Messiah in Prophecy · 50 Core Prophecies")).toBeTruthy();
    // progress counter starts at 0/50
    expect(screen.getByText("0 / 50")).toBeTruthy();

    // first card — "01" appears in both the sidebar item AND the card header; use getAllByText
    expect(screen.getAllByText("01").length).toBeGreaterThanOrEqual(1);
    // The card title appears in both sidebar and main area
    expect(screen.getAllByText("Seed of the Woman").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("OT")).toBeTruthy();
    expect(screen.getByText("NT")).toBeTruthy();

    // debate panel is open by default
    expect(screen.getByText("Debate Ready")).toBeTruthy();
    expect(screen.getByText("Common objection")).toBeTruthy();
    expect(screen.getByText("Comeback")).toBeTruthy();

    // nav buttons
    expect(screen.getByText("← Previous")).toBeTruthy();
    expect(screen.getByText("Mark as Studied")).toBeTruthy();
    expect(screen.getByText("Next →")).toBeTruthy();
  });

  it("Previous button is disabled on card 0, Next enables navigation to card 2", () => {
    render(<QuestRunner onClose={() => {}} />);

    const prevBtn = screen.getByText("← Previous").closest("button") as HTMLButtonElement;
    const nextBtn = screen.getByText("Next →").closest("button") as HTMLButtonElement;

    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    // "Descendant of Abraham" appears in both sidebar and main card
    expect(screen.getAllByText("Descendant of Abraham").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("02").length).toBeGreaterThanOrEqual(1);
  });

  it("Mark as Studied toggles the studied state and updates the progress counter", () => {
    render(<QuestRunner onClose={() => {}} />);

    const markBtn = screen.getByText("Mark as Studied").closest("button") as HTMLButtonElement;
    fireEvent.click(markBtn);

    // counter advances
    expect(screen.getByText("1 / 50")).toBeTruthy();
    // button label flips
    expect(screen.getByText("✓ Studied · click to unmark")).toBeTruthy();

    // clicking again unmarks
    fireEvent.click(screen.getByText("✓ Studied · click to unmark").closest("button") as HTMLButtonElement);
    expect(screen.getByText("0 / 50")).toBeTruthy();
    expect(screen.getByText("Mark as Studied")).toBeTruthy();
  });

  it("Debate Ready toggle collapses and re-expands the debate panel", () => {
    render(<QuestRunner onClose={() => {}} />);

    const debateToggle = screen.getByText("Debate Ready").closest("button") as HTMLButtonElement;
    fireEvent.click(debateToggle);

    // debate body should no longer be present
    expect(screen.queryByText("Common objection")).toBeNull();
    expect(screen.queryByText("Comeback")).toBeNull();

    // click again to re-expand
    fireEvent.click(screen.getByText("Debate Ready").closest("button") as HTMLButtonElement);
    expect(screen.getByText("Common objection")).toBeTruthy();
  });

  it("sidebar is rendered with section headings and card items", () => {
    render(<QuestRunner onClose={() => {}} />);

    // Section names appear in sidebar buttons; the first section also appears in cx-q-card-section.
    // Use getAllByText to allow multiple matches.
    expect(screen.getAllByText("The Promised Seed & Royal Lineage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Birth & Forerunner")).toBeTruthy();
    expect(screen.getByText("Ministry & Character")).toBeTruthy();
    expect(screen.getByText("Betrayal & Suffering")).toBeTruthy();
    expect(screen.getByText("Death, Resurrection & Exaltation")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    let closed = false;
    render(<QuestRunner onClose={() => { closed = true; }} />);

    const closeBtn = screen.getByTitle("Close tour · Esc").closest("button") as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(closed).toBe(true);
  });

  it("ref links call codexJumpToRef and then onClose", () => {
    let jumped = "";
    let closed = false;
    W().codexJumpToRef = (ref: string) => { jumped = ref; };

    render(<QuestRunner onClose={() => { closed = true; }} />);

    // The first OT ref link is "Genesis 3:15"
    const refLink = screen.getAllByRole("link")[0] as HTMLAnchorElement;
    fireEvent.click(refLink);

    expect(jumped).toBe("Genesis 3:15");
    expect(closed).toBe(true);
  });
});
