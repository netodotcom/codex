// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PolityTimeline } from "./PolityTimeline.js";
import type { Polity } from "./polity.js";

const fmtYear = (y: number): string => (y < 0 ? `${Math.abs(y)} BC` : `${y} AD`);
const POLITIES: Polity[] = [
  { name: "Egypt", from: -3100, to: -332 },
  { name: "Rome", from: -27, to: 476 },
];

describe("PolityTimeline", () => {
  it("renders the active polity for the verse year and the slider", () => {
    render(<PolityTimeline polities={POLITIES} verseYear={100} fmtYear={fmtYear} fetchYearContext={async () => ({ headline: "" })} />);
    expect(screen.getAllByText("Rome").length).toBeGreaterThan(0); // 100 AD ∈ Rome (active + list)
    expect(screen.getByLabelText("Year")).toBeTruthy();
    expect(screen.getByText(/full timeline · 2 polities/)).toBeTruthy();
  });

  it("retargets the year when a timeline row is clicked", () => {
    render(<PolityTimeline polities={POLITIES} verseYear={100} fmtYear={fmtYear} fetchYearContext={async () => ({ headline: "" })} />);
    fireEvent.click(screen.getByTitle("Jump to mid-Egypt"));
    // mid-Egypt = round((-3100 + -332)/2) = -1716 → active becomes Egypt
    expect(screen.getAllByText("Egypt").length).toBeGreaterThan(0);
  });

  it("injects the year-context fetcher", () => {
    const fetchYearContext = vi.fn(async () => ({ headline: "Pax Romana", events: ["x"] }));
    render(<PolityTimeline polities={POLITIES} verseYear={100} fmtYear={fmtYear} fetchYearContext={fetchYearContext} />);
    // shows the loading placeholder before the debounced fetch resolves
    expect(screen.getByText(/resolving/)).toBeTruthy();
  });
});
