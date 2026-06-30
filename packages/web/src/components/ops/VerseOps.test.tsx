// @vitest-environment jsdom
// Tests for VerseOps, OpsEvent, and ArtifactBodyLegacy. The kernel is never
// loaded in these tests so VerseOps boots in "STANDING BY" mode — the main
// exercised path during first render.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VerseOps, OpsEvent, ArtifactBodyLegacy } from "./VerseOps.js";

interface TestWindow {
  CODEX_KERNEL?: unknown;
  codexSpeak?: unknown;
  IntelBanner?: unknown;
}
const tw = (): TestWindow => window as unknown as TestWindow;

beforeEach(() => {
  delete tw().CODEX_KERNEL;
  delete tw().codexSpeak;
  delete tw().IntelBanner;
  // Remove any previously injected CSS between tests
  const el = document.getElementById("cx-ops2-css");
  if (el) el.remove();
});

describe("VerseOps", () => {
  it("renders the backdrop, header tag, and STANDING BY status with no kernel", () => {
    const onClose = vi.fn();
    render(<VerseOps onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("CODEX · OPS")).toBeTruthy();
    expect(screen.getByText("STANDING BY")).toBeTruthy();
  });

  it("shows 'kernel not loaded' hint when CODEX_KERNEL is absent", () => {
    render(<VerseOps onClose={() => {}} />);
    expect(screen.getByText("kernel not loaded")).toBeTruthy();
  });

  it("shows the idle state epigraph when no mission is running", () => {
    render(<VerseOps onClose={() => {}} />);
    expect(screen.getByText(/Ask, and it will be given/)).toBeTruthy();
  });

  it("self-injects the cx-ops2-css stylesheet on mount", () => {
    render(<VerseOps onClose={() => {}} />);
    expect(document.getElementById("cx-ops2-css")).not.toBeNull();
  });

  it("does not duplicate the stylesheet on re-render (idempotent)", () => {
    render(<VerseOps onClose={() => {}} />);
    render(<VerseOps onClose={() => {}} />);
    const els = document.querySelectorAll("#cx-ops2-css");
    expect(els.length).toBe(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<VerseOps onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the × button is clicked", () => {
    const onClose = vi.fn();
    render(<VerseOps onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the MISSIONS button in the header", () => {
    render(<VerseOps onClose={() => {}} />);
    expect(screen.getByTitle("Past missions")).toBeTruthy();
  });

  it("renders IntelBanner when present on window", () => {
    tw().IntelBanner = ({ note }: { note?: string }) => <div data-testid="ib">{note}</div>;
    render(<VerseOps onClose={() => {}} />);
    expect(screen.getByTestId("ib")).toBeTruthy();
    expect(screen.getByText(/EVERY RESULT COMPUTED LOCALLY/)).toBeTruthy();
  });

  it("seeds the textarea with the seed prop", () => {
    render(<VerseOps seed="trace the logos" onClose={() => {}} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.value).toBe("trace the logos");
  });
});

describe("OpsEvent", () => {
  it("renders a start event with MISSION START and the intent", () => {
    render(<OpsEvent ev={{ type: "start", intent: "trace the logos" }} />);
    expect(screen.getByText("MISSION START")).toBeTruthy();
    expect(screen.getByText("trace the logos")).toBeTruthy();
  });

  it("renders a tool event with the tool name and args", () => {
    render(<OpsEvent ev={{ type: "tool", tool: "search", args: { q: "logos" } }} />);
    expect(screen.getByText(/▸ search/)).toBeTruthy();
    expect(screen.getByText(/"logos"/)).toBeTruthy();
  });

  it("renders a tool event with a thought", () => {
    render(<OpsEvent ev={{ type: "tool", tool: "search", thought: "I should look this up", args: {} }} />);
    expect(screen.getByText("I should look this up")).toBeTruthy();
  });

  it("renders a result event with a collapsible details element", () => {
    render(<OpsEvent ev={{ type: "result", tool: "search", result: "line one\nline two" }} />);
    expect(screen.getByTitle("Expand the full tool result")).toBeTruthy();
    expect(screen.getByText(/2 lines/)).toBeTruthy();
  });

  it("renders a failed result event with is-failed class", () => {
    const { container } = render(
      <OpsEvent ev={{ type: "result", tool: "search", result: "error msg", failed: true }} />
    );
    expect(container.querySelector(".is-failed")).not.toBeNull();
  });

  it("renders a section event with the heading", () => {
    render(<OpsEvent ev={{ type: "section", section: { heading: "The Word", body: "" } }} />);
    expect(screen.getByText(/§ The Word/)).toBeTruthy();
  });

  it("renders a done event", () => {
    render(<OpsEvent ev={{ type: "done" }} />);
    expect(screen.getByText(/MISSION COMPLETE/)).toBeTruthy();
  });

  it("renders a done event with step-budget note", () => {
    render(<OpsEvent ev={{ type: "done", budget: true }} />);
    expect(screen.getByText(/step budget/)).toBeTruthy();
  });

  it("renders an error event with the error message", () => {
    render(<OpsEvent ev={{ type: "error", error: "timeout" }} />);
    expect(screen.getByText(/timeout/)).toBeTruthy();
  });

  it("renders an abort event", () => {
    render(<OpsEvent ev={{ type: "abort" }} />);
    expect(screen.getByText(/aborted/)).toBeTruthy();
  });

  it("returns null for an unknown event type", () => {
    // Cast to bypass TS: the legacy returns null for unknown types.
    const ev = { type: "unknown" } as unknown as Parameters<typeof OpsEvent>[0]["ev"];
    const { container } = render(<OpsEvent ev={ev} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("ArtifactBodyLegacy", () => {
  it("renders plain text with no ref chips", () => {
    render(<ArtifactBodyLegacy body="No references here." />);
    expect(screen.getByText("No references here.")).toBeTruthy();
    expect(document.querySelectorAll(".cx-ops-refchip").length).toBe(0);
  });

  it("renders ref chips for scripture references", () => {
    render(<ArtifactBodyLegacy body="See John 3:16 today." />);
    expect(document.querySelectorAll(".cx-ops-refchip").length).toBe(1);
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("calls the onJumpRef callback when a ref chip is clicked", () => {
    const onJumpRef = vi.fn();
    render(<ArtifactBodyLegacy body="John 3:16 is key." onJumpRef={onJumpRef} />);
    fireEvent.click(screen.getByText("John 3:16"));
    expect(onJumpRef).toHaveBeenCalledWith("John 3:16");
  });
});
