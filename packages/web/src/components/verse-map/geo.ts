// verse-map — pure geography/projection helpers (Backlog 4.1, sub-slice 1).
//
// Extracted faithfully from verse-map.jsx. No React, no window — unit-testable.
// The map components (MapBody, LeafletField, …) migrate in later sub-slices and
// consume these. The legacy verse-map.jsx keeps running until the whole feature
// is migrated and main.ts swaps the import.

export type LatLng = [number, number];

// Viewport + simplified equirectangular projection (Iberia → Persia).
export const BOUNDS = { lngMin: -10, lngMax: 60, latMin: 18, latMax: 48 } as const;
export const MAP_W = 520;
export const MAP_H = 280;

export function projXY(lat: number, lng: number): [number, number] {
  return [
    ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * MAP_W,
    ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * MAP_H,
  ];
}

export function pointsAttr(latLngArr: LatLng[]): string {
  return latLngArr.map(([lat, lng]) => projXY(lat, lng).join(",")).join(" ");
}

// Significance by kind — settlements outrank standing geography. Drives pulse.
export function poiSignificance(kind: string): number {
  switch ((kind || "").toLowerCase()) {
    case "city":
      return 3;
    case "town":
    case "ruin":
    case "region":
    case "island":
      return 2;
    default:
      return 1; // mountain · river · sea · lake · road
  }
}

// Glyph per POI kind — keeps the map legible without icon assets.
export function poiGlyph(kind: string): string {
  switch ((kind || "").toLowerCase()) {
    case "city":
      return "▣";
    case "town":
      return "◇";
    case "mountain":
      return "△";
    case "river":
      return "≈";
    case "sea":
    case "lake":
      return "◯";
    case "region":
      return "▭";
    case "ruin":
      return "◰";
    case "road":
      return "—";
    case "island":
      return "◐";
    default:
      return "•";
  }
}

// Great-circle distance in km.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function touristCacheKey(p: { lat: number; lng: number }): string {
  return `codex.tourist.${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}

// Gradient tint across an ordered era list.
export function eraTint(i: number, n: number): string {
  const p = n > 1 ? Math.round((i / (n - 1)) * 100) : 50;
  return `color-mix(in srgb, var(--cx-accent, #7ee0ff) ${100 - p}%, var(--cx-accent-2, #ffc46b) ${p}%)`;
}

// Stylised outlines of the major water bodies in the frame ([lat, lng] pairs).
export const SEAS: Record<string, LatLng[]> = {
  mediterranean: [
    [36, -5], [36.5, -3], [37.2, 0], [38.0, 4], [38.4, 8], [38.8, 12],
    [37.5, 13], [37.0, 15.5], [36.5, 17],
    [37.5, 18.5], [38.5, 19], [40.0, 19.5], [40.5, 20.5],
    [40.0, 23], [38.8, 24.5], [36.5, 27],
    [36.4, 30], [36.1, 32.5], [36.3, 35.5], [35.5, 35.5],
    [33.0, 35.0], [31.4, 34.5], [31.0, 32.5], [31.4, 30.5],
    [32.0, 28], [32.5, 24], [33.0, 20], [33.5, 17], [34.5, 14],
    [37.0, 11], [37.0, 8], [36.5, 4], [36.2, 0], [36.0, -4], [36, -5],
  ],
  blackSea: [
    [41.0, 28], [42.5, 28], [44.5, 31], [46.5, 34], [46.5, 38],
    [45.0, 40.5], [42.0, 41.5], [41.5, 39], [41.5, 35], [41.0, 32], [41.0, 28],
  ],
  redSea: [
    [28.0, 33.0], [27.0, 34.0], [25.5, 35.0], [22.0, 37.5], [19.5, 39.5],
    [18.0, 41.5], [19.5, 42.5], [21.5, 41.0], [24.0, 38.5], [26.5, 36.0],
    [28.0, 34.5], [28.0, 33.0],
  ],
  persianGulf: [
    [30.0, 48.0], [29.0, 49.0], [27.5, 50.0], [25.5, 51.5], [24.0, 53.5],
    [25.5, 56.0], [26.5, 56.0], [27.5, 53.5], [29.0, 50.5], [30.0, 49.0], [30.0, 48.0],
  ],
  caspianSea: [
    [47.0, 47.0], [47.0, 48.5], [46.0, 50.5], [44.0, 52.0], [42.0, 51.0],
    [40.0, 50.0], [38.5, 50.5], [37.0, 51.5], [37.5, 52.5], [40.0, 53.0],
    [42.0, 53.5], [44.5, 51.0], [47.0, 49.0], [47.0, 47.0],
  ],
};

// Major rivers — sequences of [lat, lng] rendered as polylines.
export const RIVERS: Record<string, LatLng[]> = {
  nile: [[31.4, 30.4], [29.5, 31.0], [27.5, 31.5], [25.5, 32.5], [24.0, 32.9], [21.0, 31.5], [18.0, 31.0]],
  tigris: [[37.5, 41.5], [36.5, 42.5], [35.0, 43.5], [34.0, 44.4], [32.5, 45.5], [31.0, 46.5], [30.5, 47.5]],
  euphr: [[37.5, 38.5], [36.0, 39.5], [35.0, 40.5], [33.5, 42.0], [32.0, 44.0], [31.0, 45.5], [30.5, 47.5]],
  jordan: [[33.3, 35.6], [32.8, 35.55], [32.2, 35.5], [31.7, 35.5]],
};
