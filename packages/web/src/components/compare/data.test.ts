// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { C, APPS, FEATURES, PRICES, AXES, RADAR, SENTIMENT } from "./data.js";

describe("C helper", () => {
  it("creates a cell with explicit note", () => {
    expect(C("y", "Free, open source")).toEqual({ v: "y", note: "Free, open source" });
  });
  it("defaults note to empty string when omitted", () => {
    expect(C("n")).toEqual({ v: "n", note: "" });
    expect(C("$0")).toEqual({ v: "$0", note: "" });
  });
});

describe("APPS roster", () => {
  it("has exactly 7 entries with CODEX at index 0", () => {
    expect(APPS.length).toBe(7);
    expect(APPS[0]?.id).toBe("codex");
    expect(APPS[0]?.name).toBe("CODEX");
    expect(APPS[0]?.short).toBe("CDX");
  });
  it("has unique ids", () => {
    const ids = APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(7);
  });
  it("last entry is Blue Letter Bible", () => {
    expect(APPS[6]?.id).toBe("blb");
    expect(APPS[6]?.name).toBe("Blue Letter Bible");
  });
});

describe("FEATURES matrix", () => {
  it("has exactly 29 features", () => {
    expect(FEATURES.length).toBe(29);
  });
  it("each feature row has exactly 7 cells (one per app)", () => {
    for (const f of FEATURES) {
      expect(f.row.length).toBe(7);
    }
  });
  it("has unique feature keys", () => {
    const keys = FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(29);
  });
  it("the price row has correct CODEX value", () => {
    const priceFeature = FEATURES.find((f) => f.key === "price");
    expect(priceFeature?.row[0]?.v).toBe("$0");
    expect(priceFeature?.row[0]?.note).toBe("Free, open source");
  });
  it("CODEX ai_comm, ai_chat, local_llm are all y (only CODEX has AI)", () => {
    for (const key of ["ai_comm", "ai_chat", "local_llm"]) {
      const feat = FEATURES.find((f) => f.key === key);
      expect(feat?.row[0]?.v).toBe("y"); // CODEX = column 0
      expect(feat?.row[1]?.v).toBe("n"); // Logos
    }
  });
});

describe("PRICES", () => {
  it("has 7 entries matching APPS order", () => {
    expect(PRICES.length).toBe(7);
    expect(PRICES[0]?.id).toBe("codex");
    expect(PRICES[0]?.high).toBe(0);
    expect(PRICES[1]?.id).toBe("logos");
    expect(PRICES[1]?.high).toBe(5000);
  });
});

describe("AXES", () => {
  it("has exactly 8 radar axes", () => {
    expect(AXES.length).toBe(8);
    expect(AXES[0]).toBe("Original Languages");
    expect(AXES[1]).toBe("AI Features");
  });
});

describe("RADAR", () => {
  it("each app has exactly 8 scores matching AXES count", () => {
    const appIds = APPS.map((a) => a.id);
    for (const id of appIds) {
      const scores = RADAR[id];
      expect(scores).toBeDefined();
      expect(scores?.length).toBe(8);
    }
  });
  it("CODEX AI Features score is highest (95)", () => {
    expect(RADAR["codex"]?.[1]).toBe(95);
  });
  it("CODEX Offline score is 100", () => {
    expect(RADAR["codex"]?.[2]).toBe(100);
  });
});

describe("SENTIMENT", () => {
  it("has entries for all 7 apps", () => {
    for (const a of APPS) {
      expect(SENTIMENT[a.id]).toBeDefined();
    }
  });
  it("CODEX love list mentions AI", () => {
    const love = SENTIMENT["codex"]?.love ?? [];
    expect(love.some((s) => s.includes("AI"))).toBe(true);
  });
  it("Logos hate list mentions price", () => {
    const hate = SENTIMENT["logos"]?.hate ?? [];
    expect(hate.some((s) => s.toLowerCase().includes("price") || s.includes("$$"))).toBe(true);
  });
});
