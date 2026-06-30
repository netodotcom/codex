// reader — solar clock + time formatting (migrated from components.jsx).
// Pure: an approximate solar position from the local hour, no API calls. The
// hook (useSolarClock) ticks a Date and feeds the fractional hour here.

export interface Solar {
  phase: "night" | "dawn" | "day" | "dusk";
  t01: number; // 0 at midnight → 1 just before next midnight (sky arc)
  sunPct: number; // sun height as % of zenith (sin curve, 6–18)
  label: string;
  hour: number; // the fractional hour it was computed from
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(d: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Fractional hour [0,24) from a Date (hours + minutes/60 + seconds/3600).
export function solarHour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

const LABELS: Record<Solar["phase"], string> = { night: "NOCT", dawn: "AURO", day: "DIES", dusk: "VESP" };

export function computeSolar(h: number): Solar {
  // Civil bands (rough, location-agnostic).
  let phase: Solar["phase"] = "day";
  if (h < 5) phase = "night";
  else if (h < 7) phase = "dawn";
  else if (h < 18) phase = "day";
  else if (h < 20) phase = "dusk";
  else phase = "night";

  const t01 = h / 24;
  const sunPct = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 100;
  return { phase, t01, sunPct, label: LABELS[phase], hour: h };
}
