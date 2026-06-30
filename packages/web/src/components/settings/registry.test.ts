import { describe, it, expect } from "vitest";
import { groupForKey, humanize, inferKind, groupForSection, isLight, SETTINGS_GROUPS, SETTINGS_REGISTRY } from "./registry.js";

describe("groupForKey (ground truth)", () => {
  it("routes known-shaped keys, with the faithful quirks", () => {
    expect(groupForKey("accent")).toBe("APPEARANCE");
    expect(groupForKey("overlayTalmud")).toBe("SCRIPTURE");
    expect(groupForKey("provider")).toBe("AI & KEYS");
    expect(groupForKey("continuityEnabled")).toBe("INSTRUMENTS");
    // "highlightColor" matches "light" → APPEARANCE (quirk preserved)
    expect(groupForKey("highlightColor")).toBe("APPEARANCE");
    // "divineGold" does NOT match "golden" → falls through to SYSTEM
    expect(groupForKey("divineGold")).toBe("SYSTEM");
    expect(groupForKey("randomKey")).toBe("SYSTEM");
  });
});

describe("humanize (ground truth)", () => {
  it("camelCase → spaced Title-ish text", () => {
    expect(humanize("fontScale")).toBe("Font Scale");
    expect(humanize("divineHebrew")).toBe("Divine Hebrew");
    expect(humanize("notify_cadence")).toBe("Notify cadence");
    expect(humanize("a.b-c")).toBe("A b c");
  });
});

describe("inferKind", () => {
  it("maps value types to control kinds", () => {
    expect(inferKind(true)).toBe("toggle");
    expect(inferKind(5)).toBe("number");
    expect(inferKind("x")).toBe("text");
    expect(inferKind({})).toBe("text");
  });
});

describe("groupForSection (ground truth)", () => {
  it("uses the fixed map then i18n-aware regexes", () => {
    expect(groupForSection("AI Model")).toBe("AI & KEYS");
    expect(groupForSection("Personalization")).toBe("DANGER");
    expect(groupForSection("Look")).toBe("APPEARANCE");
    expect(groupForSection("Marks")).toBe("READING");
    expect(groupForSection("Cross-device sync")).toBe("SYSTEM");
    expect(groupForSection("Apariencia")).toBe("APPEARANCE");
    expect(groupForSection("Whatever")).toBe("SYSTEM");
  });
});

describe("isLight", () => {
  it("classifies perceived luminance", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#000000")).toBe(false);
    expect(isLight("#7ee0ff")).toBe(true);
    expect(isLight("#fff")).toBe(true);
    expect(isLight("zzz")).toBe(true); // NaN → defaults to light
  });
});

describe("registry integrity", () => {
  it("every entry's group is a known group", () => {
    for (const e of SETTINGS_REGISTRY) {
      expect(SETTINGS_GROUPS).toContain(e.group);
    }
  });
  it("keys are unique", () => {
    const keys = SETTINGS_REGISTRY.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
