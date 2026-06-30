// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { THEMES, DEFAULT, KEY } from "./data.js";
import type { LightTheme } from "./types.js";
import "./index.js"; // run load-time side effects once (apply + MutationObserver)

// ── localStorage mock ─────────────────────────────────────────────────────────
// Installs a fresh in-memory store before each test so state never leaks.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

type LtWindow = Window & {
  CODEX_LIGHT_THEMES?: {
    list: () => LightTheme[];
    get: () => string;
    set: (name: string) => void;
    DEFAULT: string;
  };
};

const lw = (): LtWindow => window as unknown as LtWindow;

beforeEach(() => {
  installStorage();
  // Reset any data-light-theme DOM state left by a previous test
  document.body.removeAttribute("data-light-theme");
  const app = document.querySelector(".cx-app");
  if (app) app.removeAttribute("data-light-theme");
});

// ── Static catalog ────────────────────────────────────────────────────────────
describe("data — theme catalog (matches legacy)", () => {
  const EXPECTED_IDS = [
    "parchment", "vellum", "linen", "sandstone",
    "sage", "solarized", "slate", "rose", "old-book",
  ];

  it("has exactly 9 themes", () => {
    expect(THEMES).toHaveLength(9);
  });

  it("contains all expected ids in legacy order", () => {
    expect(THEMES.map(t => t.id)).toEqual(EXPECTED_IDS);
  });

  it("DEFAULT is 'parchment'", () => {
    expect(DEFAULT).toBe("parchment");
  });

  it("KEY is 'codex.lightTheme.v1'", () => {
    expect(KEY).toBe("codex.lightTheme.v1");
  });

  it("every theme has id, label, bg, fg, accent as strings", () => {
    for (const theme of THEMES) {
      expect(typeof theme.id).toBe("string");
      expect(typeof theme.label).toBe("string");
      expect(typeof theme.bg).toBe("string");
      expect(typeof theme.fg).toBe("string");
      expect(typeof theme.accent).toBe("string");
    }
  });

  it("parchment has correct color values", () => {
    const p = THEMES.find(t => t.id === "parchment");
    expect(p).toMatchObject({ bg: "#ece4d2", fg: "#1a1d28", accent: "#0a6884" });
  });

  it("old-book (hyphenated id) has correct values", () => {
    const ob = THEMES.find(t => t.id === "old-book");
    expect(ob).toMatchObject({ label: "Old Book", bg: "#f1e8d2", fg: "#0a0608", accent: "#6a1a08" });
  });

  it("solarized matches legacy exactly", () => {
    const s = THEMES.find(t => t.id === "solarized");
    expect(s).toMatchObject({ label: "Solarized", bg: "#fdf6e3", fg: "#073642", accent: "#268bd2" });
  });
});

// ── Window contract ───────────────────────────────────────────────────────────
describe("window.CODEX_LIGHT_THEMES", () => {
  it("is set on the window after import", () => {
    expect(lw().CODEX_LIGHT_THEMES).toBeDefined();
  });

  it("exposes list, get, set, DEFAULT", () => {
    const api = lw().CODEX_LIGHT_THEMES!;
    expect(typeof api.list).toBe("function");
    expect(typeof api.get).toBe("function");
    expect(typeof api.set).toBe("function");
    expect(typeof api.DEFAULT).toBe("string");
  });

  it("DEFAULT matches module-level DEFAULT", () => {
    expect(lw().CODEX_LIGHT_THEMES!.DEFAULT).toBe(DEFAULT);
  });

  describe("list()", () => {
    it("returns all 9 themes", () => {
      expect(lw().CODEX_LIGHT_THEMES!.list()).toHaveLength(9);
    });

    it("ids match THEMES in order", () => {
      expect(lw().CODEX_LIGHT_THEMES!.list().map(t => t.id))
        .toEqual(THEMES.map(t => t.id));
    });

    it("returns a copy — each call yields a distinct array reference", () => {
      const api = lw().CODEX_LIGHT_THEMES!;
      expect(api.list()).not.toBe(api.list());
    });
  });

  describe("get()", () => {
    it("returns DEFAULT when nothing is stored", () => {
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe(DEFAULT);
    });

    it("returns stored value when it is a valid theme id", () => {
      localStorage.setItem(KEY, "sage");
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe("sage");
    });

    it("returns stored 'old-book' (hyphenated id)", () => {
      localStorage.setItem(KEY, "old-book");
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe("old-book");
    });

    it("falls back to DEFAULT for an unknown stored value", () => {
      localStorage.setItem(KEY, "neon-pink");
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe(DEFAULT);
    });

    it("falls back to DEFAULT when stored value is empty string", () => {
      localStorage.setItem(KEY, "");
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe(DEFAULT);
    });
  });

  describe("set()", () => {
    it("persists the chosen theme to localStorage", () => {
      lw().CODEX_LIGHT_THEMES!.set("slate");
      expect(localStorage.getItem(KEY)).toBe("slate");
    });

    it("dispatches codex:light-theme-change with the theme name", () => {
      let detail: unknown = null;
      window.addEventListener("codex:light-theme-change", (e) => {
        detail = (e as CustomEvent).detail;
      }, { once: true });
      lw().CODEX_LIGHT_THEMES!.set("sage");
      expect(detail).toEqual({ theme: "sage" });
    });

    it("applies data-light-theme attribute on document.body when no .cx-app", () => {
      lw().CODEX_LIGHT_THEMES!.set("rose");
      expect(document.body.getAttribute("data-light-theme")).toBe("rose");
    });

    it("removes data-light-theme when setting DEFAULT (parchment)", () => {
      document.body.setAttribute("data-light-theme", "slate");
      lw().CODEX_LIGHT_THEMES!.set(DEFAULT);
      expect(document.body.hasAttribute("data-light-theme")).toBe(false);
    });

    it("applies data-light-theme on .cx-app when it exists", () => {
      const app = document.createElement("div");
      app.className = "cx-app";
      document.body.appendChild(app);
      lw().CODEX_LIGHT_THEMES!.set("vellum");
      expect(app.getAttribute("data-light-theme")).toBe("vellum");
      document.body.removeChild(app);
    });

    it("get() after set() returns the newly set theme", () => {
      lw().CODEX_LIGHT_THEMES!.set("sandstone");
      expect(lw().CODEX_LIGHT_THEMES!.get()).toBe("sandstone");
    });
  });
});
