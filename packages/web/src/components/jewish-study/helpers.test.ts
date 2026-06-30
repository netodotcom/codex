// @vitest-environment jsdom
// Ground-truth tests for the pure helpers in jewish-study. All window-reading
// functions use jw() which requires jsdom's window object.
import { describe, it, expect } from "vitest";
import {
  approxHebrewDate,
  isoWeek,
  bookName,
  formatRef,
  parseHolidayDate,
  daysUntilHoliday,
  pickParshaIndex,
  todaysDaf,
  MONTH_ORDER_FROM_TISHREI,
} from "./helpers.js";
import type { HebrewMonth, HebrewDate, Holiday, DafModule } from "./jewish-study-window.js";

// ── isoWeek (ground truth) ────────────────────────────────────────────────
describe("isoWeek (ground truth)", () => {
  it("Jan 15 2024 (Monday) is ISO week 3", () => {
    expect(isoWeek(new Date(2024, 0, 15))).toBe(3);
  });

  it("Jan 1 2024 (Monday) is ISO week 1", () => {
    expect(isoWeek(new Date(2024, 0, 1))).toBe(1);
  });

  it("Jan 8 2024 (Monday) is ISO week 2", () => {
    expect(isoWeek(new Date(2024, 0, 8))).toBe(2);
  });

  it("Dec 28 2020 (Monday) is ISO week 53", () => {
    // 2020 has 53 ISO weeks; Dec 28 falls in week 53
    expect(isoWeek(new Date(2020, 11, 28))).toBe(53);
  });
});

// ── approxHebrewDate (ground truth) ──────────────────────────────────────
describe("approxHebrewDate (ground truth)", () => {
  it("Sep 15 2024 (anchor day itself) is day 1 of Tishrei 5785", () => {
    // daysSinceAnchor = 0, monthIdx = 0, dayInMonth = 1
    // MONTH_ORDER_FROM_TISHREI[0] = 7 (Tishrei)
    // hYear = 2024 + 3761 = 5785
    const h = approxHebrewDate(new Date(2024, 8, 15));
    expect(h.day).toBe(1);
    expect(h.month.n).toBe(7);
    expect(h.year).toBe(5785);
    expect(h.daysSinceAnchor).toBe(0);
  });

  it("Sep 20 2024 (5 days past anchor) is day 6 of Tishrei 5785", () => {
    const h = approxHebrewDate(new Date(2024, 8, 20));
    expect(h.day).toBe(6);
    expect(h.month.n).toBe(7);
    expect(h.year).toBe(5785);
    expect(h.daysSinceAnchor).toBe(5);
  });

  it("Sep 1 2024 (before anchor) uses prior year anchor", () => {
    // anchor = Sep 15, 2023; daysSinceAnchor = (Sep 1 2024 - Sep 15 2023) days
    // 2024 is a leap year (Feb 29 falls in the interval), so:
    // Sep 15 2023 → Sep 15 2024 = 366 days; Sep 15 → Sep 1 = -14 days → 352 days
    const h = approxHebrewDate(new Date(2024, 8, 1));
    expect(h.daysSinceAnchor).toBe(352);
    // monthIdx = Math.min(11, Math.floor(352/30)) = Math.min(11, 11) = 11
    // monthN = MONTH_ORDER_FROM_TISHREI[11] = 6 (Elul)
    expect(h.month.n).toBe(6);
    // NOTE (preserved quirk): the formula sets hYear = gregYear + 3761 whenever
    // d >= the prior-year anchor (Sep 15, 2023), which is always true for any date
    // in 2024. So Sep 1, 2024 — before Rosh Hashanah 5785 — produces 5785 instead
    // of the correct 5784. The legacy approximation has the same behaviour.
    expect(h.year).toBe(5785);
  });

  it("uses months cache for month name when available", () => {
    const months: HebrewMonth[] = [
      { n: 7, name: "תִּשְׁרֵי", translit: "Tishrei" },
    ];
    // Inject the cache via the window object (jsdom)
    (window as unknown as { CODEX_JEWISH_MONTHS_CACHE: HebrewMonth[] }).CODEX_JEWISH_MONTHS_CACHE = months;
    const h = approxHebrewDate(new Date(2024, 8, 20)); // Tishrei
    expect(h.month.name).toBe("תִּשְׁרֵי");
    expect(h.month.translit).toBe("Tishrei");
    // Cleanup
    delete (window as unknown as { CODEX_JEWISH_MONTHS_CACHE?: HebrewMonth[] }).CODEX_JEWISH_MONTHS_CACHE;
  });
});

// ── MONTH_ORDER_FROM_TISHREI (sanity) ─────────────────────────────────────
describe("MONTH_ORDER_FROM_TISHREI", () => {
  it("has exactly 12 elements starting with Tishrei (7) and ending with Elul (6)", () => {
    expect(MONTH_ORDER_FROM_TISHREI.length).toBe(12);
    expect(MONTH_ORDER_FROM_TISHREI[0]).toBe(7); // Tishrei
    expect(MONTH_ORDER_FROM_TISHREI[11]).toBe(6); // Elul
  });
});

// ── bookName (ground truth) ───────────────────────────────────────────────
describe("bookName (ground truth)", () => {
  it("returns uppercase bookId when CODEX_DATA is absent", () => {
    delete (window as unknown as { CODEX_DATA?: unknown }).CODEX_DATA;
    expect(bookName("gen")).toBe("GEN");
    expect(bookName("jhn")).toBe("JHN");
  });

  it("looks up name from CODEX_DATA.books", () => {
    (window as unknown as { CODEX_DATA: { books: Array<{ id: string; name: string }> } }).CODEX_DATA = {
      books: [{ id: "gen", name: "Genesis" }, { id: "jhn", name: "John" }],
    };
    expect(bookName("gen")).toBe("Genesis");
    expect(bookName("jhn")).toBe("John");
    delete (window as unknown as { CODEX_DATA?: unknown }).CODEX_DATA;
  });

  it("handles null / undefined gracefully", () => {
    expect(bookName(null)).toBe("");
    expect(bookName(undefined)).toBe("");
  });
});

// ── formatRef (ground truth) ──────────────────────────────────────────────
describe("formatRef (ground truth)", () => {
  it("returns empty for falsy input", () => {
    expect(formatRef(null)).toBe("");
    expect(formatRef("")).toBe("");
  });

  it("formats a book-only ref", () => {
    expect(formatRef("gen")).toBe("GEN");
  });

  it("formats book.chapter.verse", () => {
    expect(formatRef("gen.1.1")).toBe("GEN 1.1");
  });

  it("formats a range ref", () => {
    expect(formatRef("gen.1.1-2.3")).toBe("GEN 1.1-2.3");
  });
});

// ── parseHolidayDate (ground truth) ──────────────────────────────────────
describe("parseHolidayDate (ground truth)", () => {
  it("parses a simple day-month", () => {
    expect(parseHolidayDate("15 Nisan")).toEqual({ day: 15, translit: "nisan" });
  });

  it("parses a range date (takes the start day)", () => {
    expect(parseHolidayDate("1–10 Tishrei")).toEqual({ day: 1, translit: "tishrei" });
  });

  it("strips apostrophes from month names (e.g. Adar)", () => {
    expect(parseHolidayDate("14 Adar")).toEqual({ day: 14, translit: "adar" });
  });

  it("returns null for empty / null", () => {
    expect(parseHolidayDate(null)).toBeNull();
    expect(parseHolidayDate("")).toBeNull();
    expect(parseHolidayDate("not a date")).toBeNull();
  });
});

// ── daysUntilHoliday (ground truth) ──────────────────────────────────────
describe("daysUntilHoliday (ground truth)", () => {
  const months: HebrewMonth[] = [
    { n: 7, name: "תִּשְׁרֵי", translit: "Tishrei" },
    { n: 1, name: "נִיסָן", translit: "Nisan" },
  ];
  const passover: Holiday = { id: "passover", hebrew: "פֶּסַח", name: "Passover", date: "15 Nisan" };
  const roshHashana: Holiday = { id: "rh", hebrew: "ראש השנה", name: "Rosh Hashanah", date: "1 Tishrei" };

  it("Passover (15 Nisan) from start of year (daysSinceAnchor=0) is 194 days away", () => {
    // Nisan is index 6 in MONTH_ORDER_FROM_TISHREI
    // tIdx = 6, targetDoy = 6*30 + (15-1) = 180 + 14 = 194
    const todayHeb: HebrewDate = {
      day: 1,
      month: months[0]!,
      year: 5785,
      daysSinceAnchor: 0,
    };
    expect(daysUntilHoliday(passover, todayHeb, months)).toBe(194);
  });

  it("Rosh Hashanah (1 Tishrei) from mid-year wraps to next year (+354)", () => {
    // tIdx = 0, targetDoy = 0*30 + 0 = 0
    // todayDoy = 200 → diff = 0 - 200 = -200 < -14 → diff += 354 → 154
    const todayHeb: HebrewDate = {
      day: 20,
      month: months[1]!, // Nisan
      year: 5785,
      daysSinceAnchor: 200,
    };
    expect(daysUntilHoliday(roshHashana, todayHeb, months)).toBe(154);
  });

  it("returns null for unparseable holiday date", () => {
    const bad: Holiday = { id: "x", hebrew: "x", name: "x", date: "unknown" };
    const todayHeb: HebrewDate = { day: 1, month: months[0]!, year: 5785, daysSinceAnchor: 0 };
    expect(daysUntilHoliday(bad, todayHeb, months)).toBeNull();
  });

  it("returns null when month is not in the list", () => {
    const noMonth: Holiday = { id: "x", hebrew: "x", name: "x", date: "15 Adar" };
    const todayHeb: HebrewDate = { day: 1, month: months[0]!, year: 5785, daysSinceAnchor: 0 };
    // months list only has Tishrei and Nisan, no Adar
    expect(daysUntilHoliday(noMonth, todayHeb, months)).toBeNull();
  });
});

// ── pickParshaIndex (ground truth) ────────────────────────────────────────
describe("pickParshaIndex (ground truth)", () => {
  it("returns an index in [0, length-1] for a 54-parasha cycle", () => {
    const parashot = Array.from({ length: 54 }, (_, i) => i);
    const idx = pickParshaIndex(parashot);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(54);
  });

  it("returns 0 for a 1-element array", () => {
    expect(pickParshaIndex([{}])).toBe(0);
  });
});

// ── todaysDaf (ground truth) ──────────────────────────────────────────────
describe("todaysDaf (ground truth)", () => {
  it("returns null for null / undefined / empty module", () => {
    expect(todaysDaf(null)).toBeNull();
    expect(todaysDaf(undefined)).toBeNull();
    const empty: DafModule = { days: [] };
    expect(todaysDaf(empty)).toBeNull();
  });

  it("returns the only entry when the module has one day", () => {
    const mod: DafModule = { days: [{ day: 1, readings: ["talmud.berakhot.2a"] }] };
    // With only one entry, idx = ((days % 1) + 1) % 1 = 0
    expect(todaysDaf(mod)).toEqual({ day: 1, readings: ["talmud.berakhot.2a"] });
  });

  it("cycles through entries based on the 2026-01-01 epoch", () => {
    // The epoch is Jan 1, 2026. With a 2-day module:
    // idx depends on today's date — just verify it returns one of the two entries.
    const mod: DafModule = {
      days: [
        { day: 1, readings: ["talmud.berakhot.2a"] },
        { day: 2, readings: ["talmud.berakhot.2b"] },
      ],
    };
    const result = todaysDaf(mod);
    expect(result).not.toBeNull();
    expect([1, 2]).toContain(result!.day);
  });
});
