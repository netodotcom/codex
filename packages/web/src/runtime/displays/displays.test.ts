// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SURFACES,
  surfaceForWid,
  parseDisplayParams,
  buildDisplaysApi,
  installChannelSync,
  bootSurface,
} from "./helpers.js";
import { dw } from "./displays-window.js";
import type { DisplaysWindow } from "./displays-window.js";

// ── BroadcastChannel mock ─────────────────────────────────────────────────────
// jsdom does not ship BroadcastChannel. Install a minimal shim before each test.

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null;
  posted: unknown[] = [];

  constructor(public readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void { this.posted.push(data); }

  /** Helper: deliver a message to this channel's onmessage handler. */
  deliver(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

function installFakeBroadcastChannel(): void {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
}

function lastChannel(): FakeBroadcastChannel | undefined {
  return FakeBroadcastChannel.instances[FakeBroadcastChannel.instances.length - 1];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setWindowProp<K extends keyof DisplaysWindow>(
  key: K,
  value: DisplaysWindow[K],
): void {
  Object.defineProperty(window, key, { configurable: true, writable: true, value });
}

beforeEach(() => {
  // Reset relevant window globals between tests.
  setWindowProp("__CXDISPLAYS", undefined);
  setWindowProp("codexDisplays", undefined);
  setWindowProp("CODEX_NOW", undefined);
  setWindowProp("__CODEX_READY__", undefined);
  setWindowProp("codexJumpToRef", undefined);
  setWindowProp("codexDesk", undefined);
  setWindowProp("codexOpenPanel", undefined);
  setWindowProp("codexOpenConstellation", undefined);
  document.body.className = "";
  document.title = "";
  installFakeBroadcastChannel();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── surfaceForWid ─────────────────────────────────────────────────────────────

describe("surfaceForWid", () => {
  it("returns null for null input", () => {
    expect(surfaceForWid(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(surfaceForWid(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(surfaceForWid("")).toBeNull();
  });

  it("maps win:sys:reader → reader", () => {
    expect(surfaceForWid("win:sys:reader")).toBe("reader");
  });

  it("maps win:sys:library → library", () => {
    expect(surfaceForWid("win:sys:library")).toBe("library");
  });

  it("maps win:sys:oracle → oracle", () => {
    expect(surfaceForWid("win:sys:oracle")).toBe("oracle");
  });

  it("maps win:sys:marks → marks", () => {
    expect(surfaceForWid("win:sys:marks")).toBe("marks");
  });

  it("maps const → galaxy", () => {
    expect(surfaceForWid("const")).toBe("galaxy");
  });

  it("maps win:builtin:trans → trans", () => {
    expect(surfaceForWid("win:builtin:trans")).toBe("trans");
  });

  it("maps win:builtin:talmud → talmud", () => {
    expect(surfaceForWid("win:builtin:talmud")).toBe("talmud");
  });

  it("maps win:builtin:gem → gem", () => {
    expect(surfaceForWid("win:builtin:gem")).toBe("gem");
  });

  it("returns null for unknown win:builtin id", () => {
    expect(surfaceForWid("win:builtin:nonexistent")).toBeNull();
  });

  it("returns null for completely unknown id", () => {
    expect(surfaceForWid("win:unknown:foo")).toBeNull();
  });
});

// ── parseDisplayParams ────────────────────────────────────────────────────────

describe("parseDisplayParams", () => {
  it("no params → surface null, follow false", () => {
    const p = parseDisplayParams(new URLSearchParams(""));
    expect(p.surface).toBeNull();
    expect(p.follow).toBe(false);
  });

  it("?surface=reader → surface reader, follow true (legacy: surface implies follow)", () => {
    const p = parseDisplayParams(new URLSearchParams("surface=reader"));
    expect(p.surface).toBe("reader");
    expect(p.follow).toBe(true);
  });

  it("?follow=1 → surface null, follow true", () => {
    const p = parseDisplayParams(new URLSearchParams("follow=1"));
    expect(p.surface).toBeNull();
    expect(p.follow).toBe(true);
  });

  it("?surface=galaxy&follow=1 → surface galaxy, follow true", () => {
    const p = parseDisplayParams(new URLSearchParams("surface=galaxy&follow=1"));
    expect(p.surface).toBe("galaxy");
    expect(p.follow).toBe(true);
  });

  it("?follow=0 → follow false", () => {
    const p = parseDisplayParams(new URLSearchParams("follow=0"));
    expect(p.follow).toBe(false);
  });

  it("?surface=trans → surface trans, follow true", () => {
    const p = parseDisplayParams(new URLSearchParams("surface=trans"));
    expect(p.surface).toBe("trans");
    expect(p.follow).toBe(true);
  });
});

// ── buildDisplaysApi ──────────────────────────────────────────────────────────

describe("buildDisplaysApi", () => {
  it("surface() returns the parsed surface", () => {
    const api = buildDisplaysApi({ surface: "oracle", follow: true });
    expect(api.surface()).toBe("oracle");
  });

  it("surface() returns null when no ?surface=", () => {
    const api = buildDisplaysApi({ surface: null, follow: false });
    expect(api.surface()).toBeNull();
  });

  it("isFollower() returns follow flag", () => {
    expect(buildDisplaysApi({ surface: null, follow: true }).isFollower()).toBe(true);
    expect(buildDisplaysApi({ surface: null, follow: false }).isFollower()).toBe(false);
  });

  it("surfaces contains all known surface keys", () => {
    const api = buildDisplaysApi({ surface: null, follow: false });
    const keys = Object.keys(SURFACES);
    expect(api.surfaces).toEqual(keys);
  });

  it("surfaceForWid works through the API", () => {
    const api = buildDisplaysApi({ surface: null, follow: false });
    expect(api.surfaceForWid("win:sys:reader")).toBe("reader");
    expect(api.surfaceForWid("const")).toBe("galaxy");
    expect(api.surfaceForWid("unknown")).toBeNull();
  });

  describe("open()", () => {
    it("returns false for unknown surface", () => {
      const api = buildDisplaysApi({ surface: null, follow: false });
      expect(api.open("nonexistent")).toBe(false);
    });

    it("calls window.open with popup features for a known surface", () => {
      const mockOpen = vi.fn().mockReturnValue(null);
      vi.stubGlobal("open", mockOpen);
      const api = buildDisplaysApi({ surface: null, follow: false });
      const result = api.open("reader");
      expect(result).toBe(true);
      expect(mockOpen).toHaveBeenCalledOnce();
      const [url, target, features] = mockOpen.mock.calls[0] as [string, string, string];
      expect(url).toContain("?surface=reader&follow=1");
      expect(target).toBe("codex-display-reader");
      expect(features).toContain("popup=yes");
    });

    it("returns false when window.open throws", () => {
      vi.stubGlobal("open", vi.fn().mockImplementation(() => { throw new Error("blocked"); }));
      const api = buildDisplaysApi({ surface: null, follow: false });
      expect(api.open("library")).toBe(false);
    });

    it("encodes the surface name in the URL", () => {
      const mockOpen = vi.fn().mockReturnValue(null);
      vi.stubGlobal("open", mockOpen);
      const api = buildDisplaysApi({ surface: null, follow: false });
      api.open("galaxy");
      const [url] = mockOpen.mock.calls[0] as [string, ...unknown[]];
      expect(url).toContain("surface=galaxy");
    });
  });
});

// ── bootSurface ───────────────────────────────────────────────────────────────

describe("bootSurface", () => {
  it("returns without effect for unknown surface", () => {
    vi.useFakeTimers();
    bootSurface("nonexistent");
    vi.advanceTimersByTime(500);
    expect(document.body.classList.length).toBe(0);
  });

  it("does nothing until __CODEX_READY__ is true", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", false);
    bootSurface("reader");
    vi.advanceTimersByTime(5000);  // many ticks, still not ready
    expect(document.body.classList.contains("cx-display-reader")).toBe(false);
  });

  it("adds cx-display-<surface> class to body when ready", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    bootSurface("reader");
    vi.advanceTimersByTime(250);
    expect(document.body.classList.contains("cx-display-reader")).toBe(true);
  });

  it("sets document.title to CODEX · <LABEL>", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    bootSurface("library");
    vi.advanceTimersByTime(250);
    expect(document.title).toBe("CODEX · LIBRARY");
  });

  it("calls the surface descriptor open()", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    const openFn = vi.fn();
    setWindowProp("codexDesk", { on: () => false, state: () => ({}), open: openFn, close: vi.fn() });
    bootSurface("library");
    vi.advanceTimersByTime(250);
    // library.open() delegates to codexDesk.open("library")
    expect(openFn).toHaveBeenCalledWith("library");
  });

  it("closes non-target panels when desk is on", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    const closeFn = vi.fn();
    setWindowProp("codexDesk", {
      on: () => true,
      state: () => ({ reader: true, library: true, oracle: false, marks: true }),
      open: vi.fn(),
      close: closeFn,
    });
    bootSurface("oracle");
    vi.advanceTimersByTime(250);
    // oracle surface: reader closed (not reader, not galaxy), library + marks closed
    expect(closeFn).toHaveBeenCalledWith("reader");
    expect(closeFn).toHaveBeenCalledWith("library");
    expect(closeFn).toHaveBeenCalledWith("marks");
    expect(closeFn).not.toHaveBeenCalledWith("oracle");
  });

  it("does NOT close reader on reader surface", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    const closeFn = vi.fn();
    setWindowProp("codexDesk", {
      on: () => true,
      state: () => ({ reader: true, library: true }),
      open: vi.fn(),
      close: closeFn,
    });
    bootSurface("reader");
    vi.advanceTimersByTime(250);
    expect(closeFn).not.toHaveBeenCalledWith("reader");
  });

  it("does NOT close reader on galaxy surface (galaxy exception)", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    const closeFn = vi.fn();
    setWindowProp("codexDesk", {
      on: () => true,
      state: () => ({ reader: true, library: true }),
      open: vi.fn(),
      close: closeFn,
    });
    const openConstellation = vi.fn();
    setWindowProp("codexOpenConstellation", openConstellation);
    bootSurface("galaxy");
    vi.advanceTimersByTime(250);
    expect(closeFn).not.toHaveBeenCalledWith("reader");
    expect(openConstellation).toHaveBeenCalled();
  });

  it("bails out after 120 ticks with no readiness (30 s timeout)", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", false);
    bootSurface("reader");
    // 120 ticks × 250 ms = 30 000 ms
    vi.advanceTimersByTime(30_000 + 250);
    expect(document.body.classList.contains("cx-display-reader")).toBe(false);
  });

  it("calls codexOpenPanel for panel surfaces (e.g. trans)", () => {
    vi.useFakeTimers();
    setWindowProp("__CODEX_READY__", true);
    const openPanel = vi.fn();
    setWindowProp("codexOpenPanel", openPanel);
    bootSurface("trans");
    vi.advanceTimersByTime(250);
    expect(openPanel).toHaveBeenCalledWith("trans");
    expect(document.title).toBe("CODEX · TRANSLATIONS");
  });
});

// ── installChannelSync ────────────────────────────────────────────────────────

describe("installChannelSync", () => {
  it("creates a BroadcastChannel named codex-displays", () => {
    installChannelSync();
    const ch = lastChannel();
    expect(ch).toBeDefined();
    expect(ch?.name).toBe("codex-displays");
  });

  it("posts {kind:now, ref} on codex:now event when CODEX_NOW.ref is set", () => {
    installChannelSync();
    setWindowProp("CODEX_NOW", { ref: "Gen.1.1" });
    window.dispatchEvent(new CustomEvent("codex:now"));
    const ch = lastChannel();
    expect(ch?.posted).toHaveLength(1);
    expect(ch?.posted[0]).toEqual({ kind: "now", ref: "Gen.1.1" });
  });

  it("does not post when CODEX_NOW.ref is absent", () => {
    installChannelSync();
    setWindowProp("CODEX_NOW", { ref: undefined });
    window.dispatchEvent(new CustomEvent("codex:now"));
    expect(lastChannel()?.posted).toHaveLength(0);
  });

  it("calls codexJumpToRef when a now message arrives with a different ref", () => {
    installChannelSync();
    const jump = vi.fn();
    setWindowProp("codexJumpToRef", jump);
    setWindowProp("CODEX_NOW", { ref: "Gen.1.1" });
    lastChannel()?.deliver({ kind: "now", ref: "Exo.1.1" });
    expect(jump).toHaveBeenCalledWith("Exo.1.1");
  });

  it("does not call codexJumpToRef when ref matches current (echo guard)", () => {
    installChannelSync();
    const jump = vi.fn();
    setWindowProp("codexJumpToRef", jump);
    setWindowProp("CODEX_NOW", { ref: "Gen.1.1" });
    lastChannel()?.deliver({ kind: "now", ref: "Gen.1.1" });
    expect(jump).not.toHaveBeenCalled();
  });

  it("ignores messages with wrong kind", () => {
    installChannelSync();
    const jump = vi.fn();
    setWindowProp("codexJumpToRef", jump);
    lastChannel()?.deliver({ kind: "other", ref: "Gen.1.1" });
    expect(jump).not.toHaveBeenCalled();
  });

  it("ignores messages with missing ref", () => {
    installChannelSync();
    const jump = vi.fn();
    setWindowProp("codexJumpToRef", jump);
    lastChannel()?.deliver({ kind: "now" });
    expect(jump).not.toHaveBeenCalled();
  });

  it("does not call jump when codexJumpToRef is not set", () => {
    installChannelSync();
    setWindowProp("CODEX_NOW", { ref: "Gen.1.1" });
    // codexJumpToRef is undefined — should not throw
    expect(() => {
      lastChannel()?.deliver({ kind: "now", ref: "Exo.1.1" });
    }).not.toThrow();
  });

  it("does not re-post while applying (prevents echo loop)", () => {
    vi.useFakeTimers();
    installChannelSync();
    const jump = vi.fn();
    setWindowProp("codexJumpToRef", jump);
    setWindowProp("CODEX_NOW", { ref: "Gen.1.1" });

    // Simulate incoming message — sets applying=true
    lastChannel()?.deliver({ kind: "now", ref: "Exo.1.1" });

    // Simulate codex:now firing while applying
    window.dispatchEvent(new CustomEvent("codex:now"));
    expect(lastChannel()?.posted).toHaveLength(0);  // suppressed by applying guard

    // After 150 ms applying is released
    vi.advanceTimersByTime(150);
    window.dispatchEvent(new CustomEvent("codex:now"));
    // Now it can post
    expect(lastChannel()?.posted).toHaveLength(1);
  });
});
