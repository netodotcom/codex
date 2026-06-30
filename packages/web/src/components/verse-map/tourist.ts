// verse-map — Tourist-mode pure logic (Backlog 4.1, sub-slice 4).
//
// Extracted from MapBody in verse-map.jsx: the 24h-TTL cache and the AI-response
// parser. IO injected (storage + clock) so it's testable without localStorage.
// The component shell (state + JSX) migrates in a later sub-slice and calls these.

const TTL_MS = 24 * 60 * 60 * 1000;

export interface TouristStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RefCity {
  name: string;
  lat: number;
  lng: number;
}

export function readTouristCache(key: string, storage: TouristStorage, now: number = Date.now()): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { _at?: number; data?: unknown };
    if (now - (obj._at || 0) > TTL_MS) return null;
    return obj.data ?? null;
  } catch {
    return null;
  }
}

export function writeTouristCache(
  key: string,
  data: unknown,
  storage: TouristStorage,
  now: number = Date.now(),
): void {
  try {
    storage.setItem(key, JSON.stringify({ _at: now, data }));
  } catch {
    /* over-quota — silently drop */
  }
}

// Strip code fences / leading prose, then parse from the first "{".
export function parseTouristResponse(text: string): unknown {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const i = cleaned.indexOf("{");
  if (i === -1) throw new Error("Tourist response not JSON");
  return JSON.parse(cleaned.slice(i));
}

// Reference cities — anchor the eye whether or not the verse is in view.
export const REF_CITIES: RefCity[] = [
  { name: "Jerusalem", lat: 31.78, lng: 35.22 },
  { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Babylon", lat: 32.54, lng: 44.42 },
  { name: "Athens", lat: 37.98, lng: 23.73 },
  { name: "Alexandria", lat: 31.2, lng: 29.92 },
  { name: "Damascus", lat: 33.51, lng: 36.3 },
  { name: "Antioch", lat: 36.2, lng: 36.16 },
  { name: "Patmos", lat: 37.31, lng: 26.55 },
  { name: "Carthage", lat: 36.85, lng: 10.32 },
  { name: "Memphis", lat: 29.84, lng: 31.25 },
];
