// continuity — pure helpers (migrated verbatim from continuity.jsx). These touch
// no window globals, so they are extracted here for node-level ground-truth
// tests. The engine owns every number; this is the analyst-desk lexicon only.

// Guarded value reader — every engine call in the legacy is wrapped in this.
// Returns the default on throw OR on a null/undefined result (note: 0 / "" / false
// are real values and pass through, exactly as the legacy `v == null` check did).
export function safe<T>(fn: () => T | null | undefined, dflt: T): T {
  try {
    const v = fn();
    return v == null ? dflt : v;
  } catch {
    return dflt;
  }
}

// A small ASCII bar — "▓▓▓▓░" — for the analyst-desk voice. Pure text so it
// reads identically with or without styles.css.
export function asciiBar(pct: number, cells?: number): string {
  const n = cells || 5;
  const filled = Math.max(0, Math.min(n, Math.round((pct / 100) * n)));
  return "▓".repeat(filled) + "░".repeat(n - filled);
}

// ts may be an ISO day string or an epoch ms. Render a calm date stamp.
export function isoStamp(ts: unknown): string {
  try {
    if (ts == null) return "";
    if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10);
    const d = new Date(ts as string | number | Date);
    if (isNaN(d.getTime())) return String(ts);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// Compute a 0–100 progress toward the NEXT mastery level for the bar fill.
// (Extracted from the legacy MasteryGrid closure; `levels` is the engine's
// MASTERY_LEVELS, threaded in so this stays pure & testable.)
export function pctToNext(levels: ReadonlyArray<{ min: number }> | null, score: number, levelIdx: number): number {
  if (!levels || !levels.length) return 0;
  const cur = levels[Math.min(levelIdx, levels.length - 1)];
  const nxt = levels[levelIdx + 1];
  if (!nxt) return 100; // already at the top level
  const base = cur ? cur.min : 0;
  const span = nxt.min - base;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((score - base) / span) * 100)));
}

// Domain display order (the engine's canonical 8) — used as a fallback when the
// engine has not registered its taxonomy yet.
export const FALLBACK_DOMAINS: string[] = [
  "hebrew-greek", "cross-references", "gematria", "talmud",
  "patristics", "gnosis", "geography", "canon-coverage",
];

export const STEP_KIND_KEY: Record<string, string> = {
  read: "cx.quest.step.read",
  find: "cx.quest.step.find",
  connect: "cx.quest.step.connect",
  reflect: "cx.quest.step.reflect",
};
export const STEP_KIND_EN: Record<string, string> = { read: "Read", find: "Find", connect: "Connect", reflect: "Reflect" };
