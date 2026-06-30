// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isFn,
  CODEX_BOOT_CONTRACT,
  fail,
  checkOnce,
  runWithRetry,
  start,
  _resetForTest,
} from "./helpers.js";
import { DEADLINE_MS, INTERVAL_MS } from "./types.js";
import type { BootCodexError } from "./types.js";

// ── Typed window accessor ─────────────────────────────────────────────────────
type TestWindow = Window & {
  __CODEX_ERRORS__?: BootCodexError[];
  __CODEX_READY__?: boolean;
  CODEX_BOOT_CONTRACT?: unknown;
  // Checked globals
  BIBLE?: unknown;
  CODEX_DATA?: unknown;
  CODEX_PLUGINS_API?: unknown;
  CODEX_PANELS?: unknown;
  CODEX_SEARCH?: unknown;
  codexJumpToRef?: unknown;
};
const w = (): TestWindow => window as unknown as TestWindow;

// ── Fixtures ──────────────────────────────────────────────────────────────────
function installAllGlobals(): void {
  w().BIBLE = { loadChapter: () => {} };
  w().CODEX_DATA = { books: ["Genesis"] };
  w().CODEX_PLUGINS_API = { register: () => {} };
  w().CODEX_PANELS = { load: () => {}, cacheKey: () => {} };
  w().CODEX_SEARCH = { search: () => {} };
  w().codexJumpToRef = () => {};
}

function clearAllGlobals(): void {
  w().BIBLE = undefined;
  w().CODEX_DATA = undefined;
  w().CODEX_PLUGINS_API = undefined;
  w().CODEX_PANELS = undefined;
  w().CODEX_SEARCH = undefined;
  w().codexJumpToRef = undefined;
}

// ── Reset between tests ───────────────────────────────────────────────────────
beforeEach(() => {
  _resetForTest();
  clearAllGlobals();
  w().__CODEX_ERRORS__ = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── isFn ──────────────────────────────────────────────────────────────────────
describe("isFn", () => {
  it("returns true for arrow functions", () => {
    expect(isFn(() => {})).toBe(true);
  });

  it("returns true for regular functions", () => {
    expect(isFn(function () {})).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFn(null)).toBe(false);
  });

  it("returns false for numbers", () => {
    expect(isFn(42)).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isFn("fn")).toBe(false);
  });

  it("returns false for plain objects", () => {
    expect(isFn({})).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isFn([])).toBe(false);
  });
});

// ── CODEX_BOOT_CONTRACT manifest ──────────────────────────────────────────────
describe("CODEX_BOOT_CONTRACT structure", () => {
  it("has baselineSha = null (Phase-0 placeholder)", () => {
    expect(CODEX_BOOT_CONTRACT.baselineSha).toBeNull();
  });

  it("has events = [] (Phase-3 placeholder, intentionally empty for Phase 0)", () => {
    expect(Array.isArray(CODEX_BOOT_CONTRACT.events)).toBe(true);
    expect(CODEX_BOOT_CONTRACT.events).toHaveLength(0);
  });

  it("has exactly 6 globals in declaration order", () => {
    expect(CODEX_BOOT_CONTRACT.globals.map((g) => g.name)).toEqual([
      "BIBLE",
      "CODEX_DATA",
      "CODEX_PLUGINS_API",
      "CODEX_PANELS",
      "CODEX_SEARCH",
      "codexJumpToRef",
    ]);
  });

  it("assigns phase:'js' to the five synchronous-script globals", () => {
    const jsPhase = CODEX_BOOT_CONTRACT.globals
      .filter((g) => g.phase === "js")
      .map((g) => g.name);
    expect(jsPhase).toEqual([
      "BIBLE",
      "CODEX_DATA",
      "CODEX_PLUGINS_API",
      "CODEX_PANELS",
      "CODEX_SEARCH",
    ]);
  });

  it("assigns phase:'jsx' only to codexJumpToRef (set in a useEffect)", () => {
    const jsxPhase = CODEX_BOOT_CONTRACT.globals
      .filter((g) => g.phase === "jsx")
      .map((g) => g.name);
    expect(jsxPhase).toEqual(["codexJumpToRef"]);
  });
});

// ── Shape predicates ──────────────────────────────────────────────────────────
describe("BIBLE shape predicate", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "BIBLE")!.shape;

  it("passes when loadChapter is a function", () => {
    expect(pred()({ loadChapter: () => {} })).toBe(true);
  });

  it("fails on null", () => {
    expect(pred()(null)).toBe(false);
  });

  it("fails on undefined", () => {
    expect(pred()(undefined)).toBe(false);
  });

  it("fails when loadChapter is absent", () => {
    expect(pred()({})).toBe(false);
  });

  it("fails when loadChapter is a string, not a function", () => {
    expect(pred()({ loadChapter: "not-a-fn" })).toBe(false);
  });
});

describe("CODEX_DATA shape predicate", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "CODEX_DATA")!.shape;

  it("passes when books is a non-empty array", () => {
    expect(pred()({ books: ["Genesis"] })).toBe(true);
  });

  it("fails when books is an empty array", () => {
    expect(pred()({ books: [] })).toBe(false);
  });

  it("fails when books is absent", () => {
    expect(pred()({})).toBe(false);
  });

  it("fails on null", () => {
    expect(pred()(null)).toBe(false);
  });
});

describe("CODEX_PLUGINS_API shape predicate", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "CODEX_PLUGINS_API")!.shape;

  it("passes when register is a function", () => {
    expect(pred()({ register: () => {} })).toBe(true);
  });

  it("fails when register is absent", () => {
    expect(pred()({})).toBe(false);
  });

  it("fails on null", () => {
    expect(pred()(null)).toBe(false);
  });
});

describe("CODEX_PANELS shape predicate", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "CODEX_PANELS")!.shape;

  it("passes when load and cacheKey are both functions", () => {
    expect(pred()({ load: () => {}, cacheKey: () => {} })).toBe(true);
  });

  it("fails when only load is present", () => {
    expect(pred()({ load: () => {} })).toBe(false);
  });

  it("fails when only cacheKey is present", () => {
    expect(pred()({ cacheKey: () => {} })).toBe(false);
  });

  it("fails on null", () => {
    expect(pred()(null)).toBe(false);
  });
});

describe("CODEX_SEARCH shape predicate — `search` not `query`", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "CODEX_SEARCH")!.shape;

  it("passes when search is a function", () => {
    expect(pred()({ search: () => {} })).toBe(true);
  });

  // NOTE: preserved from legacy — real API is `search` (search.js:622), not `query`
  it("fails when only query is present (wrong API surface)", () => {
    expect(pred()({ query: () => {} })).toBe(false);
  });

  it("fails when search is absent", () => {
    expect(pred()({})).toBe(false);
  });

  it("fails on null", () => {
    expect(pred()(null)).toBe(false);
  });
});

describe("codexJumpToRef shape predicate", () => {
  const pred = (): ((v: unknown) => boolean) =>
    CODEX_BOOT_CONTRACT.globals.find((g) => g.name === "codexJumpToRef")!.shape;

  it("passes when the value itself is a function", () => {
    expect(pred()(() => {})).toBe(true);
  });

  it("fails for null", () => {
    expect(pred()(null)).toBe(false);
  });

  it("fails for a plain object", () => {
    expect(pred()({})).toBe(false);
  });
});

// ── fail ──────────────────────────────────────────────────────────────────────
describe("fail", () => {
  it("pushes an entry with type='boot-contract' and correct message", () => {
    fail("BIBLE", "missing");
    const entry = w().__CODEX_ERRORS__?.[0];
    expect(entry?.type).toBe("boot-contract");
    expect(entry?.message).toBe("[boot-contract] missing: BIBLE");
    expect(entry?.src).toBe("");
  });

  it("includes a numeric `when` timestamp", () => {
    fail("CODEX_DATA", "malformed");
    const entry = w().__CODEX_ERRORS__?.[0];
    expect(typeof entry?.when).toBe("number");
    expect((entry?.when ?? 0) > 0).toBe(true);
  });

  it("formats 'malformed' failures correctly", () => {
    fail("CODEX_SEARCH", "malformed");
    expect(w().__CODEX_ERRORS__?.[0]?.message).toBe(
      "[boot-contract] malformed: CODEX_SEARCH",
    );
  });

  it("is a no-op (does not throw) when __CODEX_ERRORS__ is undefined", () => {
    w().__CODEX_ERRORS__ = undefined;
    expect(() => fail("X", "missing")).not.toThrow();
  });
});

// ── checkOnce ─────────────────────────────────────────────────────────────────
describe("checkOnce", () => {
  it("returns all 6 globals as missing when none are set", () => {
    const result = checkOnce();
    expect(result).toHaveLength(6);
    expect(result.map((r) => r.name)).toEqual([
      "BIBLE",
      "CODEX_DATA",
      "CODEX_PLUGINS_API",
      "CODEX_PANELS",
      "CODEX_SEARCH",
      "codexJumpToRef",
    ]);
    expect(result.every((r) => r.why === "missing")).toBe(true);
  });

  it("returns empty when all globals pass their shape predicates", () => {
    installAllGlobals();
    expect(checkOnce()).toHaveLength(0);
  });

  it("reports 'missing' for null global value", () => {
    installAllGlobals();
    w().CODEX_DATA = null;
    const result = checkOnce();
    expect(result.find((r) => r.name === "CODEX_DATA")?.why).toBe("missing");
  });

  it("reports 'malformed' when global exists but fails its shape predicate", () => {
    installAllGlobals();
    w().BIBLE = {}; // no loadChapter → malformed
    const result = checkOnce();
    expect(result.find((r) => r.name === "BIBLE")?.why).toBe("malformed");
  });

  // NOTE: preserved from legacy — CODEX_SEARCH checks `search`, not `query`
  it("reports 'malformed' for CODEX_SEARCH when only `query` is present", () => {
    installAllGlobals();
    w().CODEX_SEARCH = { query: () => {} };
    const result = checkOnce();
    expect(result.find((r) => r.name === "CODEX_SEARCH")?.why).toBe("malformed");
  });

  it("passes CODEX_SEARCH only when `search` is present", () => {
    installAllGlobals();
    w().CODEX_SEARCH = { search: () => {} };
    expect(checkOnce()).toHaveLength(0);
  });

  it("returns only the failing globals (partial pass)", () => {
    // Install everything except codexJumpToRef (simulates in-between jsx phase)
    w().BIBLE = { loadChapter: () => {} };
    w().CODEX_DATA = { books: ["Genesis"] };
    w().CODEX_PLUGINS_API = { register: () => {} };
    w().CODEX_PANELS = { load: () => {}, cacheKey: () => {} };
    w().CODEX_SEARCH = { search: () => {} };
    // codexJumpToRef absent
    const result = checkOnce();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("codexJumpToRef");
  });
});

// ── runWithRetry ──────────────────────────────────────────────────────────────
describe("runWithRetry", () => {
  it("sets __CODEX_READY__ = true immediately when all globals pass", () => {
    installAllGlobals();
    runWithRetry(Date.now());
    expect(w().__CODEX_READY__).toBe(true);
  });

  it("does NOT set __CODEX_READY__ while within the deadline", () => {
    vi.useFakeTimers();
    runWithRetry(Date.now());
    expect(w().__CODEX_READY__).toBeUndefined();
  });

  it("sets __CODEX_READY__ = false and logs when deadline is exceeded", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Pass a startedAt already past the deadline
    runWithRetry(Date.now() - DEADLINE_MS - 1);
    expect(w().__CODEX_READY__).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      "[CODEX] boot-contract: globals missing/malformed after " + DEADLINE_MS + "ms",
    );
  });

  it("pushes error entries for every missing global when deadline is exceeded", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    runWithRetry(Date.now() - DEADLINE_MS - 1);
    const errors = w().__CODEX_ERRORS__ ?? [];
    expect(errors.some((e) => e.type === "boot-contract")).toBe(true);
    // All 6 globals should have a failure entry
    const names = errors
      .filter((e) => e.type === "boot-contract")
      .map((e) => e.message?.split(": ")[1]);
    expect(names).toContain("BIBLE");
    expect(names).toContain("codexJumpToRef");
  });

  it("retries and sets __CODEX_READY__ = true once globals appear", () => {
    vi.useFakeTimers();
    runWithRetry(Date.now()); // all missing → schedules retry
    expect(w().__CODEX_READY__).toBeUndefined();

    installAllGlobals();
    vi.advanceTimersByTime(INTERVAL_MS + 10); // fire the retry
    expect(w().__CODEX_READY__).toBe(true);
  });

  it("uses INTERVAL_MS (150ms) between retry attempts", () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, "setTimeout");
    runWithRetry(Date.now());
    // The first retry should be scheduled at exactly INTERVAL_MS
    expect(spy).toHaveBeenCalledWith(expect.any(Function), INTERVAL_MS);
  });
});

// ── start ─────────────────────────────────────────────────────────────────────
describe("start", () => {
  it("sets __CODEX_READY__ = true immediately when globals are present", () => {
    installAllGlobals();
    start();
    expect(w().__CODEX_READY__).toBe(true);
  });

  it("does not set __CODEX_READY__ when globals are absent (queues retry)", () => {
    vi.useFakeTimers();
    start();
    expect(w().__CODEX_READY__).toBeUndefined();
  });
});

// ── init invariants (mirrors index.ts boot sequence) ─────────────────────────
describe("init invariants", () => {
  it("assigns [] when __CODEX_ERRORS__ is undefined", () => {
    w().__CODEX_ERRORS__ = undefined;
    const win = w();
    win.__CODEX_ERRORS__ = win.__CODEX_ERRORS__ ?? [];
    expect(Array.isArray(w().__CODEX_ERRORS__)).toBe(true);
    expect(w().__CODEX_ERRORS__).toHaveLength(0);
  });

  it("preserves a pre-existing __CODEX_ERRORS__ array (inline-0.0 entries survive init)", () => {
    const pre: BootCodexError[] = [{ type: "error", message: "pre-boot" }];
    w().__CODEX_ERRORS__ = pre;
    const win = w();
    win.__CODEX_ERRORS__ = win.__CODEX_ERRORS__ ?? [];
    // Array reference unchanged — the ?? short-circuits when value is present.
    expect(w().__CODEX_ERRORS__).toBe(pre);
    expect(w().__CODEX_ERRORS__?.[0]?.message).toBe("pre-boot");
  });

  it("exposes CODEX_BOOT_CONTRACT on window (as if index.ts ran)", () => {
    // Simulate the index.ts SET step
    w().CODEX_BOOT_CONTRACT = CODEX_BOOT_CONTRACT;
    expect(w().CODEX_BOOT_CONTRACT).toBe(CODEX_BOOT_CONTRACT);
    expect(
      (w().CODEX_BOOT_CONTRACT as typeof CODEX_BOOT_CONTRACT).baselineSha,
    ).toBeNull();
  });
});
