// @vitest-environment jsdom
// i18n — faithful-port tests. Expectations are derived directly from the
// legacy translation tables and t()/applyCodexLang()/codexLangName()/
// applyCodexDrift() logic; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll } from "vitest";
import {
  translate, isKnownLang, applyLangSideEffects, resolveLangName,
} from "./helpers.js";

// Minimal typed view of the window surface this engine assigns, for tests.
interface I18nTestWindow {
  t: (key: string) => string;
  CODEX_LANG: string;
  CODEX_LANGS: ReadonlyArray<{ id: string; label: string; glyph: string }>;
  CODEX_T: Record<string, Record<string, string>>;
  CODEX_T_DRIFT: Record<string, string>;
  CODEX_DRIFT: boolean;
  applyCodexLang: (lang: string) => void;
  codexLangName: (id?: string) => string;
  applyCodexDrift: (on: boolean) => void;
}
function tw(): I18nTestWindow {
  return window as unknown as I18nTestWindow;
}

// Import the entry point to assign all window globals (mirrors runtime boot).
beforeAll(async () => {
  await import("./index.js");
});

// ── window surface / parity probe — run first, before any state mutation ────
describe("window surface (parity probe + initial state)", () => {
  it("typeof window.t === 'function' (parity probe requirement)", () => {
    expect(typeof (window as unknown as Record<string, unknown>)["t"]).toBe("function");
  });

  it("CODEX_LANGS is the 9-language list", () => {
    expect(Array.isArray(tw().CODEX_LANGS)).toBe(true);
    expect(tw().CODEX_LANGS.length).toBe(9);
    expect(tw().CODEX_LANGS.map((l) => l.id)).toEqual([
      "en", "es", "de", "pt", "fr", "la", "he", "el", "hi",
    ]);
  });

  it("CODEX_T and CODEX_T_DRIFT are objects", () => {
    expect(typeof tw().CODEX_T).toBe("object");
    expect(typeof tw().CODEX_T_DRIFT).toBe("object");
  });

  it("CODEX_LANG defaults to 'en' and CODEX_DRIFT defaults to false", () => {
    expect(tw().CODEX_LANG).toBe("en");
    expect(tw().CODEX_DRIFT).toBe(false);
  });

  it("applyCodexLang / codexLangName / applyCodexDrift are functions", () => {
    expect(typeof tw().applyCodexLang).toBe("function");
    expect(typeof tw().codexLangName).toBe("function");
    expect(typeof tw().applyCodexDrift).toBe("function");
  });
});

// ── translation lookup via window.t ──────────────────────────────────────────
describe("window.t() translation lookup", () => {
  it("returns the active language's string", () => {
    tw().CODEX_LANG = "es";
    expect(tw().t("settings")).toBe("Ajustes");
  });

  it("returns a Hebrew string for lang='he'", () => {
    tw().CODEX_LANG = "he";
    expect(tw().t("settings")).toBe("הגדרות");
  });

  it("falls back to English when the active dict lacks the key (cx.* is English-only)", () => {
    // NOTE: preserved from legacy — the entire engagement-layer ("cx.*") key
    // family is only defined under `en`; every other language deliberately
    // falls through to English for these keys.
    tw().CODEX_LANG = "es";
    expect(tw().t("cx.continuity.title")).toBe("Continuity");
  });

  it("falls back to the key itself when missing from both dict and English", () => {
    expect(tw().t("totally.not.a.real.key")).toBe("totally.not.a.real.key");
  });

  it("an unknown CODEX_LANG value falls back to the English dict", () => {
    tw().CODEX_LANG = "xx";
    expect(tw().t("settings")).toBe("Settings");
    tw().CODEX_LANG = "en"; // restore
  });
});

// ── drift overlay ─────────────────────────────────────────────────────────────
describe("drift overlay (window.CODEX_DRIFT)", () => {
  it("drift dict takes priority over the active language when both the flag and the key are present", () => {
    tw().CODEX_LANG = "en";
    tw().CODEX_DRIFT = true;
    expect(tw().t("settings")).toBe("Sigil Console");
  });

  it("a key absent from the drift dict still falls through to the normal lang lookup", () => {
    tw().CODEX_DRIFT = true;
    expect(tw().t("cx.continuity.title")).toBe("Continuity");
  });

  it("drift is inert when the flag is off, even for keys the drift dict defines", () => {
    tw().CODEX_DRIFT = false;
    expect(tw().t("settings")).toBe("Settings");
  });
});

// ── applyCodexLang ────────────────────────────────────────────────────────────
describe("window.applyCodexLang()", () => {
  it("sets CODEX_LANG and the document lang/dir attributes for an LTR language", () => {
    tw().applyCodexLang("pt");
    expect(tw().CODEX_LANG).toBe("pt");
    expect(document.documentElement.getAttribute("lang")).toBe("pt");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
  });

  it("sets dir='rtl' for Hebrew (the only RTL language)", () => {
    tw().applyCodexLang("he");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
  });

  it("is a no-op for an unknown language id", () => {
    tw().applyCodexLang("pt");
    tw().applyCodexLang("not-a-real-lang");
    expect(tw().CODEX_LANG).toBe("pt");
  });

  it("dispatches a codex:lang CustomEvent with detail.lang", () => {
    let seen: unknown;
    const handler = (e: Event): void => { seen = (e as CustomEvent).detail; };
    window.addEventListener("codex:lang", handler);
    tw().applyCodexLang("fr");
    window.removeEventListener("codex:lang", handler);
    expect(seen).toEqual({ lang: "fr" });
    tw().applyCodexLang("en"); // restore
  });
});

// ── codexLangName ─────────────────────────────────────────────────────────────
describe("window.codexLangName()", () => {
  it("maps a known id to its English display name", () => {
    expect(tw().codexLangName("de")).toBe("German");
  });

  it("falls back to the current CODEX_LANG when id is omitted", () => {
    tw().CODEX_LANG = "fr";
    expect(tw().codexLangName()).toBe("French");
  });

  it("does NOT retry CODEX_LANG when id is present-but-unknown — falls straight to 'English'", () => {
    // NOTE: preserved from legacy — `map[id || window.CODEX_LANG || "en"] || "English"`.
    // A truthy-but-invalid `id` short-circuits the `||` chain, so it is never
    // replaced by CODEX_LANG; only a falsy id would fall through to it.
    tw().CODEX_LANG = "fr";
    expect(tw().codexLangName("bogus")).toBe("English");
  });
});

// ── applyCodexDrift ────────────────────────────────────────────────────────────
describe("window.applyCodexDrift()", () => {
  it("sets CODEX_DRIFT and dispatches a codex:lang event with detail.drift", () => {
    let seen: unknown;
    const handler = (e: Event): void => { seen = (e as CustomEvent).detail; };
    window.addEventListener("codex:lang", handler);
    tw().applyCodexDrift(true);
    window.removeEventListener("codex:lang", handler);
    expect(tw().CODEX_DRIFT).toBe(true);
    expect(seen).toEqual({ drift: true });
  });

  it("reverts CODEX_DRIFT to false", () => {
    tw().applyCodexDrift(false);
    expect(tw().CODEX_DRIFT).toBe(false);
  });
});

// ── pure helpers.ts exports (direct, argument-based — no window) ────────────
describe("helpers.ts pure functions", () => {
  it("isKnownLang() recognizes all 9 language ids and rejects unknown ones", () => {
    for (const id of ["en", "es", "de", "pt", "fr", "la", "he", "el", "hi"]) {
      expect(isKnownLang(id)).toBe(true);
    }
    expect(isKnownLang("xx")).toBe(false);
  });

  it("translate() reproduces the exact drift > lang > English > key fallback chain", () => {
    expect(translate("settings", "es", false)).toBe("Ajustes");
    expect(translate("settings", "es", true)).toBe("Sigil Console");
    expect(translate("cx.continuity.title", "es", true)).toBe("Continuity");
    expect(translate("no.such.key", "en", false)).toBe("no.such.key");
    expect(translate("settings", "not-a-lang", false)).toBe("Settings");
  });

  it("applyLangSideEffects() sets lang/dir attributes directly", () => {
    applyLangSideEffects("he");
    expect(document.documentElement.getAttribute("lang")).toBe("he");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    applyLangSideEffects("en");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
  });

  it("resolveLangName() mirrors the id/currentLang/'en' fallback chain", () => {
    expect(resolveLangName("de", "fr")).toBe("German");
    expect(resolveLangName(undefined, "fr")).toBe("French");
    expect(resolveLangName(undefined, undefined)).toBe("English");
    expect(resolveLangName("bogus", "fr")).toBe("English");
  });
});
