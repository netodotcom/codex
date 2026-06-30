// @vitest-environment jsdom
// textflow — component tests for TextFlowRoot.
// Verifies that the root mounts correctly, sets/clears window.codexOpenText,
// dispatches toasts for bad specs, delegates bible refs to codexJumpToRef,
// and opens a TextWindow (cx-win chrome) for valid Sefaria specs.
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TextFlowRoot } from "./TextFlowRoot.js";

// Typed window view for this test file.
interface TFTestWindow {
  codexOpenText?: (spec: unknown) => boolean;
  codexJumpToRef?: (ref: string) => void;
}
function tw(): TFTestWindow {
  return window as unknown as TFTestWindow;
}

afterEach(() => {
  // Belt-and-suspenders: clean up globals in case a test unmounted early.
  const w = window as unknown as Record<string, unknown>;
  delete w["codexOpenText"];
  delete w["codexJumpToRef"];
});

describe("TextFlowRoot — mount / unmount lifecycle", () => {
  it("sets window.codexOpenText on mount", () => {
    render(<TextFlowRoot />);
    expect(typeof tw().codexOpenText).toBe("function");
  });

  it("clears window.codexOpenText on unmount", () => {
    const { unmount } = render(<TextFlowRoot />);
    expect(tw().codexOpenText).toBeDefined();
    unmount();
    expect(tw().codexOpenText).toBeUndefined();
  });
});

describe("TextFlowRoot — codexOpenText routing", () => {
  it("dispatches codex:toast and returns false for an unresolvable spec", () => {
    render(<TextFlowRoot />);
    const received: CustomEvent[] = [];
    const handler = (e: Event): void => { received.push(e as CustomEvent); };
    window.addEventListener("codex:toast", handler);
    const result = tw().codexOpenText?.("talmud.nobody.999");
    expect(result).toBe(false);
    expect(received.length).toBe(1);
    window.removeEventListener("codex:toast", handler);
  });

  it("dispatches codex:toast and returns false for empty string", () => {
    render(<TextFlowRoot />);
    const toasts: Event[] = [];
    const handler = (e: Event): void => { toasts.push(e); };
    window.addEventListener("codex:toast", handler);
    expect(tw().codexOpenText?.("")).toBe(false);
    expect(toasts.length).toBe(1);
    window.removeEventListener("codex:toast", handler);
  });

  it("calls codexJumpToRef for a bible ref and returns true", () => {
    render(<TextFlowRoot />);
    const jump = vi.fn();
    tw().codexJumpToRef = jump;
    const result = tw().codexOpenText?.("Genesis 1");
    expect(result).toBe(true);
    expect(jump).toHaveBeenCalledOnce();
    expect(jump).toHaveBeenCalledWith("Genesis 1");
  });

  it("does NOT call codexJumpToRef when it is not set", () => {
    render(<TextFlowRoot />);
    // codexJumpToRef is undefined — should not throw
    expect(() => tw().codexOpenText?.("John 1")).not.toThrow();
    expect(tw().codexOpenText?.("John 1")).toBe(true);
  });
});

describe("TextFlowRoot — Sefaria window rendering", () => {
  it("renders a text window for a valid Sefaria spec", () => {
    // Mock fetch — keep the component in loading state so we do not hit network.
    const fetchMock = vi.fn().mockReturnValue(new Promise<never>(() => {}));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TextFlowRoot />);

    act(() => {
      tw().codexOpenText?.("Berakhot 2a");
    });

    // The cx-win chrome always renders the "TALMUD" context badge in the header.
    expect(screen.getByText("TALMUD")).toBeTruthy();
    // Loading message appears while fetch is pending.
    expect(screen.getByText(/UNROLLING BERAKHOT 2A/)).toBeTruthy();
  });

  it("does not duplicate a window for the same tref", () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise<never>(() => {}));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TextFlowRoot />);

    act(() => {
      tw().codexOpenText?.("Shabbat 7b");
      tw().codexOpenText?.("Shabbat 7b"); // duplicate — should be ignored
    });

    // Only one TALMUD badge should appear.
    expect(screen.getAllByText("TALMUD").length).toBe(1);
  });
});
