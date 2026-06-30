// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtButtons, ArtChart, ArtFlow, ArtVerseGrid, ArtBroken } from "./directives.js";

interface TestWindow {
  codexJumpToRef?: (ref: string) => void;
  codexGoto?: (b: string, c: number, v: number) => void;
  BIBLE?: { loadChapter(b: string, c: number, t: string): Promise<unknown> };
}
function tw(): TestWindow {
  return window as unknown as TestWindow;
}

beforeEach(() => {
  delete tw().codexJumpToRef;
  delete tw().codexGoto;
  tw().BIBLE = {
    loadChapter: () => Promise.resolve({ verses: [{ n: 16, text: "For God so loved the world" }] }),
  };
});

describe("ArtButtons", () => {
  it("renders buttons and routes the action on click", () => {
    const jump = vi.fn();
    tw().codexJumpToRef = jump;
    render(<ArtButtons code={'[{"label":"Read John 1","action":{"kind":"goto","ref":"John 1:1"}}]'} />);
    const btn = screen.getByRole("button", { name: "Read John 1" });
    fireEvent.click(btn);
    expect(jump).toHaveBeenCalledWith("John 1:1");
  });

  it("renders the honest broken block when the payload is not a JSON array", () => {
    render(<ArtButtons code={"not json"} />);
    expect(screen.getByText(/UNRENDERED/)).toBeTruthy();
    expect(screen.getByText(/codex:buttons/)).toBeTruthy();
  });
});

describe("ArtChart", () => {
  it("renders a bar chart figure with the title and honest value labels", () => {
    const { container } = render(
      <ArtChart code={'{"type":"bar","title":"Logos","data":[{"label":"John","value":4},{"label":"1 John","value":1}]}'} />,
    );
    expect(container.querySelector("figure.cx-art-chart")).not.toBeNull();
    expect(screen.getByText("Logos")).toBeTruthy();
    const svg = container.querySelector("svg[role='img']");
    expect(svg?.getAttribute("aria-label")).toBe("Bar chart: Logos");
    expect(screen.getByText("John")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders a line chart when type is line", () => {
    const { container } = render(<ArtChart code={'{"type":"line","data":[{"label":"a","value":1},{"label":"b","value":3}]}'} />);
    expect(container.querySelector("svg[role='img']")?.getAttribute("aria-label")).toBe("Line chart");
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("renders the broken block for an empty data set", () => {
    render(<ArtChart code={'{"type":"bar","data":[]}'} />);
    expect(screen.getByText(/UNRENDERED/)).toBeTruthy();
  });
});

describe("ArtFlow", () => {
  it("renders nodes and routes a clickable node through the reader door", () => {
    const jump = vi.fn();
    tw().codexJumpToRef = jump;
    render(
      <ArtFlow
        code={'{"nodes":[{"id":"a","label":"Word","ref":"John 1:1"},{"id":"b","label":"Flesh"}],"edges":[{"from":"a","to":"b","label":"becomes"}]}'}
      />,
    );
    expect(screen.getByText("Word")).toBeTruthy();
    expect(screen.getByText("Flesh")).toBeTruthy();
    const node = screen.getByRole("button", { name: "Open the reader at John 1:1" });
    fireEvent.click(node);
    expect(jump).toHaveBeenCalledWith("John 1:1");
  });
});

describe("ArtVerseGrid", () => {
  it("renders a live verse card that loads its text", async () => {
    render(<ArtVerseGrid code={'["John 3:16"]'} />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
    expect(await screen.findByText(/For God so loved the world/)).toBeTruthy();
  });

  it("renders the broken block when the payload is not an array of refs", () => {
    render(<ArtVerseGrid code={"{}"} />);
    expect(screen.getByText(/UNRENDERED/)).toBeTruthy();
  });
});

describe("ArtBroken", () => {
  it("shows the tag and truncates the payload", () => {
    render(<ArtBroken tag="codex:chart" code={"x".repeat(500)} />);
    expect(screen.getByText(/UNRENDERED/)).toBeTruthy();
    expect(screen.getByText(/codex:chart/)).toBeTruthy();
    const pre = document.querySelector("pre.cx-art-code");
    expect(pre?.textContent?.length).toBe(400);
  });
});
