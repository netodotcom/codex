import { describe, it, expect } from "vitest";
import {
  projXY,
  pointsAttr,
  poiSignificance,
  poiGlyph,
  haversineKm,
  touristCacheKey,
  eraTint,
  BOUNDS,
  MAP_W,
  MAP_H,
  SEAS,
  RIVERS,
} from "./geo.js";

describe("projXY", () => {
  it("projects the bounds corners to the viewport corners", () => {
    expect(projXY(BOUNDS.latMax, BOUNDS.lngMin)).toEqual([0, 0]);
    expect(projXY(BOUNDS.latMin, BOUNDS.lngMax)).toEqual([MAP_W, MAP_H]);
  });
  it("projects an interior point (lat 33, lng 35)", () => {
    const [x, y] = projXY(33, 35);
    expect(x).toBeCloseTo(334.2857, 3);
    expect(y).toBe(140);
  });
});

describe("pointsAttr", () => {
  it("joins projected points into an SVG points string", () => {
    expect(pointsAttr([[BOUNDS.latMax, BOUNDS.lngMin], [BOUNDS.latMin, BOUNDS.lngMax]])).toBe(
      `0,0 ${MAP_W},${MAP_H}`,
    );
  });
});

describe("poiSignificance / poiGlyph", () => {
  it("ranks settlements above geography", () => {
    expect(poiSignificance("city")).toBe(3);
    expect(poiSignificance("ruin")).toBe(2);
    expect(poiSignificance("river")).toBe(1);
    expect(poiSignificance("")).toBe(1);
  });
  it("maps kinds to glyphs", () => {
    expect(poiGlyph("city")).toBe("▣");
    expect(poiGlyph("river")).toBe("≈");
    expect(poiGlyph("unknown")).toBe("•");
  });
});

describe("haversineKm", () => {
  it("is 0 for the same point and ~111km for 1° of longitude at the equator", () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });
});

describe("touristCacheKey", () => {
  it("keys by 3-decimal coordinates", () => {
    expect(touristCacheKey({ lat: 31.7777, lng: 35.2222 })).toBe("codex.tourist.31.778,35.222");
  });
});

describe("eraTint", () => {
  it("interpolates accent → accent-2 across the list", () => {
    expect(eraTint(0, 1)).toContain("7ee0ff) 50%");
    expect(eraTint(0, 3)).toContain("7ee0ff) 100%");
    expect(eraTint(2, 3)).toContain("ffc46b) 100%");
  });
});

describe("map data", () => {
  it("ships the seas and rivers as [lat,lng] polylines", () => {
    expect(Object.keys(SEAS)).toContain("mediterranean");
    expect(Object.keys(RIVERS)).toEqual(["nile", "tigris", "euphr", "jordan"]);
    expect(SEAS["mediterranean"]?.[0]).toEqual([36, -5]);
  });
});
