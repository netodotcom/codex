// artifacts — chart/flow theme tokens + number formatting (migrated VERBATIM
// from artifacts.jsx). Pure; honest value labels, theme tokens only.

export const ART_ACCENT = "var(--cx-accent, #7ee0ff)";
export const ART_FG = "var(--cx-fg, #c9d4dc)";
export const ART_DIM = "var(--cx-fg-dim, #8a98a8)";
export const ART_HUES = ["#7ee0ff", "#c7a9ff", "#8de8a8", "#ffc46b", "#ff8291", "#6bc6ff", "#e8d68d"];

export function artNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function artFmt(v: unknown): string {
  const n = artNum(v);
  return Math.abs(n) >= 1000 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}
