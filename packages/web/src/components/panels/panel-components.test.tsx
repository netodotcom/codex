// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TalmudPanel } from "./TalmudPanel.js";
import { CommentaryPanel } from "./CommentaryPanel.js";
import { buildNoteText } from "./notes.js";
import { LinkifyRefs } from "./LinkifyRefs.js";
import type { PanelData, Passage } from "./types.js";

const passage: Passage = { book: "John", chapter: 1 };
const empty = (): PanelData => ({ talmud: [], commentary: [], gematria: [], gnosis: [], crossRefs: [] });

describe("TalmudPanel", () => {
  it("shows the status placeholder when there is no data", () => {
    render(<TalmudPanel panelData={null} status={{}} passage={passage} onRegenerate={() => {}} />);
    expect(screen.getByText("TALMUDIC PARALLELS")).toBeTruthy();
    expect(screen.getByText(/Generate companion material for John 1/)).toBeTruthy();
  });
  it("renders parallels with index + heading", () => {
    const data = { ...empty(), talmud: [{ ref: "b. Chagigah 12a", heading: "On the Light", body: "see Genesis 1:3", tag: "or" }] };
    render(<TalmudPanel panelData={data} status={{}} passage={passage} onRegenerate={() => {}} />);
    expect(screen.getByText("On the Light")).toBeTruthy();
    expect(screen.getByText(/תלמוד · 01/)).toBeTruthy();
    expect(screen.getByText("Genesis 1:3").tagName).toBe("A"); // linkified
  });
});

describe("CommentaryPanel", () => {
  it("groups by tradition and links cross-refs", () => {
    const onJump = vi.fn();
    const data = {
      ...empty(),
      commentary: [{ from: "Patristic", author: "Augustine", body: "x" }],
      crossRefs: [{ ref: "gen.1.1", note: "creation" }],
    };
    render(<CommentaryPanel panelData={data} status={{}} passage={passage} onRegenerate={() => {}} onJumpRef={onJump} />);
    expect(screen.getByText("PATRISTIC")).toBeTruthy();
    expect(screen.getByText("Augustine")).toBeTruthy();
    fireEvent.click(screen.getByText("gen.1.1"));
    expect(onJump).toHaveBeenCalledWith("gen.1.1");
  });
});

describe("buildNoteText", () => {
  it("formats a note with ref header + body", () => {
    const { refStr, text } = buildNoteText({ kind: "Talmud", ref: "b. 12a", heading: "H", body: "B", tag: "t", passage });
    expect(refStr).toBe("John 1 · Talmud");
    expect(text).toContain("[John 1 · Talmud]");
    expect(text).toContain("H (t)");
    expect(text).toContain("B");
  });
});

describe("LinkifyRefs", () => {
  it("passes through plain text and linkifies refs", () => {
    const { container } = render(<LinkifyRefs text="read John 3:16 now" />);
    expect(container.textContent).toBe("read John 3:16 now");
    expect(container.querySelector("a.cx-pl-ref")?.textContent).toBe("John 3:16");
  });
});
