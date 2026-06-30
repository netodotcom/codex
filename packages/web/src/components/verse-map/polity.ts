// verse-map — PolityTimeline pure math (Backlog 4.1, sub-slice 6).
//
// Extracted from PolityTimeline in verse-map.jsx (l.1322): year bounds, tick
// computation, active-polity resolution, label formatting. Pure + testable; the
// stateful shell (slider, AI year-context, ResizeObserver) migrates later.

export interface Polity {
  name: string;
  from: number;
  to: number;
}

export function yearBounds(polities: Polity[]): { yMin: number; yMax: number } {
  return {
    yMin: Math.min(-2500, ...polities.map((p) => p.from)),
    yMax: Math.max(2030, ...polities.map((p) => p.to)),
  };
}

export function clampYear(year: number, yMin: number, yMax: number): number {
  return Math.max(yMin, Math.min(yMax, year));
}

export function majorTicks(yMin: number, yMax: number): number[] {
  const out: number[] = [];
  for (let y = -2000; y <= 2000; y += 1000) if (y >= yMin && y <= yMax) out.push(y);
  return out;
}

export function minorTicks(yMin: number, yMax: number, major: number[] = majorTicks(yMin, yMax)): number[] {
  const out: number[] = [];
  for (let y = Math.ceil(yMin / 250) * 250; y <= yMax; y += 250) if (!major.includes(y)) out.push(y);
  return out;
}

export function boundaryTicks(polities: Polity[], yMin: number, yMax: number): number[] {
  return polities.map((p) => p.from).filter((y) => y > yMin && y < yMax);
}

export function activePolity(polities: Polity[], year: number): Polity | null {
  return (
    polities.find((p) => year >= p.from && year <= p.to) ||
    polities.reduce<Polity | null>((closest, p) => {
      if (!closest) return p;
      const dC = Math.min(Math.abs(closest.from - year), Math.abs(closest.to - year));
      const dP = Math.min(Math.abs(p.from - year), Math.abs(p.to - year));
      return dP < dC ? p : closest;
    }, null)
  );
}

export function fmtMajor(y: number): string {
  if (y === 0) return "0";
  const k = Math.abs(y) / 1000;
  return `${k}K${y < 0 ? " BC" : ""}`;
}
