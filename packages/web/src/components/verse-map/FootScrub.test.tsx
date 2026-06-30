// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FootScrub } from "./FootScrub.js";
import type { Polity } from "./polity.js";

const fmtYear = (y: number): string => (y < 0 ? `${Math.abs(y)} BC` : `${y} AD`);
const POLITIES: Polity[] = [
  { name: "Egypt", from: -3100, to: -332 },
  { name: "Rome", from: -27, to: 476 },
];

describe("FootScrub", () => {
  it("renders a slider with a segment per polity", () => {
    const { container } = render(<FootScrub polities={POLITIES} verseYear={100} fmtYear={fmtYear} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeTruthy();
    expect(container.querySelectorAll(".cx-mapx-scrub-seg")).toHaveLength(2);
    // verse year 100 sits inside Rome
    expect(screen.getByText("Rome")).toBeTruthy();
  });

  it("moves to the previous era on ArrowLeft", () => {
    render(<FootScrub polities={POLITIES} verseYear={100} fmtYear={fmtYear} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(screen.getByText("Egypt")).toBeTruthy();
  });

  it("renders nothing when there are no valid polities", () => {
    const { container } = render(<FootScrub polities={[]} fmtYear={fmtYear} />);
    expect(container.firstChild).toBeNull();
  });
});
