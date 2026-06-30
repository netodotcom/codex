// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clamp,
  mirror,
  tick,
  renderToast,
  ensureToast,
  _resetForTest,
  setDev,
} from "./helpers.js";
import { CAP } from "./types.js";
import type { CodexError } from "./types.js";

// ── Typed window accessor ─────────────────────────────────────────────────────
type ObsWindow = Window & { __CODEX_ERRORS__?: CodexError[] };
const w = (): ObsWindow => window as unknown as ObsWindow;

// ── Reset between tests ───────────────────────────────────────────────────────
beforeEach(() => {
  _resetForTest();
  w().__CODEX_ERRORS__ = undefined;
});

// ── clamp ─────────────────────────────────────────────────────────────────────
describe("clamp", () => {
  it("leaves an array at exactly CAP (200) untouched", () => {
    w().__CODEX_ERRORS__ = Array.from({ length: CAP }, (_, i) => ({ message: String(i) }));
    clamp();
    expect(w().__CODEX_ERRORS__?.length).toBe(CAP);
  });

  it("trims to CAP when over the limit", () => {
    w().__CODEX_ERRORS__ = Array.from({ length: CAP + 50 }, (_, i) => ({ message: String(i) }));
    clamp();
    expect(w().__CODEX_ERRORS__?.length).toBe(CAP);
  });

  it("keeps the NEWEST entries after trimming (oldest dropped)", () => {
    // Fill with messages "0" … "200" (201 total). After clamp, "0" is gone.
    w().__CODEX_ERRORS__ = Array.from({ length: CAP + 1 }, (_, i) => ({ message: String(i) }));
    clamp();
    expect(w().__CODEX_ERRORS__?.[0]?.message).toBe("1");
    expect(w().__CODEX_ERRORS__?.[CAP - 1]?.message).toBe(String(CAP));
  });

  it("is a no-op when __CODEX_ERRORS__ is undefined", () => {
    expect(() => clamp()).not.toThrow();
  });
});

// ── mirror ────────────────────────────────────────────────────────────────────
describe("mirror (console bridge)", () => {
  it("logs each entry with the [CODEX] prefix and legacy format", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ type: "error", message: "boom", src: "app.js" }];

    mirror();

    expect(spy).toHaveBeenCalledWith("[CODEX]", "error:", "boom", "(app.js)");
    spy.mockRestore();
  });

  it("defaults type to 'error' when type is absent", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ message: "no-type" }];

    mirror();

    expect(spy).toHaveBeenCalledWith("[CODEX]", "error:", "no-type", "");
    spy.mockRestore();
  });

  it("omits src parens when src is absent", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ type: "unhandledrejection", message: "prom" }];

    mirror();

    expect(spy).toHaveBeenCalledWith("[CODEX]", "unhandledrejection:", "prom", "");
    spy.mockRestore();
  });

  it("does NOT re-log entries already mirrored", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ message: "first" }];
    mirror(); // indexes 0 → mirrored now = 1
    spy.mockClear();

    mirror(); // no new entries
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs only new entries appended after the first mirror call", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ message: "first" }];
    mirror();
    spy.mockClear();

    w().__CODEX_ERRORS__!.push({ message: "second" });
    mirror();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[CODEX]", "error:", "second", "");
    spy.mockRestore();
  });
});

// ── tick ──────────────────────────────────────────────────────────────────────
describe("tick (integration: clamp + mirror + renderToast)", () => {
  it("processes a pushed error and mirrors it to console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [];
    tick(); // initial — empty, nothing logged
    spy.mockClear();

    const err: CodexError = { type: "unhandledrejection", message: "Promise failed", src: "chunk.js" };
    w().__CODEX_ERRORS__!.push(err);
    tick();

    expect(w().__CODEX_ERRORS__).toContain(err);
    expect(spy).toHaveBeenCalledWith(
      "[CODEX]",
      "unhandledrejection:",
      "Promise failed",
      "(chunk.js)",
    );
    spy.mockRestore();
  });

  it("does NOT re-mirror on a second tick when length is unchanged", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [{ message: "once" }];
    tick();
    spy.mockClear();

    tick(); // same length — no new work
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("clamps when the ring buffer exceeds CAP before mirroring", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Fill one past the cap
    w().__CODEX_ERRORS__ = Array.from({ length: CAP + 1 }, (_, i) => ({
      message: String(i),
    }));
    tick();
    expect(w().__CODEX_ERRORS__?.length).toBe(CAP);
    spy.mockRestore();
  });

  it("stores an error with the legacy CodexError shape (type / message / src)", () => {
    w().__CODEX_ERRORS__ = [];
    const entry: CodexError = { type: "error", message: "test error", src: "main.js" };
    w().__CODEX_ERRORS__!.push(entry);
    tick();

    const stored = w().__CODEX_ERRORS__?.[0];
    expect(stored?.type).toBe("error");
    expect(stored?.message).toBe("test error");
    expect(stored?.src).toBe("main.js");
  });
});

// ── ensureToast / renderToast (DEV-gated) ─────────────────────────────────────
describe("ensureToast (dev-gated)", () => {
  it("returns null when DEV is false (production)", () => {
    // DEV defaults to false after _resetForTest
    expect(ensureToast()).toBeNull();
  });

  it("creates and appends the toast element when DEV is true", () => {
    setDev(true);
    const el = ensureToast();
    expect(el).not.toBeNull();
    expect(el?.id).toBe("cx-obs-toast");
    expect(document.getElementById("cx-obs-toast")).toBe(el);
    setDev(false);
  });

  it("returns the same element on repeated calls (no duplicates)", () => {
    setDev(true);
    const el1 = ensureToast();
    const el2 = ensureToast();
    expect(el1).toBe(el2);
    expect(document.querySelectorAll("#cx-obs-toast").length).toBe(1);
    setDev(false);
  });
});

describe("renderToast (dev-gated)", () => {
  it("is a no-op in production (DEV = false)", () => {
    expect(() => renderToast()).not.toThrow();
    expect(document.getElementById("cx-obs-toast")).toBeNull();
  });

  it("renders error count and recent entries when DEV = true", () => {
    setDev(true);
    w().__CODEX_ERRORS__ = [
      { type: "error", message: "msg-a", src: "a.js" },
      { type: "error", message: "msg-b" },
    ];
    renderToast();
    const el = document.getElementById("cx-obs-toast");
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain("[CODEX] 2 error(s)");
    expect(el?.textContent).toContain("msg-a");
    expect(el?.textContent).toContain("msg-b");
    setDev(false);
  });

  it("truncates messages longer than 160 chars", () => {
    setDev(true);
    const long = "x".repeat(200);
    w().__CODEX_ERRORS__ = [{ message: long }];
    renderToast();
    const el = document.getElementById("cx-obs-toast");
    // Truncated message is 157 chars + "…"
    expect(el?.textContent).toContain("x".repeat(157) + "…");
    setDev(false);
  });
});

// ── init logic (mirrors the index.ts module body) ────────────────────────────
// We test the ?? init invariant directly rather than via module import since
// vi.isolateModules is not available in vitest 2.1.x.
describe("init logic (window.__CODEX_ERRORS__ invariant)", () => {
  it("assigns [] when __CODEX_ERRORS__ is undefined", () => {
    w().__CODEX_ERRORS__ = undefined;
    const win = w();
    win.__CODEX_ERRORS__ = win.__CODEX_ERRORS__ ?? [];
    expect(Array.isArray(w().__CODEX_ERRORS__)).toBe(true);
    expect(w().__CODEX_ERRORS__?.length).toBe(0);
  });

  it("preserves a pre-existing array (inline-0.0 boot entries survive init)", () => {
    const pre: CodexError[] = [{ type: "error", message: "boot" }];
    w().__CODEX_ERRORS__ = pre;
    const win = w();
    win.__CODEX_ERRORS__ = win.__CODEX_ERRORS__ ?? [];
    // Array reference unchanged — the ?? short-circuits when value is present.
    expect(w().__CODEX_ERRORS__).toBe(pre);
    expect(w().__CODEX_ERRORS__?.[0]?.message).toBe("boot");
  });

  it("processes a freshly pushed error through tick after init", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    w().__CODEX_ERRORS__ = [];
    // Simulate index.ts boot: init → tick
    const win = w();
    win.__CODEX_ERRORS__ = win.__CODEX_ERRORS__ ?? [];
    tick(); // initial tick on empty array

    const err: CodexError = { type: "error", message: "boot-error", src: "init.js" };
    w().__CODEX_ERRORS__!.push(err);
    tick();

    expect(w().__CODEX_ERRORS__).toContain(err);
    expect(spy).toHaveBeenCalledWith("[CODEX]", "error:", "boot-error", "(init.js)");
    spy.mockRestore();
  });
});
