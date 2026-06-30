// Central CODEX store (Zustand vanilla — works outside React).
//
// Backlog 3.0. Slices grounded in the documented state (SPEC §6/§7): the reader
// cursor, the AI engine, and UI prefs. The window.CODEX_* globals become mirrors
// of this store via the bridge (bridge.ts), so legacy code keeps working while
// migrated code reads/writes the store.

import { createStore, type StoreApi } from "zustand/vanilla";

export interface ReaderState {
  translation: string;
  book: string;
  chapter: number;
  verse: number | null;
}

export interface EngineState {
  provider: string;
  model: string;
}

export interface PrefsState {
  lang: string;
  lightTheme: string | null;
  drift: boolean;
}

export interface CodexState {
  reader: ReaderState;
  engine: EngineState;
  prefs: PrefsState;
  setReader(patch: Partial<ReaderState>): void;
  setEngine(patch: Partial<EngineState>): void;
  setPrefs(patch: Partial<PrefsState>): void;
}

export const DEFAULTS: {
  reader: ReaderState;
  engine: EngineState;
  prefs: PrefsState;
} = {
  reader: { translation: "kjv", book: "jhn", chapter: 1, verse: null },
  engine: { provider: "anthropic", model: "default" },
  prefs: { lang: "en", lightTheme: null, drift: false },
};

export interface CodexInit {
  reader?: Partial<ReaderState>;
  engine?: Partial<EngineState>;
  prefs?: Partial<PrefsState>;
}

export type CodexStore = StoreApi<CodexState>;

export function createCodexStore(initial?: CodexInit): CodexStore {
  return createStore<CodexState>((set) => ({
    reader: { ...DEFAULTS.reader, ...initial?.reader },
    engine: { ...DEFAULTS.engine, ...initial?.engine },
    prefs: { ...DEFAULTS.prefs, ...initial?.prefs },
    setReader: (patch) => set((s) => ({ reader: { ...s.reader, ...patch } })),
    setEngine: (patch) => set((s) => ({ engine: { ...s.engine, ...patch } })),
    setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
  }));
}
