import { describe, it, expect } from "vitest";
import { readTouristCache, writeTouristCache, parseTouristResponse, REF_CITIES, type TouristStorage } from "./tourist.js";

function memStorage(seed: Record<string, string> = {}): TouristStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe("tourist cache", () => {
  it("round-trips data with an injected clock", () => {
    const s = memStorage();
    writeTouristCache("k", { places: [1] }, s, 1000);
    expect(readTouristCache("k", s, 1000)).toEqual({ places: [1] });
  });
  it("expires entries older than 24h", () => {
    const s = memStorage();
    writeTouristCache("k", { x: 1 }, s, 0);
    expect(readTouristCache("k", s, 24 * 60 * 60 * 1000 + 1)).toBeNull();
  });
  it("returns null for missing / malformed entries", () => {
    expect(readTouristCache("nope", memStorage())).toBeNull();
    expect(readTouristCache("bad", memStorage({ bad: "{not json" }))).toBeNull();
  });
});

describe("parseTouristResponse", () => {
  it("strips fences and parses from the first brace", () => {
    expect(parseTouristResponse('```json\n{"places":[]}\n```')).toEqual({ places: [] });
    expect(parseTouristResponse('here you go: {"a":1}')).toEqual({ a: 1 });
  });
  it("throws when there is no JSON object", () => {
    expect(() => parseTouristResponse("no json here")).toThrow(/not JSON/);
  });
});

describe("REF_CITIES", () => {
  it("anchors the frame with Jerusalem first", () => {
    expect(REF_CITIES[0]).toEqual({ name: "Jerusalem", lat: 31.78, lng: 35.22 });
    expect(REF_CITIES).toHaveLength(10);
  });
});
