// app — the typed window surface for the shell (migrated from app.jsx). The App
// orchestrator is glue: it owns passage/marks/desk state and wires dozens of
// runtime globals (the reader plugin, the panels, BIBLE, CODEX_PANELS, the sync
// engine, the mobile shell, …). Centralise the typing here. Window-provided
// React components are typed loosely (AnyComponent) since they cross the
// classic-script IIFE boundary.
import type React from "react";

export type AnyComponent = React.ComponentType<Record<string, unknown>>;

export interface AppBook {
  id: string;
  name: string;
  chapters: number;
  testament?: string;
}
export interface AppTranslation {
  id: string;
  name: string;
  glyph: string;
  year?: string | number;
  lang?: string;
  license?: string;
  source?: string;
}
export interface AppCodexData {
  translations: AppTranslation[];
  books: AppBook[];
  defaultPassage: { bookId: string; chapter: number };
  seedPanels: Record<string, Record<string, unknown> & { disarm?: unknown; title?: string; subtitle?: string }>;
  tweaks?: Record<string, unknown>;
}

export interface CacheStat {
  cached: number;
  total: number;
  fully?: boolean;
}
export interface BibleApi {
  ready?: Promise<unknown>;
  loadMulti(bookId: string, chapter: number, translations: string[]): Promise<Array<Record<string, unknown> & { n: number }>>;
  loadChapter(bookId: string, chapter: number, translation: string): Promise<Array<{ text?: string; verse?: number; n?: number }> | undefined> | undefined;
  cacheStats(id: string, books: AppBook[]): CacheStat;
  verifyTranslation(id: string, books: AppBook[]): { ok?: boolean; summary?: string; missing?: unknown[]; corrupt?: unknown[] };
  readOffline(bookId: string, chapter: number, translation: string): boolean;
  repairTranslation(id: string, books: AppBook[], onProgress: (p: RepairProgress) => void): void;
  removeTranslation(id: string): unknown;
  storage?: {
    diagnose?(): Promise<{ backend: string; chapterCount: number; approxMB: number; quotaMB?: number }>;
    exportBundle(id: string): { chapterCount: number };
    importBundle(text: string): Promise<{ imported: number; translation: string }>;
    checkUpdates(translations: AppTranslation[]): Promise<UpdateEntry[]>;
  };
}
export interface RepairProgress {
  complete?: boolean;
  aborted?: boolean;
  nothingToDo?: boolean;
  checksum?: { passed?: boolean; cached?: number; total?: number; totalVerses?: number; missing?: number; corrupt?: number };
  phase?: string;
  done?: number;
  total?: number;
  retryDone?: number;
  retryTotal?: number;
  error?: boolean;
  book?: string;
  chapter?: number;
}
export interface UpdateEntry {
  id: string;
  name: string;
  hasUpdate?: boolean;
  ourFetchedAt?: number;
  sourceUpdatedAt?: number;
  ageDays?: number;
  source?: string;
}

export interface PanelsApi {
  getCached(bookId: string, chapter: number): Record<string, unknown> | null;
  getCachedMeta(bookId: string, chapter: number): { fetchedAt?: number } | null;
  load(bookId: string, chapter: number, bookName: string, opts: { provider?: unknown; model?: unknown; force?: boolean }): Promise<Record<string, unknown>>;
  purge(bookId: string, chapter: number): void;
  getDisarmCached(bookId: string, chapter: number): Record<string, unknown> | null;
  getDisarmMeta(bookId: string, chapter: number): { fetchedAt?: number } | null;
  loadDisarm(opts: { passage?: unknown; currentVerse?: number; provider?: unknown; model?: unknown; force?: boolean }): Promise<Record<string, unknown>>;
  purgeDisarm(bookId: string, chapter: number): void;
  cacheStats?(): Array<{ ref: string; bytes: number; fetchedAt?: number }>;
}

export interface SyncApi {
  getBackend(): string;
  user: { name?: string; email?: string; photo?: string } | null;
  getLast(): { at?: number; direction?: string; changed?: number; count?: number } | null;
  getAuto(): boolean;
  setAuto(v: boolean): void;
  on(ev: string, fn: (info: { user?: SyncApi["user"]; backend?: string; message?: string; at?: number; direction?: string; changed?: number; count?: number }) => void): () => void;
  pushNow(): Promise<void>;
  pullOnce(): Promise<void>;
  github: { connect(pat: string): Promise<{ gistLink?: string }>; disconnect(): void; getGistLink?(): string };
  firebase: { getConfig(): unknown; setConfig(cfg: unknown): void; signOut(): Promise<void> };
}

export interface AppWindow {
  // data + engines
  CODEX_DATA: AppCodexData;
  BIBLE: BibleApi;
  CODEX_PANELS?: PanelsApi;
  CODEX_ENGAGE?: {
    trackChapter(bookId: string, chapter: number): void;
    saveSession(bookId: string, chapter: number, book: string): void;
    checkAchievements(): Array<{ icon?: string; title?: string; desc?: string }> | undefined;
    trackSession(): Array<{ icon?: string; title?: string; desc?: string }> | undefined;
    trackHighlight(): void;
    trackSearch(): void;
    loadStats(): { sessionCount: number };
    loadStreak(): { current: number; longest: number };
    loadSession(): { bookId: string; bookName: string; chapter: number } | null;
    getDailyDiscovery(): { title?: string; type?: string; body?: string; ref?: string } | null;
    streakWarning(): { msg: string } | null;
    timeOfDaySuggestion(): unknown;
  };
  CODEX_ENGAGEMENT?: { setConfig?(cfg: { dailyThreshold: number }): void };
  CODEX_PLUGINS_API?: {
    list(): unknown[];
    getPanels?(): Array<{ pluginId?: string; id: string; glyph?: string }>;
    onNavigate(book: string, chapter: number): void;
    onVerseSelect(ref: unknown): void;
  };
  CODEX_NOW?: { ref?: string; book?: string; bookId?: string; chapter?: number; verse?: number; translation?: string };
  CODEX_GEMATRIA_INDEX?: { ensure?(): Promise<void>; find(n: number): Array<{ ref?: string; word?: string; system?: string }> | undefined };
  CODEX_SEARCH?: { ingestPassage?(p: { bookId: string; chapter: number; verses: unknown[]; primary: string }): void };
  CODEX_SYNC?: SyncApi;
  CODEX_DIRECT?: { notifyEngineChange(): void };
  CODEX_TP?: { autoBundleEnabled?(): boolean; setAutoBundle?(v: boolean): void };
  CODEX_CONTINUITY?: { Mount?: AnyComponent };
  CODEX_AI_BUSY?: { begin(label: string): unknown; end(id: unknown): void };
  CODEX_LANGS?: Array<{ id: string; label: string; glyph: string }>;

  // window-provided React components (cross-IIFE)
  CodexReaderX?: AnyComponent;
  CodexTranslationsX?: AnyComponent;
  TalmudPanel?: AnyComponent;
  CommentaryPanel?: AnyComponent;
  GematriaPanel?: AnyComponent;
  GnosisPanel?: AnyComponent;
  DisarmPanel?: AnyComponent;
  ExegesisPanel?: AnyComponent;
  TranslationAnalysisPanel?: AnyComponent;
  LibraryX?: AnyComponent;
  OracleX?: AnyComponent;
  MarksX?: AnyComponent;
  CxrSpawn?: AnyComponent;
  CodexMobileShell?: AnyComponent;
  CODEX_SearchBar?: AnyComponent;
  VerseMenu?: AnyComponent;
  VerseMap?: AnyComponent;
  VerseArt?: AnyComponent;
  Notes?: AnyComponent;
  VerseCompare?: AnyComponent;
  VerseMirror?: AnyComponent;
  VerseSword?: AnyComponent;
  VerseOps?: AnyComponent;
  Omnibar?: AnyComponent;
  VerseConstellation?: AnyComponent;
  LightThemePicker?: AnyComponent;

  // imperative APIs (some assigned by App itself)
  codexMobile?: { open(id: string): void; focus(): void; closeAll(): void; state(): { palm?: boolean; sheets?: unknown[] } };
  codexDeskPanels?: { on(): boolean; list(): string[]; open(id: string): void; close(id: string): void; toggle(id: string): void };
  codexDesk?: unknown;
  codexOpenWindow?(opts: { id: string; glyph?: string }): boolean;
  codexOpenPanel?(id: string): void;
  codexJumpToRef?(ref: string): void;
  codexOpenOmni?(seed?: string): void;
  railTabs?(): Array<{ id: string }>;
  applyCodexLang?(lang: string): void;
  applyCodexDrift?(on: boolean): void;
  t?(k: string): string;

  // imperative APIs the App assigns
  codexOpenConstellation?: () => void;
  codexOpenOps?: (seed?: string) => void;
  codexNewReader?: (seed?: { bookId?: string; book?: string; chapter?: number; verse?: number }) => string;
  codexSelectVerse?: (n: number) => void;
  codexGoto?: (bookId: string, ch?: number, v?: number) => void;
  codexOpenVerseMenu?: (n: number, rect: DOMRect, loc?: { v?: number; bookId?: string; book?: string; chapter?: number }) => void;
  codexSetPrimary?: (id: string) => void;

  __cxToastListener?: boolean;
  parent: { postMessage(msg: unknown, target: string): void };
  navigator: Navigator & { standalone?: boolean; wakeLock?: { request(t: string): Promise<WakeLockSentinel> } };
}

export function aw(): AppWindow {
  return window as unknown as AppWindow;
}

// Local i18n helper — falls back to the key itself.
export function tt(k: string): string {
  return (aw().t && aw().t?.(k)) || k;
}

// The single, app-wide way to surface a notification — everything routes
// through the ONE codex:toast bus rendered by ToastDock.
export interface ToastDetail {
  msg?: string;
  kind?: string;
  variant?: string;
  icon?: string;
  label?: string;
  title?: string;
  desc?: string;
}
export function cxToast(msgOrDetail: string | ToastDetail, kind?: string): void {
  try {
    const detail: ToastDetail = msgOrDetail && typeof msgOrDetail === "object" ? msgOrDetail : { msg: String(msgOrDetail == null ? "" : msgOrDetail), kind };
    window.dispatchEvent(new CustomEvent("codex:toast", { detail }));
  } catch {
    /* ignore */
  }
}
