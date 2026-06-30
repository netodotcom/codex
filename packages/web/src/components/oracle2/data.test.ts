// oracle2 — thread-persistence unit tests (node environment).
// Ground truth captured from the faithful port; assertions match the legacy
// oracle2.jsx behaviour exactly.
import { describe, it, expect, beforeEach } from "vitest";
import {
  ORACLE2_THREADS_KEY,
  ORACLE2_LEGACY_KEY,
  ORACLE2_ACTIVE_KEY,
  ORACLE2_MAX_MSGS,
  ORACLE2_MAX_THREADS,
  oracle2NewThread,
  oracle2DeriveTitle,
  oracle2LoadThreads,
  oracle2SaveThreads,
} from "./data.js";
import type { OracleMsg, OracleThread } from "./data.js";

// ── Minimal in-memory localStorage shim ──────────────────────────────────────
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: makeStorage() });
});

// ── oracle2NewThread ──────────────────────────────────────────────────────────
describe("oracle2NewThread", () => {
  it("returns a fresh thread with an id, empty msgs, and title 'new thread'", () => {
    const t = oracle2NewThread();
    expect(typeof t.id).toBe("string");
    expect(t.id.startsWith("t_")).toBe(true);
    expect(t.title).toBe("new thread");
    expect(t.msgs).toEqual([]);
    expect(typeof t.updatedAt).toBe("number");
  });

  it("generates unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => oracle2NewThread().id));
    expect(ids.size).toBe(20);
  });
});

// ── oracle2DeriveTitle ────────────────────────────────────────────────────────
describe("oracle2DeriveTitle", () => {
  it("returns 'new thread' for an empty array", () => {
    expect(oracle2DeriveTitle([])).toBe("new thread");
  });

  it("returns 'new thread' when there is no user message", () => {
    const msgs: OracleMsg[] = [{ role: "oracle", content: "hello" }];
    expect(oracle2DeriveTitle(msgs)).toBe("new thread");
  });

  it("takes the first user message, trims, collapses whitespace, slices to 28", () => {
    const msgs: OracleMsg[] = [
      { role: "user", content: "  What  is  the  meaning   of   John   3:16  in context? Extra words here!" },
    ];
    const title = oracle2DeriveTitle(msgs);
    // trim → "What  is  the  meaning   of   John   3:16..."
    // collapse → "What is the meaning of John 3:16 in context? Extra words here!"
    // slice(0, 28) → "What is the meaning of John " (28 chars, trailing space preserved)
    expect(title.length).toBeLessThanOrEqual(28);
    expect(title).toBe("What is the meaning of John ");
  });

  it("returns 'new thread' when the first user content is empty", () => {
    const msgs: OracleMsg[] = [{ role: "user", content: "   " }];
    expect(oracle2DeriveTitle(msgs)).toBe("new thread");
  });

  it("uses the FIRST user message, not later ones", () => {
    const msgs: OracleMsg[] = [
      { role: "oracle", content: "greetings" },
      { role: "user", content: "First question" },
      { role: "user", content: "Second question" },
    ];
    expect(oracle2DeriveTitle(msgs)).toBe("First question");
  });
});

// ── oracle2LoadThreads ────────────────────────────────────────────────────────
describe("oracle2LoadThreads", () => {
  it("returns a single new thread when storage is empty", () => {
    const threads = oracle2LoadThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]!.title).toBe("new thread");
    expect(threads[0]!.msgs).toEqual([]);
  });

  it("loads valid threads from ORACLE2_THREADS_KEY", () => {
    const stored: OracleThread[] = [
      { id: "t_abc", title: "thread one", msgs: [{ role: "user", content: "hello" }], updatedAt: 1 },
    ];
    localStorage.setItem(ORACLE2_THREADS_KEY, JSON.stringify(stored));
    const threads = oracle2LoadThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]!.id).toBe("t_abc");
    expect(threads[0]!.title).toBe("thread one");
  });

  it("filters out invalid thread entries", () => {
    const stored = [
      { id: "t_1", title: "ok", msgs: [], updatedAt: 1 },
      { id: "", title: "no-id", msgs: [], updatedAt: 2 },   // invalid — empty id
      null,                                                   // invalid
      { title: "no-msgs", updatedAt: 3 },                    // invalid — no msgs
    ];
    localStorage.setItem(ORACLE2_THREADS_KEY, JSON.stringify(stored));
    const threads = oracle2LoadThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]!.id).toBe("t_1");
  });

  it("caps to ORACLE2_MAX_THREADS", () => {
    const stored: OracleThread[] = Array.from({ length: 20 }, (_, i) => ({
      id: `t_${i}`,
      title: `thread ${i}`,
      msgs: [],
      updatedAt: i,
    }));
    localStorage.setItem(ORACLE2_THREADS_KEY, JSON.stringify(stored));
    const threads = oracle2LoadThreads();
    expect(threads.length).toBeLessThanOrEqual(ORACLE2_MAX_THREADS);
  });

  it("migrates from the v10 legacy key when threads key is absent", () => {
    const legacyMsgs: OracleMsg[] = [
      { role: "user", content: "What does Genesis 1:1 mean?" },
      { role: "oracle", content: "In the beginning…" },
    ];
    localStorage.setItem(ORACLE2_LEGACY_KEY, JSON.stringify(legacyMsgs));
    const threads = oracle2LoadThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]!.msgs).toEqual(legacyMsgs);
    // "What does Genesis 1:1 mean?" is 27 chars → fits within 28 → full string
    expect(threads[0]!.title).toBe("What does Genesis 1:1 mean?");
  });
});

// ── oracle2SaveThreads ────────────────────────────────────────────────────────
describe("oracle2SaveThreads", () => {
  it("persists threads and activeId to localStorage", () => {
    const threads: OracleThread[] = [
      { id: "t_1", title: "hello", msgs: [], updatedAt: 0 },
    ];
    oracle2SaveThreads(threads, "t_1");
    const raw = JSON.parse(localStorage.getItem(ORACLE2_THREADS_KEY) || "[]") as OracleThread[];
    expect(raw).toHaveLength(1);
    expect(raw[0]!.id).toBe("t_1");
    expect(localStorage.getItem(ORACLE2_ACTIVE_KEY)).toBe("t_1");
  });

  it(`trims msgs to ORACLE2_MAX_MSGS (${ORACLE2_MAX_MSGS}) per thread`, () => {
    const bigMsgs: OracleMsg[] = Array.from({ length: ORACLE2_MAX_MSGS + 10 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));
    const threads: OracleThread[] = [{ id: "t_big", title: "big", msgs: bigMsgs, updatedAt: 0 }];
    oracle2SaveThreads(threads, "t_big");
    const raw = JSON.parse(localStorage.getItem(ORACLE2_THREADS_KEY) || "[]") as OracleThread[];
    expect(raw[0]!.msgs.length).toBe(ORACLE2_MAX_MSGS);
  });

  it("caps saved threads to ORACLE2_MAX_THREADS", () => {
    const many: OracleThread[] = Array.from({ length: ORACLE2_MAX_THREADS + 5 }, (_, i) => ({
      id: `t_${i}`,
      title: `t${i}`,
      msgs: [],
      updatedAt: i,
    }));
    oracle2SaveThreads(many, "t_0");
    const raw = JSON.parse(localStorage.getItem(ORACLE2_THREADS_KEY) || "[]") as OracleThread[];
    expect(raw.length).toBe(ORACLE2_MAX_THREADS);
  });

  it("does not throw when localStorage is unavailable", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem() { throw new Error("unavailable"); },
        getItem() { return null; },
        removeItem() {},
        clear() {},
        length: 0,
        key() { return null; },
      },
    });
    expect(() => oracle2SaveThreads([], "")).not.toThrow();
  });
});
