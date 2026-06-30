// @vitest-environment jsdom
import React from "react";
import ReactDOM from "react-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtifactsRich } from "./ArtifactsRich.js";

interface TestWindow {
  ReactDOM?: unknown;
  codexJumpToRef?: (ref: string) => void;
  codexGoto?: (b: string, c: number, v: number) => void;
}
function tw(): TestWindow {
  return window as unknown as TestWindow;
}

beforeEach(() => {
  tw().ReactDOM = ReactDOM; // portal host for the hover preview
  delete tw().codexJumpToRef;
  delete tw().codexGoto;
});

describe("ArtifactsRich", () => {
  it("renders a heading, bold inline, and self-injects its idempotent CSS", () => {
    render(<ArtifactsRich text={"## Hi there\n\nThis is **bold** text"} />);
    expect(screen.getByText("Hi there")).toBeTruthy();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(document.getElementById("cx-artifacts-css")).not.toBeNull();
  });

  it("renders an ordered/unordered list", () => {
    const { container } = render(<ArtifactsRich text={"- alpha\n- beta"} />);
    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(ul?.querySelectorAll("li").length).toBe(2);
    expect(screen.getByText("alpha")).toBeTruthy();
  });

  it("paints [j] as red-letter and [d] as the divine shimmer", () => {
    const { container } = render(<ArtifactsRich text={"[j]Follow me[/j] then [d]Let there be light[/d]"} />);
    expect(container.querySelector(".cx-red")?.textContent).toBe("Follow me");
    expect(container.querySelector(".cx-divine")?.textContent).toBe("Let there be light");
  });

  it("turns a plain scripture reference into a clickable chip that opens the reader", () => {
    const jump = vi.fn();
    tw().codexJumpToRef = jump;
    render(<ArtifactsRich text={"See John 1:1 for the Word."} />);
    const chip = screen.getByText("John 1:1");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.className).toContain("cx-art-ref");
    fireEvent.click(chip);
    expect(jump).toHaveBeenCalledWith("John 1:1");
  });

  it("renders a markdown table with header and rows", () => {
    const { container } = render(<ArtifactsRich text={"| Book | N |\n|---|---|\n| John | 4 |"} />);
    expect(container.querySelector("table.cx-art-table")).not.toBeNull();
    expect(container.querySelectorAll("thead th").length).toBe(2);
    expect(screen.getByText("John")).toBeTruthy();
  });
});
