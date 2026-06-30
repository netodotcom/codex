// @vitest-environment jsdom
// Component tests for the MarksX panel. jsdom is required for localStorage,
// window events, and React rendering. The tests exercise the main render paths:
// empty state, marks loaded from storage, filter input, pin divider, and the
// index module's plugin-registration contract.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MarksX } from "./MarksX.js";
import { MARKS_KEY, MARKS_PINS_KEY } from "./helpers.js";

// ── In-memory localStorage ────────────────────────────────────────────────

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] ?? null) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
});

// ── Render tests ──────────────────────────────────────────────────────────

describe("MarksX — empty state", () => {
  it("renders the empty-state paragraph and the MARK HERE button", () => {
    render(<MarksX />);
    expect(screen.getByText(/No marks yet/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Filter 0 marks…")).toBeTruthy();
    expect(screen.getByTitle("Mark the current verse")).toBeTruthy();
  });

  it("shows 'HERE' in the MARK button when CODEX_NOW is not set", () => {
    render(<MarksX />);
    // The button text is "✦ MARK HERE" (two sibling text nodes in JSX)
    const btn = screen.getByTitle("Mark the current verse");
    expect(btn.textContent).toContain("HERE");
  });
});

describe("MarksX — marks loaded from localStorage", () => {
  it("shows the mark count in the filter placeholder", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now() - 60_000, note: "" },
    });
    render(<MarksX />);
    expect(screen.getByPlaceholderText("Filter 1 mark…")).toBeTruthy();
  });

  it("renders the mark label derived from the storage key", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now() - 60_000, note: "" },
    });
    render(<MarksX />);
    // No CODEX_DATA → labelOf uses the raw bookId
    expect(screen.getByText("jhn 3:16")).toBeTruthy();
  });

  it("renders the note text when present", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "rose", ts: Date.now(), note: "God so loved" },
    });
    render(<MarksX />);
    expect(screen.getByText("God so loved")).toBeTruthy();
  });

  it("pluralises the filter placeholder for multiple marks", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now(), note: "" },
      "rev.1.1":  { color: "rose",  ts: Date.now(), note: "" },
    });
    render(<MarksX />);
    expect(screen.getByPlaceholderText("Filter 2 marks…")).toBeTruthy();
  });
});

describe("MarksX — filter input", () => {
  it("hides non-matching marks when filter text is typed", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now(), note: "" },
      "rev.1.1":  { color: "rose",  ts: Date.now(), note: "" },
    });
    render(<MarksX />);
    const input = screen.getByPlaceholderText("Filter 2 marks…");
    fireEvent.change(input, { target: { value: "jhn" } });
    expect(screen.getByText("jhn 3:16")).toBeTruthy();
    expect(screen.queryByText("rev 1:1")).toBeNull();
  });
});

describe("MarksX — pinned marks", () => {
  it("shows the ⌖ PINNED divider when at least one mark is pinned", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now(), note: "" },
    });
    store[MARKS_PINS_KEY] = JSON.stringify(["jhn.3.16"]);
    render(<MarksX />);
    expect(screen.getByText("⌖ PINNED")).toBeTruthy();
  });

  it("does not show the PINNED divider when nothing is pinned", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now(), note: "" },
    });
    render(<MarksX />);
    expect(screen.queryByText("⌖ PINNED")).toBeNull();
  });

  it("shows EVERYTHING divider only when both pinned and unpinned marks exist", () => {
    store[MARKS_KEY] = JSON.stringify({
      "jhn.3.16": { color: "amber", ts: Date.now(), note: "" },
      "rev.1.1":  { color: "rose",  ts: Date.now() - 1000, note: "" },
    });
    store[MARKS_PINS_KEY] = JSON.stringify(["jhn.3.16"]);
    render(<MarksX />);
    expect(screen.getByText("EVERYTHING")).toBeTruthy();
  });
});

// ── index.tsx contract ────────────────────────────────────────────────────

describe("marks-plugin index — window export + plugin registration", () => {
  it("sets window.MarksX and registers sys-marks with the correct ids", async () => {
    interface IW {
      CODEX_PLUGINS_API?: { register: (p: unknown) => unknown };
      MarksX?: unknown;
    }
    const iw = (): IW => window as unknown as IW;

    interface RegisteredPlugin {
      id: string;
      name: string;
      version: string;
      panels: Array<{ id: string; label: string; glyph: string }>;
    }

    const register = (p: unknown): boolean => {
      const plugin = p as RegisteredPlugin;
      expect(plugin.id).toBe("sys-marks");
      expect(plugin.name).toBe("The Marks");
      expect(plugin.version).toBe("10.0.0");
      expect(plugin.panels[0]?.id).toBe("marks");
      expect(plugin.panels[0]?.label).toBe("MARKS");
      expect(plugin.panels[0]?.glyph).toBe("⌖");
      return true;
    };

    iw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    expect(typeof iw().MarksX).toBe("function");
  });
});
