// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CODEX_VERSION_DATA, installWhatsNew } from "./helpers.js";
import { vw } from "./version-window.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// The runner's global localStorage shim can be unreliable; install a real
// in-memory one (same pattern as repo-add/helpers.test.ts).
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  // Ensure CODEX_VERSION is present so installWhatsNew() can read it.
  vw().CODEX_VERSION = { ...CODEX_VERSION_DATA, notes: [...CODEX_VERSION_DATA.notes] };
});

afterEach(() => {
  vi.useRealTimers();
  document.getElementById("cx-whatsnew")?.remove();
  document.getElementById("cx-fresh")?.remove();
});

// ── Pure data — golden values ─────────────────────────────────────────────────
describe("CODEX_VERSION_DATA", () => {
  it("v is '12.0' (parity probe golden value)", () => {
    expect(CODEX_VERSION_DATA.v).toBe("12.0");
  });

  it("sw is 'v270'", () => {
    expect(CODEX_VERSION_DATA.sw).toBe("v270");
  });

  it("notes is a non-empty array of strings", () => {
    expect(Array.isArray(CODEX_VERSION_DATA.notes)).toBe(true);
    expect(CODEX_VERSION_DATA.notes.length).toBeGreaterThan(0);
    expect(CODEX_VERSION_DATA.notes.every((n) => typeof n === "string")).toBe(true);
  });

  it("notes contains the desktop-drag fix entry", () => {
    expect(
      CODEX_VERSION_DATA.notes.some((n) => n.includes("THE WHOLE DESKTOP IS YOURS")),
    ).toBe(true);
  });
});

// ── window.CODEX_VERSION (parity probe) ──────────────────────────────────────
describe("window.CODEX_VERSION", () => {
  it("index.ts assigns CODEX_VERSION to window with the exact shape and golden .v value", async () => {
    // Dynamic import: runs module top-level code on first call, cached thereafter.
    await import("./index.js");
    const cv = vw().CODEX_VERSION;
    expect(cv.v).toBe("12.0");
    expect(cv.sw).toBe("v270");
    expect(Array.isArray(cv.notes)).toBe(true);
    expect(cv.notes.length).toBeGreaterThan(0);
  });
});

// ── installWhatsNew behaviour ─────────────────────────────────────────────────
describe("installWhatsNew", () => {
  it("first visit: stores current version in localStorage and shows no card", () => {
    // localStorage is empty → first-ever visit branch
    installWhatsNew();
    expect(localStorage.getItem("codex.lastver")).toBe("12.0");
    expect(document.getElementById("cx-whatsnew")).toBeNull();
  });

  it("same version as last-seen: does not schedule a card", () => {
    localStorage.setItem("codex.lastver", "12.0");
    vi.useFakeTimers();
    installWhatsNew();
    vi.advanceTimersByTime(2000);
    expect(document.getElementById("cx-whatsnew")).toBeNull();
  });

  it("new version: schedules card to appear after 1200 ms", () => {
    localStorage.setItem("codex.lastver", "11.5"); // older version
    vi.useFakeTimers();
    installWhatsNew();
    // Not yet visible before timer fires
    expect(document.getElementById("cx-whatsnew")).toBeNull();
    vi.advanceTimersByTime(1200);
    const card = document.getElementById("cx-whatsnew");
    expect(card).not.toBeNull();
    expect(card?.getAttribute("role")).toBe("status");
  });

  it("card shows at most 4 notes even if more are present", () => {
    localStorage.setItem("codex.lastver", "11.5");
    // Override with 6 notes; only first 4 should appear.
    vw().CODEX_VERSION = { v: "12.0", sw: "v269", notes: ["a", "b", "c", "d", "e", "f"] };
    vi.useFakeTimers();
    installWhatsNew();
    vi.advanceTimersByTime(1200);
    const items = document.querySelectorAll("#cx-whatsnew li");
    expect(items.length).toBe(4);
  });

  it("dismiss button: updates localStorage, adds animation class, removes card after 350 ms", () => {
    localStorage.setItem("codex.lastver", "11.5");
    vi.useFakeTimers();
    installWhatsNew();
    vi.advanceTimersByTime(1200);

    const card = document.getElementById("cx-whatsnew");
    expect(card).not.toBeNull();
    if (!card) return; // TypeScript narrowing

    const xBtn = card.querySelector<HTMLButtonElement>(".cx-whatsnew-x");
    expect(xBtn).not.toBeNull();
    if (!xBtn) return; // TypeScript narrowing

    xBtn.click();

    // localStorage is updated immediately on dismiss
    expect(localStorage.getItem("codex.lastver")).toBe("12.0");
    // Animation class is applied immediately
    expect(card.classList.contains("cx-fresh-out")).toBe(true);
    // Card is still in DOM (350 ms timeout pending)
    expect(document.getElementById("cx-whatsnew")).not.toBeNull();
    // After 350 ms, the card is removed
    vi.advanceTimersByTime(350);
    expect(document.getElementById("cx-whatsnew")).toBeNull();
  });

  it("show() is a no-op if cx-whatsnew already exists in DOM", () => {
    localStorage.setItem("codex.lastver", "11.5");
    // Pre-populate a card to simulate the guard
    const existing = document.createElement("div");
    existing.id = "cx-whatsnew";
    document.body.appendChild(existing);
    vi.useFakeTimers();
    installWhatsNew();
    vi.advanceTimersByTime(1200);
    // Only one card should exist
    expect(document.querySelectorAll("#cx-whatsnew").length).toBe(1);
  });
});
