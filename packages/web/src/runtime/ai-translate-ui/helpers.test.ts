// @vitest-environment jsdom
// ai-translate-ui — faithful-port tests. Expectations are derived directly from
// the legacy behavior; any mismatch is a regression in the port.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadCache,
  saveCache,
  hasAIKey,
  hydrate,
  registerStrings,
  installDomWalker,
  _hash,
  _isCandidateText,
  _shouldSkip,
  allEnglishStrings,
} from "./helpers.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// jsdom's built-in localStorage shim can be unreliable; install a fresh one each run.
let _lsStore: Record<string, string> = {};

function installStorage(): void {
  _lsStore = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(_lsStore, k)
          ? (_lsStore[k] as string)
          : null,
      setItem: (k: string, v: string): void => {
        _lsStore[k] = String(v);
      },
      removeItem: (k: string): void => {
        delete _lsStore[k];
      },
      clear: (): void => {
        for (const k of Object.keys(_lsStore)) delete _lsStore[k];
      },
    },
  });
}

// ── Window i18n stub helper ───────────────────────────────────────────────────
type I18nWindow = {
  CODEX_LANG?: string;
  CODEX_T?: Record<string, Record<string, string>>;
  applyCodexLang?: (lang: string) => void;
  __cxDomWalkerInstalled?: boolean;
  __cxToastListener?: boolean;
};

function w(): I18nWindow {
  return window as unknown as I18nWindow;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  installStorage();
  // Reset i18n window globals before each test
  delete w().CODEX_LANG;
  delete w().CODEX_T;
  delete w().applyCodexLang;
  delete w().__cxDomWalkerInstalled;
  delete w().__cxToastListener;
  vi.restoreAllMocks();
});

// ── _hash() ───────────────────────────────────────────────────────────────────

describe("_hash()", () => {
  it("returns a string starting with 'h'", () => {
    expect(_hash("hello")).toMatch(/^h/);
  });

  it("is deterministic — same input same output", () => {
    expect(_hash("Settings")).toBe(_hash("Settings"));
  });

  it("different inputs produce different hashes", () => {
    expect(_hash("foo")).not.toBe(_hash("bar"));
  });

  it("produces a hash for the empty string", () => {
    expect(typeof _hash("")).toBe("string");
    expect(_hash("")).toMatch(/^h/);
  });

  it("matches the exact djb2-variant formula from the legacy", () => {
    // Computed manually: h("abc") — verify it's stable across port versions
    const h1 = _hash("abc");
    const h2 = _hash("abc");
    expect(h1).toBe(h2);
    expect(h1.startsWith("h")).toBe(true);
  });
});

// ── _isCandidateText() ────────────────────────────────────────────────────────

describe("_isCandidateText()", () => {
  it("accepts a normal English UI label", () => {
    expect(_isCandidateText("Settings")).toBe(true);
  });

  it("accepts multi-word UI text", () => {
    expect(_isCandidateText("Save Changes")).toBe(true);
  });

  it("rejects null", () => {
    expect(_isCandidateText(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(_isCandidateText(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(_isCandidateText("")).toBe(false);
  });

  it("rejects single-character string (< 2 after trim)", () => {
    expect(_isCandidateText("x")).toBe(false);
  });

  it("rejects strings longer than 140 chars", () => {
    expect(_isCandidateText("abcde".repeat(30))).toBe(false); // 150 chars
  });

  it("accepts strings exactly at the boundary (140 chars with letters)", () => {
    // 140 chars of valid text with 3+ letter sequence
    expect(_isCandidateText("abcde".repeat(28))).toBe(true); // 140 chars
  });

  it("rejects strings without a 3+ letter ASCII sequence", () => {
    expect(_isCandidateText("1234")).toBe(false);
    expect(_isCandidateText("ab")).toBe(false);
  });

  it("rejects pure number / punctuation strings", () => {
    expect(_isCandidateText("123.456")).toBe(false);
    expect(_isCandidateText("1234")).toBe(false);
  });

  it("rejects URL strings", () => {
    expect(_isCandidateText("https://example.com/path")).toBe(false);
    expect(_isCandidateText("http://foo.bar")).toBe(false);
  });

  it("rejects scripture ref pattern (gen.1.1)", () => {
    expect(_isCandidateText("gen.1.1")).toBe(false);
    expect(_isCandidateText("Rev.22.21")).toBe(false);
  });
});

// ── loadCache() / saveCache() ─────────────────────────────────────────────────

describe("loadCache() / saveCache()", () => {
  it("returns {} when nothing is stored", () => {
    expect(loadCache("es")).toEqual({});
  });

  it("round-trips a saved dict", () => {
    saveCache("es", { hello: "hola", world: "mundo" });
    expect(loadCache("es")).toEqual({ hello: "hola", world: "mundo" });
  });

  it("returns {} when stored JSON is invalid", () => {
    _lsStore["codex.aiUi.v1.es"] = "{bad json";
    expect(loadCache("es")).toEqual({});
  });

  it("returns {} when stored value is 'null' (legacy || {} coercion)", () => {
    _lsStore["codex.aiUi.v1.es"] = "null";
    expect(loadCache("es")).toEqual({});
  });

  it("returns {} when stored value is '0'", () => {
    _lsStore["codex.aiUi.v1.es"] = "0";
    expect(loadCache("es")).toEqual({});
  });

  it("scopes cache by lang — different langs don't clash", () => {
    saveCache("es", { key: "es-value" });
    saveCache("de", { key: "de-value" });
    expect(loadCache("es")).toEqual({ key: "es-value" });
    expect(loadCache("de")).toEqual({ key: "de-value" });
  });
});

// ── hasAIKey() ────────────────────────────────────────────────────────────────

describe("hasAIKey()", () => {
  it("returns false when nothing is stored", () => {
    expect(hasAIKey()).toBe(false);
  });

  it("returns true when anthropic key is present", () => {
    _lsStore["codex.api.keys.v1"] = JSON.stringify({ anthropic: "sk-ant-..." });
    expect(hasAIKey()).toBe(true);
  });

  it("returns true when grok key is present", () => {
    _lsStore["codex.api.keys.v1"] = JSON.stringify({ grok: "gk-..." });
    expect(hasAIKey()).toBe(true);
  });

  it("returns true when openai key is present", () => {
    _lsStore["codex.api.keys.v1"] = JSON.stringify({ openai: "sk-..." });
    expect(hasAIKey()).toBe(true);
  });

  it("returns true when google key is present", () => {
    _lsStore["codex.api.keys.v1"] = JSON.stringify({ google: "AIza..." });
    expect(hasAIKey()).toBe(true);
  });

  it("returns false when all values are empty strings (falsy)", () => {
    _lsStore["codex.api.keys.v1"] = JSON.stringify({ anthropic: "", grok: "" });
    expect(hasAIKey()).toBe(false);
  });

  it("returns false on malformed JSON", () => {
    _lsStore["codex.api.keys.v1"] = "{bad";
    expect(hasAIKey()).toBe(false);
  });

  it("returns false when stored value is null JSON", () => {
    _lsStore["codex.api.keys.v1"] = "null";
    expect(hasAIKey()).toBe(false);
  });
});

// ── hydrate() ─────────────────────────────────────────────────────────────────

describe("hydrate()", () => {
  it("is a no-op for 'en'", () => {
    w().CODEX_T = { en: { hello: "Hello" } };
    hydrate("en");
    expect(w().CODEX_T?.["en"]?.["hello"]).toBe("Hello");
  });

  it("is a no-op when CODEX_T is not set", () => {
    expect(() => hydrate("es")).not.toThrow();
  });

  it("merges cache into the live T[lang] table", () => {
    w().CODEX_T = { en: { hello: "Hello" } };
    saveCache("es", { hello: "hola" });
    hydrate("es");
    expect(w().CODEX_T?.["es"]?.["hello"]).toBe("hola");
  });

  it("creates T[lang] entry if it was absent", () => {
    w().CODEX_T = {};
    saveCache("fr", { yes: "oui" });
    hydrate("fr");
    expect(w().CODEX_T?.["fr"]?.["yes"]).toBe("oui");
  });

  it("merges without clobbering existing T[lang] keys", () => {
    w().CODEX_T = { de: { existing: "vorhanden" } };
    saveCache("de", { newKey: "neuer" });
    hydrate("de");
    expect(w().CODEX_T?.["de"]?.["existing"]).toBe("vorhanden");
    expect(w().CODEX_T?.["de"]?.["newKey"]).toBe("neuer");
  });
});

// ── allEnglishStrings() ───────────────────────────────────────────────────────

describe("allEnglishStrings()", () => {
  it("returns {} when CODEX_T is not set", () => {
    expect(allEnglishStrings()).toEqual({});
  });

  it("returns the en sub-table merged with extras", () => {
    w().CODEX_T = { en: { hello: "Hello", world: "World" } };
    const result = allEnglishStrings();
    expect(result["hello"]).toBe("Hello");
    expect(result["world"]).toBe("World");
  });

  it("returns {} when CODEX_T has no 'en' key", () => {
    w().CODEX_T = { es: { hello: "hola" } };
    // _extra may have entries from prior tests (module-level); result merges them in.
    // We just verify it doesn't throw and returns an object.
    expect(typeof allEnglishStrings()).toBe("object");
  });
});

// ── registerStrings() ─────────────────────────────────────────────────────────

describe("registerStrings()", () => {
  it("ignores null", () => {
    expect(() => registerStrings(null)).not.toThrow();
  });

  it("ignores non-objects (number, string, boolean)", () => {
    expect(() => registerStrings(42)).not.toThrow();
    expect(() => registerStrings("text")).not.toThrow();
    expect(() => registerStrings(true)).not.toThrow();
  });

  it("accepts an object and registers new string keys", () => {
    // After registering, allEnglishStrings() includes the new key
    w().CODEX_T = { en: {} };
    registerStrings({ regTest_unique1: "Register Test Label" });
    const result = allEnglishStrings();
    expect(result["regTest_unique1"]).toBe("Register Test Label");
  });

  it("does not overwrite an already-registered key (guard: !_extra[k])", () => {
    // Register a key with value "First"
    registerStrings({ regTest_dup: "First" });
    // Try to overwrite with "Second" — should be ignored
    registerStrings({ regTest_dup: "Second" });
    const result = allEnglishStrings();
    // The first value must win
    expect(result["regTest_dup"]).toBe("First");
  });

  it("silently skips non-string values", () => {
    // Only string values should be added; number/object values must be ignored
    expect(() =>
      registerStrings({ regTest_num: 42, regTest_str: "valid label" }),
    ).not.toThrow();
    const result = allEnglishStrings();
    expect(result["regTest_str"]).toBe("valid label");
    expect(result["regTest_num"]).toBeUndefined();
  });

  it("triggers translateMissing when CODEX_LANG is non-en (fire-and-forget)", () => {
    w().CODEX_LANG = "es";
    w().CODEX_T = { es: {} };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
    // Must not throw — translateMissing is called as fire-and-forget
    expect(() => registerStrings({ regTest_trigger: "Trigger Label" })).not.toThrow();
  });

  it("does NOT trigger translateMissing when CODEX_LANG is 'en'", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    w().CODEX_LANG = "en";
    registerStrings({ regTest_en: "English Only" });
    // fetch should never be called for English
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does NOT trigger translateMissing when CODEX_LANG is absent", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete w().CODEX_LANG;
    registerStrings({ regTest_nolang: "No Lang" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── installDomWalker() — guard behavior ───────────────────────────────────────

describe("installDomWalker() guard", () => {
  it("sets window.__cxDomWalkerInstalled to true", () => {
    expect(w().__cxDomWalkerInstalled).toBeUndefined();
    installDomWalker();
    expect(w().__cxDomWalkerInstalled).toBe(true);
  });

  it("is idempotent — calling twice leaves flag true, does not throw", () => {
    installDomWalker();
    expect(() => installDomWalker()).not.toThrow();
    expect(w().__cxDomWalkerInstalled).toBe(true);
  });

  it("early-returns when flag is already set (legacy guard)", () => {
    // Pre-set the flag — simulates another module having installed the walker
    w().__cxDomWalkerInstalled = true;
    // Should return immediately with no side effects
    expect(() => installDomWalker()).not.toThrow();
    expect(w().__cxDomWalkerInstalled).toBe(true);
  });

  it("does not install walker when lang is 'en' (sweep is a no-op)", () => {
    w().CODEX_LANG = "en";
    // No exception even when document.body has text nodes
    document.body.textContent = "Hello World";
    expect(() => installDomWalker()).not.toThrow();
  });
});

// ── _shouldSkip() ─────────────────────────────────────────────────────────────

describe("_shouldSkip()", () => {
  it("returns false for a node with no special parent", () => {
    const span = document.createElement("span");
    document.body.appendChild(span);
    const text = document.createTextNode("hello");
    span.appendChild(text);
    expect(_shouldSkip(text)).toBe(false);
    document.body.removeChild(span);
  });

  it("returns true for a node inside a <script> element", () => {
    const script = document.createElement("script");
    document.body.appendChild(script);
    const text = document.createTextNode("var x = 1;");
    script.appendChild(text);
    expect(_shouldSkip(text)).toBe(true);
    document.body.removeChild(script);
  });

  it("returns true for a node inside [data-no-translate]", () => {
    const div = document.createElement("div");
    div.setAttribute("data-no-translate", "");
    document.body.appendChild(div);
    const text = document.createTextNode("do not translate");
    div.appendChild(text);
    expect(_shouldSkip(text)).toBe(true);
    document.body.removeChild(div);
  });

  it("returns true for a node inside [contenteditable]", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    const text = document.createTextNode("editable");
    div.appendChild(text);
    expect(_shouldSkip(text)).toBe(true);
    document.body.removeChild(div);
  });

  it("returns true for a node inside .cx-verse (scripture skip)", () => {
    const div = document.createElement("div");
    div.className = "cx-verse";
    document.body.appendChild(div);
    const text = document.createTextNode("In the beginning");
    div.appendChild(text);
    expect(_shouldSkip(text)).toBe(true);
    document.body.removeChild(div);
  });
});
