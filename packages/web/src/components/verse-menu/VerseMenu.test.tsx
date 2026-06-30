// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VerseMenu } from "./VerseMenu.js";
import type { PassageObject, VerseObject } from "./VerseMenu.js";

const PASSAGE: PassageObject = { book: "John", bookId: "jhn", chapter: 3 };
const VERSE: VerseObject = { n: 16 };

describe("VerseMenu — render", () => {
  it("renders the verse reference header", () => {
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={() => {}} />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("renders all three verb buttons with glyphs and labels", () => {
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={() => {}} />);
    expect(screen.getByText("SWORD")).toBeTruthy();
    expect(screen.getByText("MIRROR")).toBeTruthy();
    expect(screen.getByText("MAP")).toBeTruthy();
    expect(screen.getByText("⚔")).toBeTruthy();
    expect(screen.getByText("⌬")).toBeTruthy();
    expect(screen.getByText("◎")).toBeTruthy();
  });

  it("renders MARK with fallback colour when no highlight is active", () => {
    render(
      <VerseMenu
        passage={PASSAGE}
        verse={VERSE}
        currentHighlight={null}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("MARK")).toBeTruthy();
    expect(screen.getByText("✦")).toBeTruthy();
    expect(screen.getByText("amber")).toBeTruthy();
  });

  it("uses the highlightColor prop as the fallback colour when provided", () => {
    render(
      <VerseMenu
        passage={PASSAGE}
        verse={VERSE}
        currentHighlight={null}
        highlightColor="blue"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("blue")).toBeTruthy();
  });

  it("renders UNMARK when a highlight is active", () => {
    render(
      <VerseMenu
        passage={PASSAGE}
        verse={VERSE}
        currentHighlight="gold"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("UNMARK")).toBeTruthy();
    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.getByText("gold")).toBeTruthy();
  });

  it("renders COMPARE and more… rows", () => {
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={() => {}} />);
    expect(screen.getByText("COMPARE")).toBeTruthy();
    expect(screen.getByText("more…")).toBeTruthy();
  });

  it("uses question mark when verse is missing", () => {
    render(<VerseMenu passage={PASSAGE} onClose={() => {}} />);
    expect(screen.getByText("John 3:?")).toBeTruthy();
  });
});

describe("VerseMenu — interactions", () => {
  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleHighlight and onClose when the MARK row is clicked", () => {
    const onClose = vi.fn();
    const onToggleHighlight = vi.fn();
    render(
      <VerseMenu
        passage={PASSAGE}
        verse={VERSE}
        currentHighlight={null}
        onClose={onClose}
        onToggleHighlight={onToggleHighlight}
      />,
    );
    fireEvent.click(screen.getByText("MARK").closest("button")!);
    expect(onToggleHighlight).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose (but not onToggleHighlight) when onToggleHighlight is absent", () => {
    const onClose = vi.fn();
    render(
      <VerseMenu
        passage={PASSAGE}
        verse={VERSE}
        currentHighlight={null}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText("MARK").closest("button")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dispatches codex:os-open on COMPARE click and calls onClose", () => {
    const onClose = vi.fn();
    const events: string[] = [];
    window.addEventListener("codex:os-open", (e) => {
      events.push((e as CustomEvent<{ kind: string }>).detail.kind);
    });
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={onClose} />);
    fireEvent.click(screen.getByText("COMPARE").closest("button")!);
    expect(events).toContain("compare");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls codexOpenOmni with ref seed when more… is clicked", () => {
    const onClose = vi.fn();
    const codexOpenOmni = vi.fn();
    (window as unknown as { codexOpenOmni?: typeof codexOpenOmni }).codexOpenOmni = codexOpenOmni;
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={onClose} />);
    fireEvent.click(screen.getByText("more…").closest("button")!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(codexOpenOmni).toHaveBeenCalledWith("John 3:16 ");
    delete (window as unknown as { codexOpenOmni?: unknown }).codexOpenOmni;
  });

  it("closes on Escape keydown", () => {
    const onClose = vi.fn();
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dispatches codex:depth-action with type sword-cleave on SWORD click", () => {
    const onClose = vi.fn();
    const depths: string[] = [];
    window.addEventListener("codex:depth-action", (e) => {
      depths.push((e as CustomEvent<{ type: string }>).detail.type);
    });
    render(<VerseMenu passage={PASSAGE} verse={VERSE} onClose={onClose} />);
    fireEvent.click(screen.getByText("SWORD").closest("button")!);
    expect(depths).toContain("sword-cleave");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
