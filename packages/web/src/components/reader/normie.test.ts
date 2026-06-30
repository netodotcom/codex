import { describe, it, expect } from "vitest";
import { normieHash, NORMIE_LANG_LABELS } from "./normie.js";

describe("normieHash", () => {
  it("is stable for known inputs (ground truth)", () => {
    expect(normieHash("abc")).toBe("22ci");
    expect(normieHash("")).toBe("0");
    expect(normieHash("love one another")).toBe("7h1pcr");
  });
  it("is deterministic", () => {
    expect(normieHash("repeat")).toBe(normieHash("repeat"));
  });
});

describe("NORMIE_LANG_LABELS", () => {
  it("maps the core i18n languages to readable names", () => {
    expect(NORMIE_LANG_LABELS["en"]).toBe("English");
    expect(NORMIE_LANG_LABELS["pt"]).toBe("Portuguese");
    expect(NORMIE_LANG_LABELS["el"]).toBe("Greek");
  });
});
