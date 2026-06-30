// constellation — typed window boundary (migrated from constellation.jsx). The
// galaxy reads a handful of runtime globals (data, i18n engines, the reader's
// navigation doors, sibling React components, telemetry). Centralise the typing
// here; the component calls cw() and reads what it needs, lazily, at use time.
import type React from "react";
import type { CanonBook } from "./graph.js";

export interface ConstIntel {
  intelReducedMotion(): boolean;
  intelCanvas: { fit(canvas: HTMLCanvasElement): { w: number; h: number } };
}

export interface CodexTranslation {
  id: string;
  canons?: string[];
}
export interface CodexData {
  books?: CanonBook[];
  translations?: CodexTranslation[];
  tweaks?: { primaryTranslation?: string };
}

export interface ParsedRef {
  bookId: string;
  chapter: number;
}
export interface CodexKernel {
  parseRef(s: string): ParsedRef | null;
}

export interface CodexModules {
  loadModule(id: string): Promise<unknown>;
}

export interface VerseRow {
  n: number;
  text?: string;
}
export interface BibleApi {
  loadChapter(bookId: string, chapter: number, translation: string): Promise<VerseRow[]>;
}

export interface CodexNow {
  bookId?: string;
  chapter?: number;
  ref?: string;
}

export interface ConstFlight {
  flights: number;
  state: string;
  lastMaxDist: number;
}

export interface ConstWindow {
  CODEX_INTEL?: ConstIntel;
  CODEX_DATA?: CodexData;
  CODEX_KERNEL?: CodexKernel;
  CODEX_MODULES?: CodexModules;
  BIBLE?: BibleApi;
  CODEX_NOW?: CodexNow;
  codexJumpToRef?: (ref: string) => void;
  codexGoto?: (bookId: string, chapter: number, verse: number) => void;
  // set by the component (smoke/automation hook) — never read here
  codexConstInspect?: (idx: number) => void;
  IntelBanner?: React.ComponentType<{ console?: string; scope?: string; note?: string }>;
  // telemetry the smoke probe reads (canvas pixels can't be queried)
  __CODEX_CONST_TRAIL?: number;
  __CODEX_CONST_FLIGHT?: ConstFlight;
}

export function cw(): ConstWindow {
  return window as unknown as ConstWindow;
}
