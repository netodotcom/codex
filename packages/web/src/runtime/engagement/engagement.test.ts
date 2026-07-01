// @vitest-environment jsdom
// Engagement — faithful-port tests. Expectations are derived directly from the
// legacy/engagement.js logic; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  loadStats, loadStreak, loadUnlocked, checkAchievements,
  recordDay, getDailyDiscovery, streakWarning,
  timeOfDaySuggestion, engagementScore, hashDate,
  ACHIEVEMENTS, CURATED_DAILY,
} from "./helpers-engage.js";
import {
  record, continuity, continuityStatus, mastery,
  milestones, unlockMilestone, nextThread,
  loadContinuity, loadMastery, loadCounters,
  getConfig, setConfig, lsLogAll, clearState,
  levelForScore, DOMAINS, DEPTH_ACTIONS, MASTERY_LEVELS,
  tickContinuity,
} from "./helpers-engagement.js";
import { ew } from "./engagement-window.js";

// ── localStorage mock (jsdom's built-in shim is unreliable) ──────────────────
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}
installStorage();

// Import the entry point to assign all three window globals (mirrors runtime boot).
beforeAll(async () => {
  await import("./index.js");
});

// Clear all engagement state before each test so tests are isolated.
beforeEach(() => {
  clearState();
  // Also clear the CODEX_ENGAGE-layer keys that clearState doesn't touch.
  for (const k of [
    "codex.engagement.stats.v1",
    "codex.engagement.streak.v1",
    "codex.engagement.achievements.v1",
    "codex.engagement.daily.v1",
    "codex.engagement.session.v1",
    "codex.reels.likes.v1",
    "codex.engagement.oracle.v1",
  ]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// window globals contract
// ════════════════════════════════════════════════════════════════════════════════

describe("window.CODEX_ENGAGE (global contract)", () => {
  it("is set as object on window", () => {
    expect(typeof ew().CODEX_ENGAGE).toBe("object");
  });

  it("exposes all required method keys", () => {
    const api = ew().CODEX_ENGAGE;
    for (const k of [
      "loadStats", "loadStreak", "loadUnlocked", "loadSession", "saveSession",
      "recordDay", "checkAchievements", "getDailyDiscovery", "streakWarning",
      "timeOfDaySuggestion", "engagementScore",
      "requestNotifications", "fireNotification",
      "trackChapter", "trackHighlight", "trackNote", "trackOracle",
      "trackSearch", "trackPanel", "trackReel", "trackQuest", "trackSession",
      "isReelLiked", "toggleReelLike", "getReelLikes", "clearProfile", "buildReaderProfile",
    ]) {
      expect(typeof (api as unknown as Record<string, unknown>)?.[k]).toBe("function");
    }
  });

  it("exposes ACHIEVEMENTS as an array", () => {
    expect(Array.isArray(ew().CODEX_ENGAGE?.ACHIEVEMENTS)).toBe(true);
  });
});

describe("window.CODEX_ENGAGEMENT (global contract)", () => {
  it("is set as object on window", () => {
    expect(typeof ew().CODEX_ENGAGEMENT).toBe("object");
  });

  it("has VERSION '2.5.0'", () => {
    expect(ew().CODEX_ENGAGEMENT?.VERSION).toBe("2.5.0");
  });

  it("exposes all required method keys", () => {
    const api = ew().CODEX_ENGAGEMENT;
    for (const k of [
      "record", "emit", "continuity", "continuityStatus", "mastery",
      "milestones", "unlockMilestone", "nextThread",
      "listQuests", "getQuest", "startQuest", "advanceQuest", "questState",
      "listSeasons", "getConfig", "setConfig", "eventLog",
      "export", "import", "clear",
    ]) {
      expect(typeof (api as unknown as Record<string, unknown>)?.[k]).toBe("function");
    }
  });

  it("DOMAINS has 8 entries", () => {
    expect(ew().CODEX_ENGAGEMENT?.DOMAINS.length).toBe(8);
  });
});

describe("window.CODEX_QUESTGEN (global contract)", () => {
  it("is set as object on window", () => {
    expect(typeof ew().CODEX_QUESTGEN).toBe("object");
  });

  it("generate is null (reserved slot)", () => {
    expect(ew().CODEX_QUESTGEN?.generate).toBeNull();
  });

  it("register is a function", () => {
    expect(typeof ew().CODEX_QUESTGEN?.register).toBe("function");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// IIFE 1: Hook-Model Engine
// ════════════════════════════════════════════════════════════════════════════════

describe("loadStats() — defaults", () => {
  it("returns default shape with all numeric fields = 0", () => {
    const s = loadStats();
    expect(s.sessionCount).toBe(0);
    expect(s.totalChapters).toBe(0);
    expect(s.versesHighlighted).toBe(0);
    expect(s.notesCreated).toBe(0);
    expect(s.panelsViewed).toBe(0);
    expect(s.oracleQuestions).toBe(0);
    expect(s.searchesPerformed).toBe(0);
    expect(s.reelsViewed).toBe(0);
    expect(s.questsCompleted).toBe(0);
    expect(s.lastSession).toBeNull();
  });

  it("chaptersRead is an empty object", () => {
    expect(typeof loadStats().chaptersRead).toBe("object");
    expect(Object.keys(loadStats().chaptersRead)).toHaveLength(0);
  });
});

describe("loadStreak() — defaults", () => {
  it("current = 0, longest = 0, lastDate = null, history = {}", () => {
    const sk = loadStreak();
    expect(sk.current).toBe(0);
    expect(sk.longest).toBe(0);
    expect(sk.lastDate).toBeNull();
    expect(typeof sk.history).toBe("object");
  });
});

describe("recordDay()", () => {
  it("increments current streak on first call", () => {
    const sk = recordDay();
    expect(sk.current).toBe(1);
    expect(sk.longest).toBe(1);
    expect(sk.lastDate).not.toBeNull();
  });

  it("calling twice in the same day does NOT double-count", () => {
    recordDay();
    const sk = recordDay();
    expect(sk.current).toBe(1);  // still 1, already counted
  });

  it("history records today as true", () => {
    const sk = recordDay();
    const today = sk.lastDate!;
    expect(sk.history[today]).toBe(true);
  });
});

describe("streak math", () => {
  it("new day after yesterday advances streak by 1", () => {
    // Simulate yesterday's streak already being recorded in storage
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yISO = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, "0"),
      String(yesterday.getDate()).padStart(2, "0"),
    ].join("-");
    // Manually put yesterday's data into localStorage
    const existing = {
      current: 5, longest: 10, lastDate: yISO,
      history: { [yISO]: true },
    };
    localStorage.setItem("codex.engagement.streak.v1", JSON.stringify(existing));
    const sk = recordDay();
    expect(sk.current).toBe(6);   // streak continues
    expect(sk.longest).toBe(10);  // longest unchanged (was 10)
  });

  it("gap of 2+ days resets streak to 1", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const iso3 = threeDaysAgo.toISOString().slice(0, 10);
    const existing = { current: 7, longest: 20, lastDate: iso3, history: {} };
    localStorage.setItem("codex.engagement.streak.v1", JSON.stringify(existing));
    const sk = recordDay();
    expect(sk.current).toBe(1);   // reset
    expect(sk.longest).toBe(20);  // longest preserved
  });
});

describe("ACHIEVEMENTS array", () => {
  it("has 27 achievement definitions", () => {
    // legacy/engagement.js lines 132-169: 6 reading + 6 streak + 8 feature
    // discovery + 4 session + 3 investment-depth = 27 entries exactly.
    expect(ACHIEVEMENTS.length).toBe(27);
  });

  it("every achievement has id, title, desc, icon, tier, check", () => {
    for (const a of ACHIEVEMENTS) {
      expect(typeof a.id).toBe("string");
      expect(typeof a.title).toBe("string");
      expect(typeof a.desc).toBe("string");
      expect(typeof a.icon).toBe("string");
      expect(typeof a.tier).toBe("number");
      expect(typeof a.check).toBe("function");
    }
  });

  it("first_chapter unlocks when totalChapters >= 1", () => {
    const s = loadStats(); s.totalChapters = 1;
    const sk = loadStreak();
    const a = ACHIEVEMENTS.find(x => x.id === "first_chapter")!;
    expect(a.check(s, sk)).toBe(true);
  });

  it("streak_7 uses longest streak", () => {
    const s = loadStats();
    const sk = { ...loadStreak(), longest: 7 };
    const a = ACHIEVEMENTS.find(x => x.id === "streak_7")!;
    expect(a.check(s, sk)).toBe(true);
  });

  it("streak_7 doesn't fire for longest=6", () => {
    const s = loadStats();
    const sk = { ...loadStreak(), longest: 6 };
    const a = ACHIEVEMENTS.find(x => x.id === "streak_7")!;
    expect(a.check(s, sk)).toBe(false);
  });
});

describe("checkAchievements()", () => {
  it("returns empty array when no thresholds met", () => {
    expect(checkAchievements()).toHaveLength(0);
  });

  it("returns first_chapter on totalChapters=1", () => {
    localStorage.setItem(
      "codex.engagement.stats.v1",
      JSON.stringify({ ...loadStats(), totalChapters: 1 }),
    );
    const fresh = checkAchievements();
    expect(fresh.some(a => a.id === "first_chapter")).toBe(true);
  });

  it("same achievement not returned twice (idempotent)", () => {
    localStorage.setItem(
      "codex.engagement.stats.v1",
      JSON.stringify({ ...loadStats(), totalChapters: 1 }),
    );
    checkAchievements(); // first call unlocks
    const second = checkAchievements();
    expect(second.some(a => a.id === "first_chapter")).toBe(false);
  });
});

describe("hashDate() — deterministic seed", () => {
  it("returns a non-negative integer", () => {
    expect(hashDate("2024-01-01")).toBeGreaterThanOrEqual(0);
  });

  it("same date → same seed (deterministic)", () => {
    expect(hashDate("2025-06-15")).toBe(hashDate("2025-06-15"));
  });

  it("different dates → different seeds (with high probability)", () => {
    expect(hashDate("2025-01-01")).not.toBe(hashDate("2025-01-02"));
  });
});

describe("getDailyDiscovery()", () => {
  it("returns a discovery with type, title, ref, body, date, seed", () => {
    const d = getDailyDiscovery();
    expect(typeof d.type).toBe("string");
    expect(typeof d.title).toBe("string");
    expect(typeof d.ref).toBe("string");
    expect(typeof d.body).toBe("string");
    expect(typeof d.date).toBe("string");
    expect(typeof d.seed).toBe("number");
  });

  it("calling twice in the same day returns the same discovery", () => {
    const d1 = getDailyDiscovery();
    const d2 = getDailyDiscovery();
    expect(d1.seed).toBe(d2.seed);
    expect(d1.title).toBe(d2.title);
  });

  it("seed % CURATED_DAILY.length is always a valid index", () => {
    // Test with several arbitrary dates
    const dates = ["2024-01-01", "2024-06-15", "2025-12-31", "2026-06-29"];
    for (const date of dates) {
      const seed = hashDate(date);
      const idx = seed % CURATED_DAILY.length;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(CURATED_DAILY.length);
      expect(CURATED_DAILY[idx]).toBeDefined();
    }
  });
});

describe("streakWarning()", () => {
  it("returns null when streak is less than 2", () => {
    expect(streakWarning()).toBeNull();
  });

  it("returns null when already active today", () => {
    recordDay(); // marks today
    // manually set streak to 3 with today as lastDate
    const sk = loadStreak();
    sk.current = 3;
    localStorage.setItem("codex.engagement.streak.v1", JSON.stringify(sk));
    expect(streakWarning()).toBeNull();
  });

  it("returns warning when streak >= 2 and yesterday was last read day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yISO = yesterday.toISOString().slice(0, 10);
    const sk = { current: 5, longest: 5, lastDate: yISO, history: {} };
    localStorage.setItem("codex.engagement.streak.v1", JSON.stringify(sk));
    const w = streakWarning();
    expect(w).not.toBeNull();
    expect(w?.level).toBe("warn");
    expect(w?.current).toBe(5);
    expect(w?.msg).toContain("5");
  });
});

describe("timeOfDaySuggestion()", () => {
  it("returns an object with period, suggestion, book", () => {
    const t = timeOfDaySuggestion();
    expect(typeof t.period).toBe("string");
    expect(typeof t.suggestion).toBe("string");
    expect(typeof t.book).toBe("string");
  });

  it("period is one of the 4 expected values", () => {
    const t = timeOfDaySuggestion();
    expect(["morning", "afternoon", "evening", "night"]).toContain(t.period);
  });
});

describe("engagementScore()", () => {
  it("starts at 0 with no activity", () => {
    expect(engagementScore()).toBe(0);
  });

  it("reflects chapters (weight 2)", () => {
    localStorage.setItem(
      "codex.engagement.stats.v1",
      JSON.stringify({ ...loadStats(), totalChapters: 10 }),
    );
    expect(engagementScore()).toBe(20);
  });

  it("streak adds 5×longest + 3×current", () => {
    localStorage.setItem(
      "codex.engagement.streak.v1",
      JSON.stringify({ current: 3, longest: 7, lastDate: null, history: {} }),
    );
    // 5*7 + 3*3 = 35 + 9 = 44
    expect(engagementScore()).toBe(44);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// IIFE 2: Continuity & Mastery Engine
// ════════════════════════════════════════════════════════════════════════════════

describe("DOMAINS", () => {
  it("has exactly 8 domains", () => {
    expect(DOMAINS).toHaveLength(8);
  });

  it("includes all expected domain strings", () => {
    for (const d of [
      "hebrew-greek", "cross-references", "gematria", "talmud",
      "patristics", "gnosis", "geography", "canon-coverage",
    ]) {
      expect(DOMAINS).toContain(d);
    }
  });
});

describe("DEPTH_ACTIONS", () => {
  it("word-study-complete has weight=5 and domain=hebrew-greek", () => {
    expect(DEPTH_ACTIONS["word-study-complete"].weight).toBe(5);
    expect(DEPTH_ACTIONS["word-study-complete"].domain).toBe("hebrew-greek");
  });

  it("note-written has domain=null (cross-cutting)", () => {
    expect(DEPTH_ACTIONS["note-written"].domain).toBeNull();
  });

  it("quest-step has weight=3", () => {
    expect(DEPTH_ACTIONS["quest-step"].weight).toBe(3);
  });
});

describe("MASTERY_LEVELS", () => {
  it("has 6 levels (0-5)", () => {
    expect(MASTERY_LEVELS).toHaveLength(6);
  });

  it("level 0 starts at min=0 (Dormant)", () => {
    expect(MASTERY_LEVELS[0]?.min).toBe(0);
    expect(MASTERY_LEVELS[0]?.en).toBe("Dormant");
  });

  it("level 5 is Oracle-grade at min=700", () => {
    expect(MASTERY_LEVELS[5]?.min).toBe(700);
    expect(MASTERY_LEVELS[5]?.en).toBe("Oracle-grade");
  });
});

describe("levelForScore()", () => {
  it("score 0 → level 0 (Dormant)", () => {
    expect(levelForScore(0).level).toBe(0);
  });

  it("score 10 → level 1 (Tracking)", () => {
    expect(levelForScore(10).level).toBe(1);
  });

  it("score 40 → level 2 (Analyst)", () => {
    expect(levelForScore(40).level).toBe(2);
  });

  it("score 700 → level 5 (Oracle-grade)", () => {
    expect(levelForScore(700).level).toBe(5);
    expect(levelForScore(700).en).toBe("Oracle-grade");
  });

  it("score 9 is still level 0", () => {
    expect(levelForScore(9).level).toBe(0);
  });
});

describe("getConfig() / setConfig()", () => {
  it("defaults dailyThreshold to 1", () => {
    expect(getConfig().dailyThreshold).toBe(1);
  });

  it("setConfig updates dailyThreshold", () => {
    setConfig({ dailyThreshold: 3 });
    expect(getConfig().dailyThreshold).toBe(3);
  });

  it("dailyThreshold cannot be set below 1 (max(1, value))", () => {
    setConfig({ dailyThreshold: 0 });
    expect(getConfig().dailyThreshold).toBe(1);
  });
});

describe("tickContinuity() / continuityStatus()", () => {
  it("first tick: current=1, grace=0", () => {
    const st = tickContinuity();
    expect(st.current).toBe(1);
    expect(st.grace).toBe(0);
    expect(st.graceCap).toBe(2);
  });

  it("same-day ticks don't double-count", () => {
    tickContinuity();
    const st = tickContinuity();
    expect(st.current).toBe(1);
  });

  it("countedToday is true after threshold met", () => {
    const st = tickContinuity();
    expect(st.countedToday).toBe(true);
  });
});

describe("continuity() read-only display", () => {
  it("returns a ContinuityStatus with all required fields", () => {
    const st = continuity();
    expect(typeof st.current).toBe("number");
    expect(typeof st.longest).toBe("number");
    expect(typeof st.grace).toBe("number");
    expect(typeof st.graceCap).toBe("number");
    expect(typeof st.nextGraceIn).toBe("number");
    expect(typeof st.statusKey).toBe("string");
    expect(typeof st.statusText).toBe("string");
  });

  it("nextGraceIn starts at 7 (GRACE_EVERY)", () => {
    const st = continuity();
    expect(st.nextGraceIn).toBe(7);
  });
});

describe("mastery()", () => {
  it("mastery() with no args returns all 8 domains", () => {
    const m = mastery();
    expect(typeof m).toBe("object");
    // should have keys for all 8 domains
    for (const d of DOMAINS) {
      expect(d in (m as Record<string, unknown>)).toBe(true);
    }
  });

  it("mastery('gematria') returns a single cell with levelLabel", () => {
    const cell = mastery("gematria") as { domain: string; score: number; levelLabel: string };
    expect(cell.domain).toBe("gematria");
    expect(typeof cell.score).toBe("number");
    expect(typeof cell.levelLabel).toBe("string");
  });

  it("fresh mastery score is 0, level is 0 (Dormant)", () => {
    const cell = mastery("hebrew-greek") as { score: number; level: number };
    expect(cell.score).toBe(0);
    expect(cell.level).toBe(0);
  });
});

describe("record()", () => {
  it("returns null for missing type", () => {
    expect(record({ type: "" })).toBeNull();
    expect(record({} as { type: string })).toBeNull();
  });

  it("records a known depth action and returns a summary", () => {
    const result = record({ type: "strongs-lookup", ref: "gen.1.1" });
    expect(result).not.toBeNull();
    expect(result?.recorded.type).toBe("strongs-lookup");
    expect(result?.recorded.ref).toBe("gen.1.1");
    expect(result?.recorded.weight).toBe(1);
    expect(result?.recorded.domain).toBe("hebrew-greek");
  });

  it("bumps mastery for the correct domain", () => {
    record({ type: "strongs-lookup" });
    const m = mastery("hebrew-greek") as { score: number };
    expect(m.score).toBe(1);
  });

  it("ticks continuity", () => {
    record({ type: "note-written" });
    const st = continuity();
    expect(st.current).toBe(1);
  });

  it("thread-closing event (weight>=4) marks mastery thread", () => {
    record({ type: "word-study-complete" });
    const m = mastery("hebrew-greek") as { score: number; threads: number };
    expect(m.score).toBe(5);
    expect(m.threads).toBe(1);
  });

  it("custom weight overrides spec weight", () => {
    record({ type: "strongs-lookup", weight: 10 });
    const m = mastery("hebrew-greek") as { score: number };
    expect(m.score).toBe(10);
  });

  it("appends to LS event log", () => {
    record({ type: "gematria-lookup" });
    const log = lsLogAll();
    expect(log.some(e => e.type === "gematria-lookup")).toBe(true);
  });
});

describe("milestones()", () => {
  it("returns { unlocked, counters, rules }", () => {
    const m = milestones();
    expect(typeof m.unlocked).toBe("object");
    expect(typeof m.counters).toBe("object");
    expect(Array.isArray(m.rules)).toBe(true);
  });

  it("threshold milestone fires when counter hits n", () => {
    // crossref.10: n=10 for crossref-follow
    for (let i = 0; i < 10; i++) {
      record({ type: "crossref-follow" });
    }
    const m = milestones();
    expect(m.unlocked["crossref.10"]).toBeDefined();
  });
});

describe("unlockMilestone()", () => {
  it("returns a detail on first unlock", () => {
    const d = unlockMilestone("test.milestone", { labelEn: "Test milestone" });
    expect(d).not.toBeNull();
    expect(d?.id).toBe("test.milestone");
    expect(typeof d?.day).toBe("string");
  });

  it("returns null if already unlocked", () => {
    unlockMilestone("dup.test");
    expect(unlockMilestone("dup.test")).toBeNull();
  });
});

describe("nextThread()", () => {
  it("returns kind=none when no context is given", () => {
    const r = nextThread();
    expect(r.kind).toBe("none");
    expect(typeof r.title).toBe("string");
  });

  it("returns kind=crossref when ref + crossrefsAvailable=true", () => {
    const r = nextThread({ ref: "gen.1.1", crossrefsAvailable: true });
    expect(r.kind).toBe("crossref");
    expect(r.ref).toBe("gen.1.1");
  });

  it("returns kind=gematria when library has a gematria match", () => {
    const r = nextThread({
      library: [
        { ref: "gen.1.1", gematria: 913 },
        { ref: "rev.22.13", gematria: 913 },
      ],
    });
    expect(r.kind).toBe("gematria");
    expect(r.value).toBe(913);
  });

  it("returns kind=daf when daf is supplied", () => {
    const r = nextThread({ daf: "Berachot 2a" });
    expect(r.kind).toBe("daf");
    expect(r.ref).toBe("Berachot 2a");
  });

  it("returns kind=parsha when parsha is supplied and no daf", () => {
    const r = nextThread({ parsha: "Bereshit" });
    expect(r.kind).toBe("parsha");
    expect(r.ref).toBe("Bereshit");
  });
});

describe("clearState()", () => {
  it("returns { ok: true }", () => {
    expect(clearState()).toEqual({ ok: true });
  });

  it("resets continuity to defaults after clear", () => {
    tickContinuity();
    clearState();
    const st = continuity();
    expect(st.current).toBe(0);
    expect(st.longest).toBe(0);
  });

  it("resets counters after clear", () => {
    record({ type: "strongs-lookup" });
    clearState();
    expect(loadCounters()["strongs-lookup"]).toBeUndefined();
  });
});
