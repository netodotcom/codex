// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CodexMobileShell } from "./MobileShell.js";
import type { MobileWindow } from "./mobile-window.js";

const W = (): MobileWindow => window as unknown as MobileWindow;

// Install in-memory localStorage so freq/orb reads/writes behave.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  localStorage.clear();
  delete W().CODEX_ENGAGE;
  delete W().CODEX_PLUGINS_API;
  delete W().CODEX_NOW;
  delete W().CodexReaderX;
  delete W().codexMobile;
});

describe("CodexMobileShell", () => {
  it("renders the reader plugin-missing fallback when CodexReaderX is not set", () => {
    render(<CodexMobileShell />);
    expect(screen.getByText("READER PLUGIN MISSING")).toBeTruthy();
  });

  it("renders the orb button", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    expect(orb).toBeTruthy();
    expect(orb.className).toContain("cx-orb");
  });

  it("orb has the center position class by default", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    expect(orb.className).toContain("is-center");
  });

  it("renders MobileTrace with time when not in focus mode", () => {
    render(<CodexMobileShell />);
    // The trace has role="toolbar" aria-label="System"
    expect(screen.getByRole("toolbar", { name: "System" })).toBeTruthy();
  });

  it("opens the palm when the orb is tapped (pointerdown + pointerup)", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    // Simulate a tap: pointerdown then pointerup at same location (no movement)
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    // The palm is a dialog with aria-label="The palm"
    expect(screen.getByRole("dialog", { name: "The palm" })).toBeTruthy();
  });

  it("closes the palm when the scrim is clicked", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    // palm is open — click the scrim
    const scrim = document.querySelector(".cx-palm-scrim");
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim!);
    expect(screen.queryByRole("dialog", { name: "The palm" })).toBeNull();
  });

  it("closes the palm via codex:escape event", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(screen.getByRole("dialog", { name: "The palm" })).toBeTruthy();
    act(() => { window.dispatchEvent(new Event("codex:escape")); });
    expect(screen.queryByRole("dialog", { name: "The palm" })).toBeNull();
  });

  it("sets window.codexMobile on mount and removes it on unmount", () => {
    const { unmount } = render(<CodexMobileShell />);
    expect(typeof W().codexMobile?.open).toBe("function");
    expect(W().codexMobile?.on()).toBe(true);
    unmount();
    expect(W().codexMobile).toBeUndefined();
  });

  it("palm shows THE PALM placeholder when no reading cursor is set", () => {
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(screen.getByText("THE PALM")).toBeTruthy();
  });

  it("palm shows current ref when CODEX_NOW has a ref", () => {
    W().CODEX_NOW = { ref: "Jhn.3.16", book: "John", bookId: "jhn", chapter: 3, verse: 16 };
    render(<CodexMobileShell />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(screen.getByText("Jhn.3.16")).toBeTruthy();
  });

  it("orb shows streak arc when CODEX_ENGAGE returns a live streak", () => {
    const today = new Date().toISOString().slice(0, 10);
    W().CODEX_ENGAGE = { loadStreak: () => ({ current: 5, lastDate: today }) };
    render(<CodexMobileShell />);
    // The streak arc circle has className cx-orb-streak
    const arc = document.querySelector(".cx-orb-streak");
    expect(arc).toBeTruthy();
  });

  it("palm renders builtin panel chips when builtinWin is provided", () => {
    const builtinWin = {
      notes: { glyph: "📝", title: "MY NOTES" },
    };
    render(<CodexMobileShell builtinWin={builtinWin} />);
    const orb = screen.getByRole("button", { name: /CODEX — open the palm/ });
    fireEvent.pointerDown(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(orb, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    expect(screen.getByTitle("MY NOTES")).toBeTruthy();
  });
});
