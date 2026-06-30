// @vitest-environment jsdom
// jsdom env: loadProgress/saveProgress need localStorage; emitDepth/emitQuestStep
// dispatch CustomEvents on window. Ground-truth values captured from a faithful
// copy of the originals running in node.
import { describe, it, expect, beforeEach } from "vitest";
import {
  groupBySection,
  splitRefs,
  expandRefs,
  loadProgress,
  saveProgress,
} from "./helpers.js";
import { CARDS } from "./data.js";
import type { ProphecyCard, QuestProgress } from "./data.js";

// Install an in-memory Storage so loadProgress / saveProgress actually round-trip.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] ?? null : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
});

// ── groupBySection (ground truth) ────────────────────────────────────────────

describe("groupBySection (ground truth)", () => {
  it("groups CARDS into 5 sections in order", () => {
    const groups = groupBySection(CARDS);
    expect(groups.length).toBe(5);
    expect(groups[0]?.section).toBe("The Promised Seed & Royal Lineage");
    expect(groups[0]?.cards.length).toBe(10);
    expect(groups[1]?.section).toBe("Birth & Forerunner");
    expect(groups[1]?.cards.length).toBe(5);
    expect(groups[2]?.section).toBe("Ministry & Character");
    expect(groups[2]?.cards.length).toBe(10);
    expect(groups[3]?.section).toBe("Betrayal & Suffering");
    expect(groups[3]?.cards.length).toBe(10);
    expect(groups[4]?.section).toBe("Death, Resurrection & Exaltation");
    expect(groups[4]?.cards.length).toBe(15);
  });

  it("total cards across all groups equals CARDS.length (50)", () => {
    const groups = groupBySection(CARDS);
    const total = groups.reduce((n, g) => n + g.cards.length, 0);
    expect(total).toBe(CARDS.length);
    expect(CARDS.length).toBe(50);
  });

  it("handles an empty array", () => {
    expect(groupBySection([])).toEqual([]);
  });

  it("handles a single card", () => {
    const card: ProphecyCard = {
      id: "x", section: "S", number: 1, title: "T",
      ot_reference: "Gen 1", nt_reference: "Mat 1", talmud_references: [],
      commentary: "", common_objection: "", comeback: "",
    };
    const groups = groupBySection([card]);
    expect(groups.length).toBe(1);
    expect(groups[0]?.section).toBe("S");
    expect(groups[0]?.cards[0]).toBe(card);
  });
});

// ── splitRefs (ground truth) ──────────────────────────────────────────────────

describe("splitRefs (ground truth)", () => {
  it("splits semicolon-separated refs", () => {
    expect(splitRefs("Genesis 3:15; 22:18")).toEqual(["Genesis 3:15", "22:18"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitRefs("")).toEqual([]);
  });

  it("handles a single ref with no semicolons", () => {
    expect(splitRefs("Micah 5:2")).toEqual(["Micah 5:2"]);
  });

  it("trims whitespace around parts", () => {
    expect(splitRefs("Isaiah 7:14;  9:6")).toEqual(["Isaiah 7:14", "9:6"]);
  });

  it("filters empty parts from trailing semicolons", () => {
    expect(splitRefs("Genesis 3:15;")).toEqual(["Genesis 3:15"]);
  });
});

// ── expandRefs (ground truth) ─────────────────────────────────────────────────

describe("expandRefs (ground truth)", () => {
  it("leaves standalone refs unchanged", () => {
    expect(expandRefs("Micah 5:2")).toEqual(["Micah 5:2"]);
  });

  it("passes through multiple named refs unchanged", () => {
    expect(expandRefs("Matthew 1:1; Galatians 3:16")).toEqual(["Matthew 1:1", "Galatians 3:16"]);
  });

  it("prefixes a bare chapter:verse with the last seen book", () => {
    expect(expandRefs("Genesis 12:3; 22:18")).toEqual(["Genesis 12:3", "Genesis 22:18"]);
  });

  it("inherits book across multiple bare refs", () => {
    expect(expandRefs("Psalm 22:1; 22:16; 22:18")).toEqual(["Psalm 22:1", "Psalm 22:16", "Psalm 22:18"]);
  });

  it("returns empty array for empty string", () => {
    expect(expandRefs("")).toEqual([]);
  });

  it("does not inherit book if no prior named ref exists", () => {
    // "22:18" with no prior book — stays as-is (first char is digit but lastBook is null)
    expect(expandRefs("22:18")).toEqual(["22:18"]);
  });
});

// ── loadProgress / saveProgress (ground truth) ──────────────────────────────

describe("loadProgress / saveProgress (ground truth)", () => {
  it("returns defaults when localStorage has no entry", () => {
    expect(loadProgress()).toEqual({ studied: [], lastIdx: 0 });
  });

  it("round-trips through localStorage", () => {
    const p: QuestProgress = { studied: ["prophecy_01", "prophecy_02"], lastIdx: 5 };
    saveProgress(p);
    expect(loadProgress()).toEqual(p);
  });

  it("merges partial saved state with defaults", () => {
    localStorage.setItem("codex.quest.messiah-50.progress", JSON.stringify({ lastIdx: 7 }));
    const loaded = loadProgress();
    expect(loaded.lastIdx).toBe(7);
    expect(loaded.studied).toEqual([]);
  });

  it("returns defaults when localStorage entry is corrupt JSON", () => {
    localStorage.setItem("codex.quest.messiah-50.progress", "{corrupt");
    expect(loadProgress()).toEqual({ studied: [], lastIdx: 0 });
  });
});
