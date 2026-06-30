import { describe, it, expect } from "vitest";
import { createCodexStore, DEFAULTS } from "./store.js";
import { attachBridge, hydrateFromStorage, STORE_KEYS, type StorageLike, type WindowLike } from "./bridge.js";

function memStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

function fakeWindow(): WindowLike & { events: Array<{ type: string; detail?: unknown }> } {
  const events: Array<{ type: string; detail?: unknown }> = [];
  return { events, dispatchEvent: (e) => void events.push(e) };
}

describe("createCodexStore", () => {
  it("seeds defaults and patches slices", () => {
    const store = createCodexStore();
    expect(store.getState().reader).toEqual(DEFAULTS.reader);
    store.getState().setReader({ chapter: 3, verse: 16 });
    expect(store.getState().reader).toMatchObject({ book: "jhn", chapter: 3, verse: 16 });
    store.getState().setEngine({ provider: "groq" });
    expect(store.getState().engine).toEqual({ provider: "groq", model: "default" });
  });

  it("accepts initial overrides", () => {
    const store = createCodexStore({ prefs: { lang: "pt" } });
    expect(store.getState().prefs.lang).toBe("pt");
  });

  it("notifies subscribers on change", () => {
    const store = createCodexStore();
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.getState().setPrefs({ drift: true });
    expect(calls).toBe(1);
    unsub();
    store.getState().setPrefs({ drift: false });
    expect(calls).toBe(1);
  });
});

describe("bridge — hydrate", () => {
  it("reads legacy localStorage keys into the store", () => {
    const store = createCodexStore();
    hydrateFromStorage(
      store,
      memStorage({
        [STORE_KEYS.lang]: "es",
        [STORE_KEYS.primary]: '"web"',
        [STORE_KEYS.passage]: JSON.stringify({ book: "gen", chapter: 2 }),
      }),
    );
    expect(store.getState().prefs.lang).toBe("es");
    expect(store.getState().reader.translation).toBe("web"); // quotes stripped
    expect(store.getState().reader).toMatchObject({ book: "gen", chapter: 2 });
  });

  it("ignores malformed passage JSON", () => {
    const store = createCodexStore();
    hydrateFromStorage(store, memStorage({ [STORE_KEYS.passage]: "{not json" }));
    expect(store.getState().reader.book).toBe("jhn"); // default kept
  });
});

describe("bridge — sync", () => {
  it("mirrors store → window + persists, and fires codex:lang", () => {
    const store = createCodexStore();
    const storage = memStorage();
    const win = fakeWindow();
    const unsub = attachBridge(store, { storage, win });

    // initial mirror
    expect(win.CODEX_LANG).toBe("en");
    expect(win.CODEX_PANELS_ENGINE).toEqual({ provider: "anthropic", model: "default" });

    store.getState().setPrefs({ lang: "pt" });
    expect(win.CODEX_LANG).toBe("pt");
    expect(storage.map.get(STORE_KEYS.lang)).toBe("pt");
    expect(win.events.at(-1)).toEqual({ type: "codex:lang", detail: { lang: "pt" } });

    store.getState().setEngine({ provider: "groq", model: "llama" });
    expect(win.CODEX_PANELS_ENGINE).toEqual({ provider: "groq", model: "llama" });

    unsub();
    store.getState().setPrefs({ lang: "de" });
    expect(win.CODEX_LANG).toBe("pt"); // no longer syncing after unsub
  });

  it("round-trips: persisted state rehydrates into a fresh store", () => {
    const storage = memStorage();
    const a = createCodexStore();
    attachBridge(a, { storage, win: fakeWindow() });
    a.getState().setReader({ translation: "esv", book: "rom", chapter: 8 });

    const b = createCodexStore();
    hydrateFromStorage(b, storage);
    expect(b.getState().reader).toMatchObject({ translation: "esv", book: "rom", chapter: 8 });
  });
});
