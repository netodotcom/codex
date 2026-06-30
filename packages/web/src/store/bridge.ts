// Store ↔ legacy bridge (Backlog 3.0).
//
// Mirrors the store to the legacy localStorage keys (SPEC §7) and window.CODEX_*
// globals, and hydrates the store from storage on attach. IO is injected
// (StorageLike + WindowLike) so the whole sync is testable with fakes.

import type { CodexStore, CodexState } from "./store.js";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WindowLike {
  CODEX_LANG?: string;
  CODEX_PANELS_ENGINE?: { provider: string; model: string };
  dispatchEvent?(event: { type: string; detail?: unknown }): void;
  [key: string]: unknown;
}

export const STORE_KEYS = {
  lang: "codex.lang",
  primary: "codex.primary",
  passage: "codex.passageLoc",
  lightTheme: "codex.lightTheme.v1",
} as const;

function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, "");
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

export function hydrateFromStorage(store: CodexStore, storage: StorageLike): void {
  const s = store.getState();
  const lang = storage.getItem(STORE_KEYS.lang);
  if (lang) s.setPrefs({ lang: stripQuotes(lang) });

  const theme = storage.getItem(STORE_KEYS.lightTheme);
  if (theme) s.setPrefs({ lightTheme: stripQuotes(theme) });

  const primary = storage.getItem(STORE_KEYS.primary);
  if (primary) s.setReader({ translation: stripQuotes(primary) });

  const passage = storage.getItem(STORE_KEYS.passage);
  if (passage) {
    try {
      const p: unknown = JSON.parse(passage);
      if (isObj(p) && typeof p["book"] === "string") {
        s.setReader({ book: p["book"], chapter: typeof p["chapter"] === "number" ? p["chapter"] : 1 });
      }
    } catch {
      /* ignore malformed */
    }
  }
}

function mirrorToWindow(state: CodexState, win: WindowLike): void {
  win.CODEX_LANG = state.prefs.lang;
  win.CODEX_PANELS_ENGINE = { provider: state.engine.provider, model: state.engine.model };
}

function persist(state: CodexState, storage: StorageLike): void {
  storage.setItem(STORE_KEYS.lang, state.prefs.lang);
  storage.setItem(STORE_KEYS.primary, state.reader.translation);
  storage.setItem(STORE_KEYS.passage, JSON.stringify({ book: state.reader.book, chapter: state.reader.chapter }));
  if (state.prefs.lightTheme) storage.setItem(STORE_KEYS.lightTheme, state.prefs.lightTheme);
}

export interface BridgeDeps {
  storage: StorageLike;
  win: WindowLike;
}

/** Hydrate, mirror once, then keep storage + window in sync with the store. */
export function attachBridge(store: CodexStore, deps: BridgeDeps): () => void {
  const { storage, win } = deps;
  hydrateFromStorage(store, storage);
  mirrorToWindow(store.getState(), win);
  return store.subscribe((state) => {
    persist(state, storage);
    mirrorToWindow(state, win);
    win.dispatchEvent?.({ type: "codex:lang", detail: { lang: state.prefs.lang } });
  });
}
