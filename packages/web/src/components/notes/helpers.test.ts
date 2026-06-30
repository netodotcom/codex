// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  NOTES_KEY,
  loadNotes,
  saveNotes,
  formatTs,
  isPosition,
} from "./helpers.js";
import type { SavedNote } from "./helpers.js";

// ── localStorage mock ────────────────────────────────────────────────────────

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

beforeEach(() => installStorage());

// ── formatTs (ground truth) ──────────────────────────────────────────────────

describe("formatTs (ground truth)", () => {
  it("returns 'just now' for timestamps under 60 s ago", () => {
    expect(formatTs(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes string for under 1 h ago", () => {
    expect(formatTs(Date.now() - 5 * 60_000)).toBe("5m");
  });

  it("returns hours string for under 24 h ago", () => {
    expect(formatTs(Date.now() - 3 * 3_600_000)).toBe("3h");
  });

  it("returns days string for under 7 days ago", () => {
    expect(formatTs(Date.now() - 3 * 86_400_000)).toBe("3d");
  });

  it("returns zero-padded month·day for older timestamps", () => {
    // Pick a date far in the past; result must be MM·DD pattern.
    const ts = new Date("2020-03-07T12:00:00.000Z").getTime();
    const result = formatTs(ts);
    expect(result).toMatch(/^\d{2}·\d{2}$/);
  });
});

// ── loadNotes / saveNotes (ground truth) ─────────────────────────────────────

describe("loadNotes / saveNotes (round-trip)", () => {
  it("saves and reloads a note array intact", () => {
    const note: SavedNote = { id: "n_1", text: "hello world", ref: "John 3:16", ts: 12345 };
    saveNotes([note]);
    expect(loadNotes()).toEqual([note]);
  });

  it("returns [] when nothing is stored", () => {
    localStorage.removeItem(NOTES_KEY);
    expect(loadNotes()).toEqual([]);
  });

  it("returns [] when stored value is corrupt JSON", () => {
    localStorage.setItem(NOTES_KEY, "not-valid-json{{{");
    expect(loadNotes()).toEqual([]);
  });

  it("returns [] when stored value is valid JSON but not an array", () => {
    localStorage.setItem(NOTES_KEY, JSON.stringify({ id: "x" }));
    expect(loadNotes()).toEqual([]);
  });
});

// ── isPosition (ground truth) ────────────────────────────────────────────────

describe("isPosition (guard)", () => {
  it("accepts a valid position object", () => {
    expect(isPosition({ right: 16, bottom: 40 })).toBe(true);
  });

  it("rejects null / non-objects / arrays", () => {
    expect(isPosition(null)).toBe(false);
    expect(isPosition(undefined)).toBe(false);
    expect(isPosition([16, 40])).toBe(false);
    expect(isPosition("pos")).toBe(false);
  });

  it("rejects objects missing right or bottom", () => {
    expect(isPosition({ right: 16 })).toBe(false);
    expect(isPosition({ bottom: 40 })).toBe(false);
  });

  it("rejects objects with non-numeric values", () => {
    expect(isPosition({ right: "16", bottom: 40 })).toBe(false);
  });
});
