import { describe, it, expect } from "vitest";
import { BIBLE_SITES, MANUSCRIPT_SITES, PILGRIM_ROUTES } from "./sites.js";

describe("verse-map static registries", () => {
  it("ships the biblical sites with unique ids and valid coordinates", () => {
    expect(BIBLE_SITES).toHaveLength(26);
    const ids = BIBLE_SITES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BIBLE_SITES.every((s) => Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180)).toBe(true);
    expect(BIBLE_SITES.find((s) => s.id === "jericho")).toMatchObject({ name: "Jericho", refs: ["josh.6.20"] });
  });

  it("ships manuscript sites and pilgrim routes", () => {
    expect(MANUSCRIPT_SITES).toHaveLength(5);
    expect(MANUSCRIPT_SITES.find((s) => s.name === "Nag Hammadi")).toBeDefined();
    expect(PILGRIM_ROUTES).toHaveLength(4);
    expect(PILGRIM_ROUTES[0]?.name).toBe("Via Dolorosa");
    expect(PILGRIM_ROUTES.every((r) => r.path.length >= 2)).toBe(true);
  });
});
