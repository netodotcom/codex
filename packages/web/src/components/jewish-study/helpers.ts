// jewish-study — pure helpers and window-reading utilities (migrated verbatim
// from jewish-study.jsx). Pure functions are fully testable; the handful that
// read window globals do so through jw() — the typed window boundary.
import { jw } from "./jewish-study-window.js";
import type { HebrewMonth, HebrewDate, Holiday, DafEntry, DafModule } from "./jewish-study-window.js";

// ── Module loaders ────────────────────────────────────────────────────────
const _cache: Record<string, Promise<unknown>> = {};

export function loadModule(id: string): Promise<unknown> {
  const cached = _cache[id];
  if (cached) return cached;
  const api = jw().CODEX_MODULES;
  if (!api || typeof api.loadModule !== "function") {
    return Promise.reject(new Error("CODEX_MODULES not available"));
  }
  const p = api.loadModule(id).catch((e: unknown) => {
    delete _cache[id];
    throw e;
  });
  _cache[id] = p;
  return p;
}

// ── Hebrew date approximation ─────────────────────────────────────────────
// Anchored at Tishrei 1 ≈ September 15. Each month assumed 30 days
// (alternating real lengths average ~29.5). Drift is acceptable for UI.
export const MONTH_ORDER_FROM_TISHREI: ReadonlyArray<number> = [
  7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6,
];

export function approxHebrewDate(d: Date): HebrewDate {
  const months = jw().CODEX_JEWISH_MONTHS_CACHE ?? null;
  // Days since approx Tishrei 1 of the *current* Hebrew year.
  const year = d.getFullYear();
  let anchor = new Date(year, 8, 15); // Sep 15
  if (d < anchor) {
    anchor = new Date(year - 1, 8, 15);
  }
  const daysSinceAnchor = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
  const monthIdx = Math.min(11, Math.floor(daysSinceAnchor / 30));
  const dayInMonth = (daysSinceAnchor % 30) + 1;
  const monthN = MONTH_ORDER_FROM_TISHREI[monthIdx] ?? 7;
  const hYear = (d >= anchor ? year + 3761 : year + 3760);
  const monthMeta = months
    ? months.find((m) => m.n === monthN)
    : { n: monthN, name: "", translit: "" };
  return {
    day: dayInMonth,
    month: monthMeta ?? { n: monthN, name: "", translit: "" },
    year: hYear,
    daysSinceAnchor,
  };
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ── Books helpers ─────────────────────────────────────────────────────────
export function bookName(bookId: string | undefined | null): string {
  const list = jw().CODEX_DATA?.books ?? [];
  const b = list.find((x) => x.id === (bookId ?? "").toLowerCase());
  return b ? (b.name ?? (bookId ?? "").toUpperCase()) : (bookId ?? "").toUpperCase();
}

export function formatRef(key: string | undefined | null): string {
  if (!key) return "";
  const parts = String(key).split(".");
  if (parts.length === 1) return bookName(parts[0]);
  const b = bookName(parts[0]);
  // Detect range: "gen.1.1-6.8"
  const rest = parts.slice(1).join(".");
  return `${b} ${rest}`;
}

export function jumpToRef(refKey: string): void {
  try {
    const display = formatRef(refKey);
    const jumpFn = jw().codexJumpToRef;
    if (typeof jumpFn === "function") {
      jumpFn(display);
      return;
    }
    // Fallback dispatch
    const parts = String(refKey).split(".");
    const bookId = (parts[0] ?? "").toLowerCase();
    const chapter = parseInt(parts[1] ?? "", 10) || 1;
    window.dispatchEvent(new CustomEvent("codex:navigate", {
      detail: { book: bookName(bookId), bookId, chapter },
    }));
  } catch (e) { console.warn("jewish-study: jump failed", e); }
}

// ── Engagement depth emission (guarded) ───────────────────────────────────
// Defensive: never throw if the engagement engine / CustomEvent is absent
// (Lite mode). Only emits depth types that exist in engagement.js.
export function emitDepth(type: string, ref: string, weight: number): void {
  try {
    if (typeof window === "undefined" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent("codex:depth-action", {
      detail: { type, ref, weight },
    }));
  } catch (_e) { /* no-op: engagement is optional */ }
}

// ── Holiday-date helpers ──────────────────────────────────────────────────
// Each holiday string like "15 Nisan" → { day, translit }.
export interface ParsedHolidayDate {
  day: number;
  translit: string;
}

export function parseHolidayDate(date: string | undefined | null): ParsedHolidayDate | null {
  if (!date) return null;
  const m = String(date).match(/(\d+)(?:[–-]\d+)?\s+([A-Za-z'']+)/);
  if (!m) return null;
  const day = parseInt(m[1] ?? "", 10);
  const translit = (m[2] ?? "").replace(/['']/g, "").toLowerCase();
  return { day, translit };
}

// ── Accurate Hebrew → Gregorian (the "goy calendar") ──────────────────────
// Uses the browser's built-in Hebrew calendar (Intl ca-hebrew): accurate,
// offline, and works for ANY Gregorian year — current, future, or historical
// — so the user knows exactly when each holiday falls. Maps our holiday
// month transliterations → Intl's Hebrew month names (Adar → Adar/Adar II
// to cover leap years, where Purim's "14 Adar" lands in Adar II).
const _HEB_INTL: Record<string, string[]> = {
  nisan: ["Nisan"], iyar: ["Iyar"], iyyar: ["Iyar"], sivan: ["Sivan"],
  tammuz: ["Tammuz"], tamuz: ["Tammuz"], av: ["Av"], elul: ["Elul"],
  tishrei: ["Tishri"], tishri: ["Tishri"],
  cheshvan: ["Heshvan"], marcheshvan: ["Heshvan"], heshvan: ["Heshvan"],
  kislev: ["Kislev"], tevet: ["Tevet"], teveth: ["Tevet"],
  shevat: ["Shevat"], shvat: ["Shevat"],
  adar: ["Adar", "Adar II"], "adar i": ["Adar I"], "adar ii": ["Adar II"],
};

const _gregCache: Record<string, Date | null> = {};
let _hebFmt: Intl.DateTimeFormat | undefined;

export function gregForHoliday(day: number, translit: string, gregYear: number): Date | null {
  if (!day || !translit || !gregYear) return null;
  const accept = _HEB_INTL[String(translit).toLowerCase().trim()];
  if (!accept) return null;
  const key = gregYear + ":" + translit + ":" + day;
  if (key in _gregCache) return _gregCache[key] ?? null;
  let out: Date | null = null;
  try {
    if (!_hebFmt) _hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", timeZone: "UTC" });
    const base = Date.UTC(gregYear, 0, 1);
    for (let i = 0; i < 366; i++) {
      const d = new Date(base + i * 86400000);
      if (d.getUTCFullYear() !== gregYear) break;
      let mo = "", dd = "";
      for (const p of _hebFmt.formatToParts(d)) {
        if (p.type === "month") mo = p.value;
        else if (p.type === "day") dd = p.value;
      }
      if (Number(dd) === Number(day) && accept.indexOf(mo) !== -1) { out = d; break; }
    }
  } catch (_e) { out = null; }
  _gregCache[key] = out;
  return out;
}

export function fmtGreg(d: Date | null): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  } catch (_e) { return null; }
}

export function holidayGreg(dateStr: string | undefined | null, gregYear: number): string | null {
  const p = parseHolidayDate(dateStr);
  return p ? fmtGreg(gregForHoliday(p.day, p.translit, gregYear)) : null;
}

// Compute days-until for a holiday relative to "today's" approx hebrew date.
export function daysUntilHoliday(
  holiday: Holiday,
  todayHeb: HebrewDate,
  monthsList: HebrewMonth[],
): number | null {
  const parsed = parseHolidayDate(holiday.date);
  if (!parsed) return null;
  const monthMeta = monthsList.find(
    (m) => m.translit.toLowerCase().replace(/[-'']/g, "") === parsed.translit.replace(/[-'']/g, ""),
  );
  if (!monthMeta) return null;
  // Compute target day-of-year (Tishrei-anchored). Tishrei month index 0.
  const tIdx = MONTH_ORDER_FROM_TISHREI.indexOf(monthMeta.n);
  const targetDoy = tIdx * 30 + (parsed.day - 1);
  const todayDoy = todayHeb.daysSinceAnchor;
  let diff = targetDoy - todayDoy;
  if (diff < -14) diff += 354; // wrap to next year (avg Hebrew year ~354d)
  return diff;
}

// ── Parsha picker ─────────────────────────────────────────────────────────
export function pickParshaIndex(parashot: ReadonlyArray<unknown>): number {
  const w = isoWeek(new Date());
  return ((w - 1) % parashot.length + parashot.length) % parashot.length;
}

// ── Daf Yomi today (relative to a fixed start date) ───────────────────────
export function todaysDaf(mod: DafModule | null | undefined): DafEntry | null {
  if (!mod || !Array.isArray(mod.days) || mod.days.length === 0) return null;
  // Anchor day 1 to start-of-this-month of current real year — purely
  // illustrative until a real cycle anchor is wired. (Module is a 90-day
  // preview, so we just modulo through it.)
  const epoch = new Date(2026, 0, 1);
  const days = Math.floor((new Date().getTime() - epoch.getTime()) / 86400000);
  const idx = ((days % mod.days.length) + mod.days.length) % mod.days.length;
  return mod.days[idx] ?? null;
}
