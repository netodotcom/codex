import { describe, it, expect } from "vitest";
import { translate, createI18n, langName, isRtl, langs } from "./i18n.js";

describe("translate", () => {
  it("returns the active-language string", () => {
    expect(translate("settings", "en")).toBe("Settings");
    expect(translate("settings", "es")).toBe("Ajustes");
  });
  it("falls back to English for an unknown language", () => {
    expect(translate("settings", "zz")).toBe("Settings");
  });
  it("returns the key itself when missing everywhere", () => {
    expect(translate("___nope___", "en")).toBe("___nope___");
  });
  it("drift table overrides regardless of language", () => {
    expect(translate("settings", "en", { drift: true })).toBe("Sigil Console");
    expect(translate("settings", "es", { drift: true })).toBe("Sigil Console");
  });
});

describe("createI18n", () => {
  it("tracks language and drift state", () => {
    const i18n = createI18n();
    expect(i18n.lang).toBe("en");
    expect(i18n.t("settings")).toBe("Settings");

    i18n.setLang("es");
    expect(i18n.t("settings")).toBe("Ajustes");

    i18n.setLang("not-a-lang"); // ignored
    expect(i18n.lang).toBe("es");

    i18n.setDrift(true);
    expect(i18n.t("settings")).toBe("Sigil Console");
  });

  it("seeds from init options", () => {
    expect(createI18n({ lang: "es" }).lang).toBe("es");
    expect(createI18n({ lang: "bogus" }).lang).toBe("en");
  });
});

describe("langName / isRtl / langs", () => {
  it("maps ids to human names", () => {
    expect(langName("es")).toBe("Spanish");
    expect(langName()).toBe("English");
    expect(langName("xx")).toBe("English");
  });
  it("knows Hebrew is RTL", () => {
    expect(isRtl("he")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });
  it("registers 9 languages", () => {
    expect(langs.length).toBe(9);
    expect(langs.map((l) => l.id)).toContain("pt");
  });
});
