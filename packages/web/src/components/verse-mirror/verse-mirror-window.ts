// verse-mirror — typed window boundary (migrated from verse-mirror.jsx). The
// Mirror reads a set of runtime globals (CODEX_INTEL for AI + canvas helpers,
// codexJumpToRef for reader navigation, and the Intel component suite from
// intel.js). It sets one global back (VerseMirror) at module load.
// Callers use mw() and read/write lazily at call time.
import type React from "react";

// ── CODEX_INTEL surface ───────────────────────────────────────────────────
// (shared by Mirror, Map, Crossref, Constellation)

export interface IntelAiParams {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface IntelCanvasArcOpts {
  color?: string;
  width?: number;
  glow?: number;
  bow?: number;
  alpha?: number;
  t?: number;
}

export interface IntelCanvasNodeOpts {
  color?: string;
  weight?: number;
  ring?: boolean;
  alpha?: number;
}

export interface IntelCanvasApi {
  fit(canvas: HTMLCanvasElement): { w: number; h: number };
  arc(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: IntelCanvasArcOpts,
  ): void;
  node(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    opts?: IntelCanvasNodeOpts,
  ): number;
  accent(): string;
}

export interface IntelEngine {
  intelAI(params: IntelAiParams): Promise<unknown>;
  intelFmtYear(y: number | null | undefined): string;
  intelReducedMotion(): boolean;
  intelCanvas: IntelCanvasApi;
}

// ── VerseMirror prop types ────────────────────────────────────────────────
export interface MirrorVerse {
  n?: number | string;
}

export interface MirrorPassage {
  bookId: string;
  chapter: number | string;
}

export interface VerseMirrorProps {
  verse?: MirrorVerse | null;
  refStr?: string;
  verseText?: string;
  passage: MirrorPassage;
  primary?: unknown;
  onClose?: () => void;
  onJumpRef?: (ref: string) => void;
}

// ── MirrorWindow ──────────────────────────────────────────────────────────
export interface MirrorWindow {
  CODEX_INTEL?: IntelEngine;
  codexJumpToRef?: (ref: string) => void;
  // Intel component suite (set by intel.js, always present in production)
  IntelBanner?: React.ComponentType<{
    console?: string;
    scope?: string;
    note?: string;
    className?: string;
  }>;
  IntelDecrypt?: React.ComponentType<{
    text: string;
    className?: string;
    as?: string;
  }>;
  IntelStamp?: React.ComponentType<{
    code: string;
    tone?: string;
    className?: string;
  }>;
  IntelBars?: React.ComponentType<{
    value: number;
    label?: string;
    className?: string;
  }>;
  IntelTicker?: React.ComponentType<{
    items: string[];
    interval?: number;
    className?: string;
  }>;
  // set at module load (the frozen export contract)
  VerseMirror?: React.ComponentType<VerseMirrorProps>;
}

export function mw(): MirrorWindow {
  return window as unknown as MirrorWindow;
}
