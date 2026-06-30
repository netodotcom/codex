// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CornerFrame, Pill, Tick } from "./chrome.js";

describe("reader chrome", () => {
  it("CornerFrame renders four corners, an optional label, and children", () => {
    const { container } = render(
      <CornerFrame label="LIBRARY" glow className="extra">
        <p>body</p>
      </CornerFrame>,
    );
    const frame = container.querySelector(".cx-frame");
    expect(frame?.classList.contains("is-glow")).toBe(true);
    expect(frame?.classList.contains("extra")).toBe(true);
    expect(container.querySelectorAll(".cx-corner")).toHaveLength(4);
    expect(container.querySelector(".cx-frame-label")?.textContent).toBe("LIBRARY");
    expect(container.textContent).toContain("body");
  });

  it("Pill carries dim/accent modifiers", () => {
    const { container } = render(<Pill accent>⟁</Pill>);
    const pill = container.querySelector(".cx-pill");
    expect(pill?.classList.contains("is-accent")).toBe(true);
    expect(pill?.textContent).toBe("⟁");
  });

  it("Tick passes through className + children", () => {
    const { container } = render(<Tick className="cx-hide-narrow">BMK</Tick>);
    const tick = container.querySelector(".cx-tick");
    expect(tick?.classList.contains("cx-hide-narrow")).toBe(true);
    expect(tick?.textContent).toBe("BMK");
  });
});
