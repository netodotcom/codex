// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ComparePanel } from "./ComparePanel.js";

describe("ComparePanel", () => {
  it("renders the panel title and tagline", () => {
    render(<ComparePanel />);
    expect(screen.getByText("How CODEX Compares")).toBeTruthy();
    expect(screen.getByText("Honest. Sourced. Open to PRs.")).toBeTruthy();
  });

  it("renders the hero strip with four stat cards", () => {
    render(<ComparePanel />);
    // "$0" appears in multiple places (hero card + feature matrix cells); use getAllByText
    const zeros = screen.getAllByText("$0");
    expect(zeros.length).toBeGreaterThan(0);
    const heroBig = zeros.find((el) => el.className === "cx-cmp-hero-big");
    expect(heroBig).toBeTruthy();
    // These strings are unique to the hero strip
    expect(screen.getByText("Forever. No tiers.")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Offline & air-gap")).toBeTruthy();
    expect(screen.getByText("AI-native by design")).toBeTruthy();
    // "Open source" also appears as a feature row label — use getAllByText
    const openSources = screen.getAllByText("Open source");
    expect(openSources.length).toBeGreaterThanOrEqual(1);
    const heroLbl = openSources.find((el) => el.className === "cx-cmp-hero-lbl");
    expect(heroLbl).toBeTruthy();
  });

  it("renders the feature matrix section heading", () => {
    render(<ComparePanel />);
    expect(screen.getByText("Feature matrix")).toBeTruthy();
    expect(screen.getByText("29 features × 7 apps · hover a cell for notes")).toBeTruthy();
  });

  it("renders all 7 app short codes in the matrix header", () => {
    render(<ComparePanel />);
    expect(screen.getByText("CDX")).toBeTruthy();
    expect(screen.getByText("LGS")).toBeTruthy();
    expect(screen.getByText("ESW")).toBeTruthy();
    expect(screen.getByText("YV")).toBeTruthy();
    expect(screen.getByText("SFR")).toBeTruthy();
    expect(screen.getByText("OT")).toBeTruthy();
    expect(screen.getByText("BLB")).toBeTruthy();
  });

  it("renders the price chart section heading", () => {
    render(<ComparePanel />);
    expect(screen.getByText("Price (USD, lifetime)")).toBeTruthy();
  });

  it("renders the radar chart section heading", () => {
    render(<ComparePanel />);
    expect(screen.getByText("Feature coverage radar")).toBeTruthy();
    expect(screen.getByText("8 axes · 0–100 % subjective coverage · toggle apps below")).toBeTruthy();
  });

  it("renders all 7 toggle buttons in the radar legend", () => {
    render(<ComparePanel />);
    // APPS names appear as legend buttons
    const buttons = screen.getAllByRole("button");
    // 7 toggle buttons + 1 share button = at least 7 named app buttons
    const appNames = ["CODEX", "Logos", "e-Sword", "YouVersion", "Sefaria", "Olive Tree", "Blue Letter Bible"];
    for (const name of appNames) {
      expect(buttons.some((b) => b.textContent?.includes(name))).toBe(true);
    }
  });

  it("renders the sentiment section heading", () => {
    render(<ComparePanel />);
    expect(screen.getByText("What people love · what frustrates them")).toBeTruthy();
  });

  it("renders the roadmap section", () => {
    render(<ComparePanel />);
    expect(screen.getByText("→ Where CODEX is going")).toBeTruthy();
    expect(screen.getByText(/Capacitor native/)).toBeTruthy();
  });

  it("renders the share button", () => {
    render(<ComparePanel />);
    expect(screen.getByText("Share this matrix")).toBeTruthy();
    expect(screen.getByText("Copies a Markdown table you can paste into any thread.")).toBeTruthy();
  });

  it("renders the sources footer", () => {
    render(<ComparePanel />);
    expect(screen.getByText("Sources:")).toBeTruthy();
    expect(screen.getByText("CONTRIBUTING.md")).toBeTruthy();
  });

  it("toggle button removes app from radar by toggling visible state (class changes)", () => {
    render(<ComparePanel />);
    // Find the Logos toggle button (CODEX is always visible at first)
    const buttons = screen.getAllByRole("button");
    const logosBtn = buttons.find((b) => b.textContent?.includes("Logos") && !b.textContent?.includes("Letter"));
    expect(logosBtn).toBeTruthy();
    // Initially 'on' class is present
    expect(logosBtn?.className).toContain("on");
    // Click to toggle off
    fireEvent.click(logosBtn!);
    expect(logosBtn?.className).not.toContain("on");
    // Click again to toggle back on
    fireEvent.click(logosBtn!);
    expect(logosBtn?.className).toContain("on");
  });
});
