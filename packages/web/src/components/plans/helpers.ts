// plans — pure-ish helpers (migrated from plans.jsx). Ref parsing, date math,
// per-plan localStorage state, the unified-continuity bridge, streak math, and
// one-shot reminder scheduling. The reader-nav and book-name reads cross the
// window boundary via pw(); everything else is pure and ground-truth tested.
import type { Plan, ParsedReading, Continuity } from "./types.js";
import { pw } from "./plans-window.js";
import { BUNDLED_PLANS, loadPlan } from "./data.js";

// ───────────────────────────────────────────────────────────────────────
// Book lookup — bookId → "Genesis" etc, for navigation
// ───────────────────────────────────────────────────────────────────────
export function bookName(bookId: string): string {
  try {
    const b = (pw().CODEX_DATA?.books || []).find((x) => x.id === bookId);
    if (b) return b.name;
  } catch {}
  return bookId.toUpperCase();
}

// Parse a reading ref like "gen.1", "gen.1-3", "psa.119", or
// "talmud.berakhot.2a". Returns { kind, label, navRef }.
export function parseReading(ref: string): ParsedReading {
  if (ref.startsWith("talmud.")) {
    const parts = ref.split(".");
    return { kind: "talmud", label: `Talmud · ${parts[1]} ${parts[2]}`, navRef: null };
  }
  const m = ref.match(/^([a-z0-9]+)\.(\d+)(?:-(\d+))?$/i);
  if (!m) return { kind: "unknown", label: ref, navRef: null };
  const b = m[1] ?? "";
  const a = m[2] ?? "";
  const z = m[3];
  const name = bookName(b);
  const label = z ? `${name} ${a}–${z}` : `${name} ${a}`;
  // For multi-chapter ranges, nav to first chapter.
  const navRef = `${name} ${a}`;
  return { kind: "scripture", label, navRef, book: b, start: +a, end: z ? +z : +a };
}

// ───────────────────────────────────────────────────────────────────────
// Date helpers
// ───────────────────────────────────────────────────────────────────────
export function isoToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function isoOffset(iso: string, daysOff: number): string {
  const p = iso.split("-");
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + daysOff);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-");
  const pb = b.split("-");
  const da = new Date(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2])).getTime();
  const db = new Date(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2])).getTime();
  return Math.round((db - da) / 86400000);
}

// ───────────────────────────────────────────────────────────────────────
// Per-plan localStorage state
// ───────────────────────────────────────────────────────────────────────
export function kPrefix(id: string): string {
  return `codex.plans.${id}`;
}
export function readStart(id: string): string | null {
  try {
    return localStorage.getItem(kPrefix(id) + ".start") || null;
  } catch {
    return null;
  }
}
export function writeStart(id: string, v: string): void {
  try {
    localStorage.setItem(kPrefix(id) + ".start", v);
  } catch {}
}
export function clearPlan(id: string): void {
  for (const sub of ["start", "completed", "streakLastDate", "reminderTime"]) {
    try {
      localStorage.removeItem(`${kPrefix(id)}.${sub}`);
    } catch {}
  }
}
export function readCompleted(id: string): Set<string> {
  try {
    const raw = localStorage.getItem(kPrefix(id) + ".completed");
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}
export function writeCompleted(id: string, set: Set<string>): void {
  try {
    localStorage.setItem(kPrefix(id) + ".completed", JSON.stringify([...set]));
  } catch {}
}
export function readReminder(id: string): string {
  try {
    return localStorage.getItem(kPrefix(id) + ".reminderTime") || "";
  } catch {
    return "";
  }
}
export function writeReminder(id: string, v: string): void {
  try {
    localStorage.setItem(kPrefix(id) + ".reminderTime", v);
  } catch {}
}

// ───────────────────────────────────────────────────────────────────────
// Unified continuity engine bridge (window.CODEX_ENGAGEMENT, Phase 2.5)
//
// Plans no longer maintain a parallel streak counter. Checking off a reading
// dispatches a codex:depth-action so continuity + mastery are computed
// centrally. Every call is guarded with typeof checks so the plan UI never
// breaks when the engine is absent (Lite mode / offline / not yet loaded).
// ───────────────────────────────────────────────────────────────────────
export function emitDepthAction(type: string, ref: string, weight: number, domain: string): void {
  // Prefer the bus so the engine records when present; a missing listener is
  // a silent no-op. Fall back to CustomEvent dispatch for older environments.
  try {
    const eng = pw().CODEX_ENGAGEMENT;
    if (eng && typeof eng.emit === "function") {
      eng.emit(type, ref, weight, domain);
      return;
    }
  } catch {}
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function" &&
      typeof CustomEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent("codex:depth-action", {
          detail: { type, ref, weight, domain },
        }),
      );
    }
  } catch {}
}

// Read the unified continuity snapshot for display, or null if the engine is
// absent. Never throws.
export function unifiedContinuity(): Continuity | null {
  try {
    const eng = pw().CODEX_ENGAGEMENT;
    if (eng && typeof eng.continuity === "function") {
      return eng.continuity();
    }
  } catch {}
  return null;
}

// streak: count back consecutive days where ALL readings for that day were
// checked. Retained only as a display FALLBACK when the unified continuity
// engine is unavailable (Lite mode / offline / not yet loaded).
export function computeStreak(plan: Plan, completed: Set<string>): number {
  const start = readStart(plan.meta.id);
  if (!start) return 0;
  const todayIso = isoToday();
  const todayN = daysBetween(start, todayIso) + 1; // 1-indexed day number
  let streak = 0;
  for (let d = todayN; d >= 1; d--) {
    const day = plan.days.find((x) => x.day === d);
    if (!day) break;
    const all = day.readings.every((_, idx) => completed.has(`${d}.${idx}`));
    if (all) streak++;
    else if (d < todayN) break; // missed past day → break
    else continue; // today not done is OK; keep looking back
  }
  return streak;
}

export function countCompletedDays(plan: Plan, completed: Set<string>, throughDay: number): number {
  let n = 0;
  for (let d = 1; d <= throughDay; d++) {
    const entry = plan.days.find((x) => x.day === d);
    if (!entry) continue;
    if (entry.readings.every((_, idx) => completed.has(`${d}.${idx}`))) n++;
  }
  return n;
}

// ───────────────────────────────────────────────────────────────────────
// Reminders — schedules a one-shot notification while the app is open
// ───────────────────────────────────────────────────────────────────────
const _scheduled: Record<string, ReturnType<typeof setTimeout>> = {};
export function scheduleReminder(plan: Plan, hhmm: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const id = plan.meta.id;
  const existing = _scheduled[id];
  if (existing) clearTimeout(existing);
  const hm = hhmm.split(":");
  const hh = Number(hm[0]);
  const mm = Number(hm[1]);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  _scheduled[id] = setTimeout(() => {
    try {
      new Notification("CODEX · " + plan.meta.name, {
        body: "Today's reading is waiting.",
        icon: "icon.svg",
      });
    } catch {}
    // Re-arm for next day
    scheduleReminder(plan, hhmm);
  }, delay);
}

// On boot, re-arm any saved reminders
export function bootReminders(): void {
  Promise.all(BUNDLED_PLANS.map(loadPlan)).then((mods) => {
    for (const p of mods.filter((m): m is Plan => !!m)) {
      const t = readReminder(p.meta.id);
      if (t) scheduleReminder(p, t);
    }
  });
}
