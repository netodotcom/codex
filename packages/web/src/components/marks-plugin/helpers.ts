// marks-plugin — pure data constants and helpers (migrated verbatim from
// marks-plugin.jsx v10). No DOM / React / window dependencies; fully testable
// in node. The three try/catch wrappers around localStorage are preserved as
// faithful quirks (mirrors the v10 pattern for SSR safety).

export const MARKS_KEY = "codex.highlights.v1";
export const MARKS_PINS_KEY = "codex.marks.pinned.v1";

const MARKS_HUES = {
  amber: "#ffd479",
  rose:  "#ff8291",
  mint:  "#5bd0b0",
  violet:"#b88cff",
  cyan:  "#7ee0ff",
  gold:  "#ffd479",
} as const;

export type MarkHue = keyof typeof MARKS_HUES;

/** Returns the CSS colour string for a mark hue; falls back to amber. */
export function hueColor(color: string | undefined): string {
  if (color && Object.prototype.hasOwnProperty.call(MARKS_HUES, color)) {
    return MARKS_HUES[color as MarkHue];
  }
  return MARKS_HUES.amber;
}

export interface MarkEntry {
  color?: string;
  ts?: number;
  note?: string;
}

export function marksLoad(): Record<string, MarkEntry> {
  try {
    return JSON.parse(localStorage.getItem(MARKS_KEY) ?? "{}") as Record<string, MarkEntry>;
  } catch {
    return {};
  }
}

export function marksPins(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MARKS_PINS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function marksSave(map: Record<string, MarkEntry>): void {
  try { localStorage.setItem(MARKS_KEY, JSON.stringify(map)); } catch {}
  try { window.dispatchEvent(new CustomEvent("codex:marks-changed")); } catch {}
}

export function marksSavePins(set: Set<string>): void {
  try { localStorage.setItem(MARKS_PINS_KEY, JSON.stringify([...set])); } catch {}
  try { window.dispatchEvent(new CustomEvent("codex:marks-changed")); } catch {}
}

export function marksAgo(ts: number | undefined): string {
  if (!ts) return "";
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  return new Date(ts).toLocaleDateString();
}
