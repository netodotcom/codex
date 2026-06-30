// compare — pure helpers (migrated faithfully from legacy/compare.jsx). Cell
// class / glyph lookups, radar polygon math, axis label geometry, and the
// Markdown export builder. Nothing here reads window globals; everything is
// derived from its arguments or from the constant tables in data.ts.
import { APPS, FEATURES } from "./data.js";

// ── Cell rendering helpers ──────────────────────────────────────────────────
export function cellClass(v: string): string {
  if (v === "y") return "cx-cmp-cell cx-cmp-yes";
  if (v === "n") return "cx-cmp-cell cx-cmp-no";
  if (v === "p") return "cx-cmp-cell cx-cmp-partial";
  if (v === "$") return "cx-cmp-cell cx-cmp-paywall";
  return "cx-cmp-cell cx-cmp-text";
}

export function cellGlyph(v: string): string {
  if (v === "y") return "✓";
  if (v === "n") return "✗";
  if (v === "p") return "⚠";
  if (v === "$") return "$$$";
  return v;
}

// ── Radar polygon math ──────────────────────────────────────────────────────
export function polygonPoints(
  scores: number[],
  cx: number,
  cy: number,
  r: number,
): string {
  const n = scores.length;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const score = scores[i] ?? 0;
    const pct = Math.max(0, Math.min(100, score)) / 100;
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + Math.cos(ang) * r * pct;
    const y = cy + Math.sin(ang) * r * pct;
    pts.push(x.toFixed(1) + "," + y.toFixed(1));
  }
  return pts.join(" ");
}

export function axisLabelPos(
  i: number,
  n: number,
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number } {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: cx + Math.cos(ang) * (r + 16), y: cy + Math.sin(ang) * (r + 16) };
}

// ── Markdown export of matrix ───────────────────────────────────────────────
export function buildMarkdown(): string {
  const head = "| Feature | " + APPS.map((a) => a.name).join(" | ") + " |";
  const sep = "|" + APPS.map(() => "---").concat("---").join("|") + "|";
  const rows = FEATURES.map((f) => {
    const cells = f.row.map((c) => {
      const v = c.v;
      if (v === "y") return "✓";
      if (v === "n") return "✗";
      if (v === "p") return "⚠";
      if (v === "$") return "$$$";
      return v;
    });
    return "| " + f.label + " | " + cells.join(" | ") + " |";
  });
  return [
    "# How CODEX compares (2026-05)",
    "",
    head,
    sep,
  ]
    .concat(rows)
    .concat([
      "",
      "Source: CODEX comparison panel — https://github.com/codex (open source).",
      "If a row is wrong, send a PR via CONTRIBUTING.md.",
    ])
    .join("\n");
}
