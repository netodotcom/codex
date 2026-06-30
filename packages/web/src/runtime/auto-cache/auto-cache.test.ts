// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadFlag,
  saveFlag,
  primaryTranslation,
  emit,
  warmUp,
  schedule,
  FLAG_LS,
  TWEAKS_LS,
  DEFAULT_TRANSLATION,
} from "./helpers.js";
import type { BibleBook, BibleEngine, CacheStats, ProgressInfo } from "./types.js";
import { acw } from "./auto-cache-window.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// jsdom's built-in localStorage shim can be unreliable; install a real in-memory one.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem: (k: string, v: string): void => {
        store[k] = String(v);
      },
      removeItem: (k: string): void => {
        delete store[k];
      },
      clear: (): void => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  });
}

// ── BIBLE stub builder ────────────────────────────────────────────────────────

const SAMPLE_BOOKS: BibleBook[] = [
  { chapters: 50 },
  { chapters: 40 },
];

type DownloadAllReturn = unknown;

function makeBible(opts: {
  downloadAllReturn?: DownloadAllReturn;
  cacheStatsFully?: boolean;
  cacheStatsCached?: number;
  cacheStatsTotal?: number;
  downloadAllFn?: (
    t: string,
    b: BibleBook[],
    p: (i: ProgressInfo) => void,
  ) => DownloadAllReturn;
} = {}): BibleEngine {
  const {
    downloadAllReturn = Promise.resolve(),
    cacheStatsFully = false,
    cacheStatsCached = 0,
    cacheStatsTotal = 90,
    downloadAllFn,
  } = opts;

  return {
    downloadAll(
      t: string,
      b: BibleBook[],
      p: (i: ProgressInfo) => void,
    ): DownloadAllReturn {
      if (downloadAllFn) return downloadAllFn(t, b, p);
      return downloadAllReturn;
    },
    cacheStats(_t: string, _b: BibleBook[]): CacheStats {
      return { fully: cacheStatsFully, cached: cacheStatsCached, total: cacheStatsTotal };
    },
  };
}

function installBible(bible: BibleEngine): void {
  acw().BIBLE = bible;
}

function installCodexData(books: BibleBook[] = SAMPLE_BOOKS): void {
  acw().CODEX_DATA = { books };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  installStorage();
  // Clear BIBLE and CODEX_DATA between tests.
  acw().BIBLE = undefined;
  acw().CODEX_DATA = undefined;
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── loadFlag ──────────────────────────────────────────────────────────────────

describe("loadFlag", () => {
  it("returns default when nothing stored", () => {
    expect(loadFlag()).toEqual({ done: [], at: 0 });
  });

  it("returns default on corrupt JSON", () => {
    localStorage.setItem(FLAG_LS, "{broken");
    expect(loadFlag()).toEqual({ done: [], at: 0 });
  });

  it("returns default when stored value is null JSON", () => {
    localStorage.setItem(FLAG_LS, "null");
    expect(loadFlag()).toEqual({ done: [], at: 0 });
  });

  it("returns parsed flag when valid", () => {
    const flag = { done: ["kjv"], at: 12345 };
    localStorage.setItem(FLAG_LS, JSON.stringify(flag));
    expect(loadFlag()).toEqual(flag);
  });
});

// ── saveFlag ──────────────────────────────────────────────────────────────────

describe("saveFlag", () => {
  it("persists the flag to localStorage", () => {
    const flag = { done: ["niv"], at: 99 };
    saveFlag(flag);
    expect(JSON.parse(localStorage.getItem(FLAG_LS) ?? "null")).toEqual(flag);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveFlag({ done: [], at: 0 })).not.toThrow();
  });
});

// ── primaryTranslation ────────────────────────────────────────────────────────

describe("primaryTranslation", () => {
  it(`returns '${DEFAULT_TRANSLATION}' when nothing stored`, () => {
    expect(primaryTranslation()).toBe(DEFAULT_TRANSLATION);
  });

  it("returns stored primaryTranslation from tweaks", () => {
    localStorage.setItem(TWEAKS_LS, JSON.stringify({ primaryTranslation: "niv" }));
    expect(primaryTranslation()).toBe("niv");
  });

  it(`returns '${DEFAULT_TRANSLATION}' on corrupt tweaks JSON`, () => {
    localStorage.setItem(TWEAKS_LS, "{bad");
    expect(primaryTranslation()).toBe(DEFAULT_TRANSLATION);
  });

  it(`returns '${DEFAULT_TRANSLATION}' when tweaks has no primaryTranslation`, () => {
    localStorage.setItem(TWEAKS_LS, JSON.stringify({ someOtherKey: true }));
    expect(primaryTranslation()).toBe(DEFAULT_TRANSLATION);
  });
});

// ── emit ──────────────────────────────────────────────────────────────────────

describe("emit", () => {
  it("dispatches a CustomEvent with the given name and detail", () => {
    const captured: CustomEvent[] = [];
    window.addEventListener("codex:autocache-start", (e) => {
      captured.push(e as CustomEvent);
    });
    emit("codex:autocache-start", { translation: "kjv", total: 90 });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.detail).toEqual({ translation: "kjv", total: 90 });
  });

  it("does not throw when dispatchEvent fails", () => {
    vi.spyOn(window, "dispatchEvent").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => emit("codex:autocache-start", {})).not.toThrow();
  });
});

// ── warmUp ────────────────────────────────────────────────────────────────────

describe("warmUp", () => {
  it("returns immediately when translation is already done", async () => {
    localStorage.setItem(FLAG_LS, JSON.stringify({ done: ["kjv"], at: 1 }));
    const spy = vi.spyOn(window, "dispatchEvent");
    await warmUp();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns without error after 50 retries when BIBLE never arrives", async () => {
    vi.useFakeTimers();
    // Neither BIBLE nor CODEX_DATA is set.
    const spy = vi.spyOn(window, "dispatchEvent");
    const promise = warmUp();
    // 50 retries × 200 ms = 10 000 ms.
    await vi.advanceTimersByTimeAsync(10_500);
    await promise;
    expect(spy).not.toHaveBeenCalled();
  });

  it("emits done and saves flag when cacheStats reports fully cached", async () => {
    vi.useFakeTimers();
    installBible(makeBible({ cacheStatsFully: true, cacheStatsCached: 90, cacheStatsTotal: 90 }));
    installCodexData();

    const events: Array<{ name: string; detail: unknown }> = [];
    window.addEventListener("codex:autocache-done", (e) => {
      events.push({ name: "codex:autocache-done", detail: (e as CustomEvent).detail });
    });

    const promise = warmUp();
    // No timers needed — cacheStats check is synchronous (no retry needed).
    await vi.runAllTimersAsync();
    await promise;

    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toMatchObject({ translation: "kjv", done: 90, total: 90 });
    expect(loadFlag().done).toContain("kjv");
  });

  it("emits start + done and saves flag when downloadAll returns a thenable", async () => {
    vi.useFakeTimers();
    installBible(makeBible({ downloadAllReturn: Promise.resolve(), cacheStatsFully: false }));
    installCodexData();

    const events: string[] = [];
    window.addEventListener("codex:autocache-start", () => events.push("start"));
    window.addEventListener("codex:autocache-done", () => events.push("done"));

    const promise = warmUp();
    // Advance past the 4 000 ms stagger.
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(events).toEqual(["start", "done"]);
    expect(loadFlag().done).toContain("kjv");
  });

  it("awaits ctrl.done when downloadAll returns a controller object with a done promise", async () => {
    vi.useFakeTimers();
    let resolveDone!: () => void;
    const donePromise = new Promise<void>((r) => { resolveDone = r; });
    installBible(makeBible({ downloadAllReturn: { done: donePromise } }));
    installCodexData();

    const events: string[] = [];
    window.addEventListener("codex:autocache-done", () => events.push("done"));

    const warmUpPromise = warmUp();
    // Advance past the 4 000 ms stagger and resolve the done promise.
    await vi.advanceTimersByTimeAsync(5_000);
    resolveDone();
    await warmUpPromise;

    expect(events).toContain("done");
    expect(loadFlag().done).toContain("kjv");
  });

  it("uses poll fallback when downloadAll returns a non-thenable", async () => {
    vi.useFakeTimers();
    let pollCount = 0;
    // Define inline so downloadAll explicitly returns null (non-thenable) and
    // cacheStats is mocked without destructuring-default interference.
    const bible: BibleEngine = {
      downloadAll() { return null; }, // null != null is false → poll branch
      cacheStats() {
        pollCount++;
        return { fully: pollCount >= 5, cached: pollCount * 18, total: 90 };
      },
    };
    installBible(bible);
    installCodexData();

    const events: string[] = [];
    window.addEventListener("codex:autocache-done", () => events.push("done"));

    const warmUpPromise = warmUp();
    // Advance past stagger + poll iterations.
    await vi.advanceTimersByTimeAsync(10_000);
    await warmUpPromise;

    expect(events).toContain("done");
    expect(loadFlag().done).toContain("kjv");
    expect(pollCount).toBeGreaterThanOrEqual(5);
  });

  it("emits error when downloadAll rejects", async () => {
    vi.useFakeTimers();
    // Create the rejection lazily inside downloadAll so Node.js does not flag
    // it as an unhandled rejection before the try/catch in warmUp catches it.
    const bible: BibleEngine = {
      downloadAll() { return Promise.reject(new Error("network failure")); },
      cacheStats() { return { fully: false }; },
    };
    installBible(bible);
    installCodexData();

    const errorEvents: unknown[] = [];
    window.addEventListener("codex:autocache-error", (e) => {
      errorEvents.push((e as CustomEvent).detail);
    });

    const promise = warmUp();
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0] as Record<string, unknown>)["error"]).toContain("network failure");
    // Flag must NOT be saved on error.
    expect(loadFlag().done).not.toContain("kjv");
  });

  it("throttles tick events to at most 1 per 200 ms", async () => {
    vi.useFakeTimers();
    let capturedProgress!: (info: ProgressInfo) => void;
    const bible: BibleEngine = {
      downloadAll(_t, _b, onProgress) {
        capturedProgress = onProgress;
        return Promise.resolve();
      },
      cacheStats() { return { fully: false }; },
    };
    installBible(bible);
    installCodexData();

    const ticks: unknown[] = [];
    window.addEventListener("codex:autocache-tick", (e) => ticks.push((e as CustomEvent).detail));

    const promise = warmUp();
    await vi.advanceTimersByTimeAsync(4_001);

    // Fire 10 rapid progress calls within the same ms.
    for (let i = 1; i <= 10; i++) capturedProgress({ done: i });
    // Only 1 tick should have fired (throttle gate: >200 ms apart).
    expect(ticks.length).toBeLessThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(300);
    // A second burst, now >200 ms later.
    for (let i = 11; i <= 20; i++) capturedProgress({ done: i });
    expect(ticks.length).toBeLessThanOrEqual(2);

    await promise;
  });

  it("respects per-user primaryTranslation from TWEAKS_LS", async () => {
    vi.useFakeTimers();
    localStorage.setItem(TWEAKS_LS, JSON.stringify({ primaryTranslation: "niv" }));
    installBible(makeBible({ cacheStatsFully: true, cacheStatsCached: 5, cacheStatsTotal: 5 }));
    installCodexData();

    const events: Array<Record<string, unknown>> = [];
    window.addEventListener("codex:autocache-done", (e) => {
      events.push((e as CustomEvent).detail as Record<string, unknown>);
    });

    const promise = warmUp();
    await vi.runAllTimersAsync();
    await promise;

    expect(events[0]?.["translation"]).toBe("niv");
    expect(loadFlag().done).toContain("niv");
  });

  it("computes total as sum of book.chapters", async () => {
    vi.useFakeTimers();
    const books: BibleBook[] = [{ chapters: 10 }, { chapters: 5 }, {}];
    installBible(makeBible({ downloadAllReturn: Promise.resolve() }));
    installCodexData(books);

    const startEvents: Array<Record<string, unknown>> = [];
    window.addEventListener("codex:autocache-start", (e) => {
      startEvents.push((e as CustomEvent).detail as Record<string, unknown>);
    });

    const promise = warmUp();
    await vi.advanceTimersByTimeAsync(5_000);
    await promise;

    // 10 + 5 + (undefined ?? 0) = 15
    expect(startEvents[0]?.["total"]).toBe(15);
  });
});

// ── schedule ──────────────────────────────────────────────────────────────────

describe("schedule", () => {
  it("fires warmUp via setTimeout when requestIdleCallback is absent", () => {
    vi.useFakeTimers();
    // Ensure requestIdleCallback is not available.
    const origRic = (window as unknown as Record<string, unknown>)["requestIdleCallback"];
    delete (window as unknown as Record<string, unknown>)["requestIdleCallback"];

    const spy = vi.spyOn({ warmUp }, "warmUp").mockResolvedValue(undefined);
    // schedule() calls setTimeout(start, 4000) — we verify the timer is registered.
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    schedule();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000);

    // Restore
    (window as unknown as Record<string, unknown>)["requestIdleCallback"] = origRic;
    spy.mockRestore();
  });

  it("fires warmUp via requestIdleCallback when available", () => {
    vi.useFakeTimers();
    const calls: Array<[IdleRequestCallback, IdleRequestOptions]> = [];
    (window as unknown as Record<string, unknown>)["requestIdleCallback"] = (
      cb: IdleRequestCallback,
      opts: IdleRequestOptions,
    ): number => {
      calls.push([cb, opts]);
      return 1;
    };

    schedule();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toEqual({ timeout: 6000 });

    // Cleanup
    delete (window as unknown as Record<string, unknown>)["requestIdleCallback"];
  });
});

// ── index.ts — window.CODEX_AUTOCACHE contract ───────────────────────────────

describe("index.ts — window.CODEX_AUTOCACHE assignment", () => {
  it("sets window.CODEX_AUTOCACHE with state, reset, and runNow", async () => {
    vi.useFakeTimers();
    // Clear any previous assignment.
    acw().CODEX_AUTOCACHE = undefined;
    await import("./index.js");
    const api = acw().CODEX_AUTOCACHE;
    expect(typeof api?.state).toBe("function");
    expect(typeof api?.reset).toBe("function");
    expect(typeof api?.runNow).toBe("function");
  });

  it("state() returns the current localStorage flag", async () => {
    const flag = { done: ["kjv"], at: 42 };
    localStorage.setItem(FLAG_LS, JSON.stringify(flag));
    const { acw: getAcw } = await import("./auto-cache-window.js");
    expect(getAcw().CODEX_AUTOCACHE?.state()).toEqual(flag);
  });

  it("reset() removes the flag from localStorage", async () => {
    localStorage.setItem(FLAG_LS, JSON.stringify({ done: ["kjv"], at: 1 }));
    const { acw: getAcw } = await import("./auto-cache-window.js");
    getAcw().CODEX_AUTOCACHE?.reset();
    expect(localStorage.getItem(FLAG_LS)).toBeNull();
  });

  it("runNow() returns a promise", async () => {
    vi.useFakeTimers();
    installBible(makeBible({ cacheStatsFully: true }));
    installCodexData();
    const { acw: getAcw } = await import("./auto-cache-window.js");
    const result = getAcw().CODEX_AUTOCACHE?.runNow();
    expect(result).toBeInstanceOf(Promise);
    await vi.runAllTimersAsync();
    await result;
  });
});
