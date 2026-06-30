// sword — typed window boundary (migrated from sword.jsx). VerseSword reads a
// handful of runtime globals (CODEX_INTEL for AI + canvas helpers,
// CODEX_GEMATRIA for live gematria of the pivotal term, codexJumpToRef for
// reader navigation, and the Intel component suite from intel.js). It sets one
// global back (VerseSword) at module load. Callers use sw() and read/write
// lazily at call time — same pattern as verse-mirror-window.ts.
import type React from "react";

// ── CODEX_INTEL surface ───────────────────────────────────────────────────
export interface SwordIntelAiParams {
  system: string;
  user: string;
  maxTokens?: number;
}
export interface SwordIntelCanvasApi {
  fit(canvas: HTMLCanvasElement): { w: number; h: number };
}
export interface SwordIntelEngine {
  intelAI(params: SwordIntelAiParams): Promise<unknown>;
  intelReducedMotion(): boolean;
  intelCanvas: SwordIntelCanvasApi;
}

// ── CODEX_GEMATRIA surface ────────────────────────────────────────────────
export interface GematriaResult {
  lang?: string;
  hechrachi?: number;
  sidduri?: number;
  katan?: number;
  atbash?: number;
  isopsephy?: number;
  ordinal?: number;
  reduced?: number;
}
export interface GematriaEngine {
  all(term: string): GematriaResult | null | undefined;
}

// ── Data shapes (from the SWORD_PROMPT schema) ────────────────────────────
export interface SwordRef {
  ref: string;
  note?: string;
}
export interface SwordStratumData {
  depth?: number;
  pardesName?: string;
  pardesGloss?: string;
  quadrigaName?: string;
  quadrigaGloss?: string;
  pardes?: string;
  quadriga?: string;
  voicesPardes?: string;
  voicesQuadriga?: string;
  refs?: SwordRef[];
  converge?: string;
}
export interface SwordOriginal {
  lang?: string;
  text?: string;
  translit?: string;
  keyTerm?: string;
  keyTermTranslit?: string;
  keyTermGloss?: string;
}
export interface SwordData {
  theme?: string;
  edge?: string;
  original?: SwordOriginal;
  strata?: SwordStratumData[];
  caveats?: string[];
  _schema?: number;
}

// ── VerseSword prop types ─────────────────────────────────────────────────
export interface SwordPassage {
  bookId: string;
  chapter: number | string;
}
export interface SwordVerse {
  n?: number | string;
}
export interface VerseSwordProps {
  verse?: SwordVerse | null;
  refStr?: string;
  verseText?: string;
  passage: SwordPassage;
  primary?: unknown;
  onClose?: () => void;
  onJumpRef?: (ref: string) => void;
}

// ── SwordWindow ───────────────────────────────────────────────────────────
export interface SwordWindow {
  CODEX_INTEL?: SwordIntelEngine;
  CODEX_GEMATRIA?: GematriaEngine;
  codexJumpToRef?: (ref: string) => void;
  // Intel component suite (set by intel.js, always present in production)
  IntelBanner?: React.ComponentType<{ console?: string; scope?: string; note?: string }>;
  IntelDecrypt?: React.ComponentType<{ text: string; className?: string; as?: string }>;
  IntelStamp?: React.ComponentType<{ code: string; tone?: string; className?: string }>;
  // set at module load (the frozen export contract)
  VerseSword?: React.ComponentType<VerseSwordProps>;
}

export function sw(): SwordWindow {
  return window as unknown as SwordWindow;
}
