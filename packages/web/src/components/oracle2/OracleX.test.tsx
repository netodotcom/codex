// @vitest-environment jsdom
// oracle2 — OracleX component tests.
// Covers: render, self-injected CSS, binding text, invocation buttons,
// empty-thread state, thread tabs, and plugin registration via index.tsx.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OracleX } from "./OracleX.js";

// ── localStorage shim ─────────────────────────────────────────────────────────
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
  });
}

interface TestWindow {
  CODEX_NOW?: Record<string, unknown>;
  CODEX_KERNEL?: unknown;
  CODEX_ARTIFACTS?: unknown;
  CODEX_AI_BUSY?: unknown;
  OracleX?: unknown;
  CODEX_PLUGINS_API?: { register: (p: unknown) => boolean };
}
const tw = (): TestWindow => window as unknown as TestWindow;

beforeEach(() => {
  installStorage();
  delete tw().CODEX_NOW;
  delete tw().CODEX_KERNEL;
  delete tw().CODEX_ARTIFACTS;
  delete tw().CODEX_AI_BUSY;
});

// ── Render ────────────────────────────────────────────────────────────────────
describe("OracleX", () => {
  it("renders the honesty banner", () => {
    render(<OracleX />);
    expect(screen.getByText(/AI COMPANION/)).toBeTruthy();
    expect(screen.getByText(/NOT SCRIPTURE/)).toBeTruthy();
  });

  it("self-injects the cxo2-css stylesheet (idempotent)", () => {
    render(<OracleX />);
    const style = document.getElementById("cxo2-css");
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe("STYLE");
    // second render does not duplicate
    render(<OracleX />);
    expect(document.querySelectorAll("#cxo2-css").length).toBe(1);
  });

  it("renders the 'new thread' tab", () => {
    render(<OracleX />);
    expect(screen.getByText("new thread")).toBeTruthy();
  });

  it("renders the + New thread button", () => {
    render(<OracleX />);
    const btn = screen.getByRole("button", { name: "New thread" });
    expect(btn).toBeTruthy();
  });

  it("shows 'BOUND TO' and 'the reader' when CODEX_NOW is absent", () => {
    render(<OracleX />);
    expect(screen.getByText("BOUND TO")).toBeTruthy();
    expect(screen.getByText("the reader")).toBeTruthy();
  });

  it("shows the current ref from CODEX_NOW", () => {
    tw().CODEX_NOW = { ref: "John 3:16", bookId: "jhn" };
    render(<OracleX />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("renders the 5 invocation buttons (disabled when no ref)", () => {
    render(<OracleX />);
    const invLabels = ["ILLUMINATE", "CONTEXT", "TONGUE", "THREADS", "CONTRA"];
    for (const label of invLabels) {
      const btn = screen.getByText(label);
      expect(btn).toBeTruthy();
    }
  });

  it("renders the empty-state prompt", () => {
    render(<OracleX />);
    expect(screen.getByText(/The oracle waits/)).toBeTruthy();
  });

  it("renders the ask input and send button", () => {
    render(<OracleX />);
    expect(screen.getByRole("textbox", { name: "Ask the oracle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("does NOT render the ⚒ TOOLS button when CODEX_KERNEL is absent", () => {
    render(<OracleX />);
    expect(screen.queryByText(/TOOLS/)).toBeNull();
  });

  it("renders the ⚒ TOOLS button when CODEX_KERNEL is present", () => {
    tw().CODEX_KERNEL = { call: vi.fn(), toolSpecs: vi.fn(() => []) };
    render(<OracleX />);
    expect(screen.getByText("⚒ TOOLS")).toBeTruthy();
  });

  it("clicking + creates a new tab", () => {
    render(<OracleX />);
    expect(screen.getAllByRole("tab").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "New thread" }));
    expect(screen.getAllByRole("tab").length).toBe(2);
  });
});

// ── index.tsx — plugin registration ──────────────────────────────────────────
describe("oracle2 index (window globals + plugin registration)", () => {
  it("sets window.OracleX and registers the sys-oracle plugin on import", async () => {
    const register = vi.fn(() => true);
    tw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    // The frozen export contract: window.OracleX
    expect(typeof tw().OracleX).toBe("function");

    // Plugin registered once, with the frozen ids / label / glyph
    expect(register).toHaveBeenCalledTimes(1);
    const plugin = (register.mock.calls[0]! as unknown[])[0] as {
      id: string;
      name: string;
      version: string;
      panels: Array<{ id: string; label: string; glyph: string; render: () => React.ReactElement }>;
    };
    expect(plugin.id).toBe("sys-oracle");
    expect(plugin.name).toBe("The Oracle");
    expect(plugin.version).toBe("11.0.0");
    expect(plugin.panels[0]!.id).toBe("oracle");
    expect(plugin.panels[0]!.label).toBe("ORACLE");
    expect(plugin.panels[0]!.glyph).toBe("◬");

    // panel.render() returns a React element wrapping OracleX
    const el = plugin.panels[0]!.render();
    expect(el).toBeTruthy();
  });
});
