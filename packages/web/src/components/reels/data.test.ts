// Pure-logic tests for the reels deck module. cardKey is deterministic so
// ground-truth values were captured by reading the legacy code directly.
// TYPE_ORDER, DECK_KEY, and SEEN_KEY are constant contracts.
import { describe, it, expect, beforeEach } from "vitest";
import { cardKey, TYPE_ORDER, DECK_KEY, SEEN_KEY, State } from "./data.js";
import type { ReelCard } from "./reels-window.js";

beforeEach(() => {
  // Reset the module-scope State between tests so tests are isolated.
  State.deck = [];
  State.curated = null;
  State.seen = null;
  State.busy = false;
  State.listeners = new Set();
});

describe("cardKey (ground truth from legacy)", () => {
  it("returns type:id when id is present", () => {
    const card: ReelCard = { type: "light-verse", id: "abc123" };
    expect(cardKey(card)).toBe("light-verse:abc123");
  });

  it("returns type:anchor:title when id is absent but anchor and title are", () => {
    const card: ReelCard = { type: "symbol", anchor: "gen.1", title: "Creation" };
    expect(cardKey(card)).toBe("symbol:gen.1:Creation");
  });

  it("uses x as anchor placeholder when anchor is absent", () => {
    const card: ReelCard = { type: "question", title: "What is this?" };
    expect(cardKey(card)).toBe("question:x:What is this?");
  });

  it("uses empty string for both when anchor and title are absent", () => {
    const card: ReelCard = { type: "counting" };
    expect(cardKey(card)).toBe("counting:x:");
  });

  it("truncates title to 32 characters", () => {
    const long = "abcdefghijklmnopqrstuvwxyz1234567890";
    const card: ReelCard = { type: "counting", title: long };
    expect(cardKey(card)).toBe(`counting:x:${long.slice(0, 32)}`);
  });

  it("prefers id over anchor+title when both are present", () => {
    const card: ReelCard = { type: "art-verse", id: "x1", anchor: "jhn.3", title: "Love" };
    expect(cardKey(card)).toBe("art-verse:x1");
  });
});

describe("TYPE_ORDER", () => {
  it("has exactly 10 rotation slots", () => {
    expect(TYPE_ORDER.length).toBe(10);
  });

  it("includes all expected card types", () => {
    const types = Array.from(TYPE_ORDER) as string[];
    expect(types).toContain("light-verse");
    expect(types).toContain("symbol");
    expect(types).toContain("name-of-god");
    expect(types).toContain("did-you-know");
    expect(types).toContain("art-verse");
    expect(types).toContain("parable-3");
    expect(types).toContain("prophecy-pair");
    expect(types).toContain("counting");
    expect(types).toContain("question");
    expect(types).toContain("quest-tease");
  });
});

describe("localStorage key constants", () => {
  it("DECK_KEY matches the legacy value", () => {
    expect(DECK_KEY).toBe("codex.reels.deck.v1");
  });

  it("SEEN_KEY matches the legacy value", () => {
    expect(SEEN_KEY).toBe("codex.reels.seen.v1");
  });
});
