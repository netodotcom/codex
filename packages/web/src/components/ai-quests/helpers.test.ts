// Node environment: tests pure functions only. Functions that touch
// window/localStorage (emitDepth, hasAiKey, getTweaks, encodeShare,
// tryImportFromHash) are exercised in the jsdom tests.
import { describe, it, expect } from "vitest";
import {
  extractJson,
  newQuestId,
  stateKey,
  answersKey,
  draftKey,
  SAVED_KEY,
  SUGGESTED,
} from "./helpers.js";

// ── extractJson ───────────────────────────────────────────────────────────────
describe("extractJson (ground truth)", () => {
  it("returns null for empty / null / undefined input", () => {
    expect(extractJson(null)).toBeNull();
    expect(extractJson("")).toBeNull();
    expect(extractJson(undefined)).toBeNull();
    expect(extractJson("   ")).toBeNull();
  });

  it("parses clean JSON object", () => {
    expect(extractJson('{"title":"test","steps":[]}')).toEqual({
      title: "test",
      steps: [],
    });
  });

  it("strips ```json...``` code fence", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("strips plain ``` fence", () => {
    expect(extractJson("```\n{\"b\":2}\n```")).toEqual({ b: 2 });
  });

  it("extracts JSON object from noisy prefix text", () => {
    expect(extractJson('Here is your quest:\n{"x":42}')).toEqual({ x: 42 });
  });

  it("returns null for a bare JSON array (not an object)", () => {
    expect(extractJson('["a","b"]')).toBeNull();
  });

  it("returns null for a JSON number", () => {
    expect(extractJson("42")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(extractJson("not json at all")).toBeNull();
  });

  it("handles nested objects faithfully", () => {
    const input = JSON.stringify({
      title: "Test Quest",
      steps: [{ n: 1, passage: "Gen 1:1" }],
    });
    const result = extractJson(input);
    expect(result).not.toBeNull();
    expect(result!["title"]).toBe("Test Quest");
  });
});

// ── key helpers ───────────────────────────────────────────────────────────────
describe("stateKey / answersKey / draftKey", () => {
  it("produce the correct storage keys", () => {
    expect(stateKey("q_abc")).toBe("codex.quest.q_abc.state");
    expect(answersKey("q_abc")).toBe("codex.quest.q_abc.answers");
    expect(draftKey("q_abc")).toBe("codex.quest.q_abc.draft");
  });

  it("embed the quest id verbatim", () => {
    const id = "q_xyz_12345";
    expect(stateKey(id)).toContain(id);
    expect(answersKey(id)).toContain(id);
    expect(draftKey(id)).toContain(id);
  });
});

describe("SAVED_KEY", () => {
  it("matches the legacy namespace", () => {
    expect(SAVED_KEY).toBe("codex.quests.completed");
  });
});

// ── newQuestId ────────────────────────────────────────────────────────────────
describe("newQuestId", () => {
  it("starts with q_", () => {
    expect(newQuestId()).toMatch(/^q_/);
  });

  it("is at least 10 characters long", () => {
    expect(newQuestId().length).toBeGreaterThan(9);
  });

  it("generates unique ids across 30 calls", () => {
    const ids = new Set(Array.from({ length: 30 }, () => newQuestId()));
    expect(ids.size).toBe(30);
  });
});

// ── SUGGESTED ─────────────────────────────────────────────────────────────────
describe("SUGGESTED", () => {
  it("has exactly 6 entries (same as legacy)", () => {
    expect(SUGGESTED).toHaveLength(6);
  });

  it("first entry matches legacy verbatim", () => {
    expect(SUGGESTED[0]).toBe("Trace covenant from Abraham to Christ");
  });

  it("last entry matches legacy verbatim", () => {
    expect(SUGGESTED[5]).toBe("Wisdom about suffering across the Bible");
  });
});
