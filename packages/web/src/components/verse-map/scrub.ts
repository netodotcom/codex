// verse-map — FootScrub pure logic (Backlog 4.1, sub-slice 9).
//
// Extracted from FootScrub in verse-map.jsx (l.1907): the valid-polity list,
// its bounds, active-segment resolution and position math. Pure + testable; the
// pointer-drag + DOM-effect shell migrates with the component.
import type { Polity } from "./polity.js";

export function scrubList(polities: Polity[]): Polity[] {
  return polities
    .filter((p) => typeof p.from === "number" && typeof p.to === "number" && p.to > p.from && !!p.name)
    .slice()
    .sort((a, b) => a.from - b.from);
}

export function scrubBounds(list: Polity[]): { yMin: number; yMax: number } {
  return {
    yMin: list.length ? Math.min(...list.map((p) => p.from)) : -2000,
    yMax: list.length ? Math.max(...list.map((p) => p.to)) : 2030,
  };
}

// Index of the segment containing `year`, else the nearest segment (first wins
// on ties). -1 only for an empty list.
export function activeIndex(list: Polity[], year: number): number {
  let idx = list.findIndex((p) => year >= p.from && year <= p.to);
  if (idx === -1 && list.length) {
    let best = 0;
    let bd = Infinity;
    list.forEach((p, i) => {
      const d = Math.min(Math.abs(p.from - year), Math.abs(p.to - year));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    idx = best;
  }
  return idx;
}

export function pct(y: number, yMin: number, yMax: number): number {
  return ((y - yMin) / Math.max(1, yMax - yMin)) * 100;
}
