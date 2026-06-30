// artifacts — typed window boundary (migrated from artifacts.jsx). The artifacts
// engine reads a handful of runtime globals (scripture data, the reader-nav
// doors, the bible loader, the kernel ref-parser, the desk panel APIs, the
// settings store, ReactDOM for portals). Centralise the typing here; modules
// call aw()/rd() and read what they need, lazily, at call time. Never sprinkle
// untyped `window as any`.
import type React from "react";

export interface ArtBook {
  id: string;
  name: string;
}

// A single verse row as returned by BIBLE.loadChapter — shape varies across
// translations, so index access stays open.
export interface ArtVerse {
  n?: number;
  verse?: number;
  text?: string;
  [k: string]: unknown;
}

export interface ArtParsedRef {
  bookId: string;
  chapter: number;
  v1?: number;
}

export interface ArtWindow {
  CODEX_DATA?: { books?: ArtBook[] };
  CODEX_NOW?: { translation?: string; ref?: string };
  BIBLE?: { loadChapter(bookId: string, chapter: number, trans: string): Promise<unknown> };
  CODEX_INTEL?: { intelParseJSON?(t: string): unknown };
  CODEX_KERNEL?: { parseRef?(s: string): ArtParsedRef | null | undefined };
  codexGoto?: (bookId: string, chapter: number, verse: number) => void;
  codexJumpToRef?: (ref: string) => void;
  codexDesk?: { on?: () => boolean; open?: (id: string) => void };
  codexDeskPanels?: { open?: (id: string) => void };
  CODEX_AI_BUSY?: {
    begin(label: string): number;
    end(id: number): void;
    active(): boolean;
  };
  ReactDOM?: { createPortal(node: React.ReactNode, container: Element): React.ReactPortal };
}

export function aw(): ArtWindow {
  return window as unknown as ArtWindow;
}

// Verses can arrive as { verses: [...] } or as a bare array — faithful to the
// legacy `(data && data.verses) || data || []`.
export function versesOf(data: unknown): ArtVerse[] {
  const d = data as { verses?: ArtVerse[] } | ArtVerse[] | null | undefined;
  const v = (d && (d as { verses?: ArtVerse[] }).verses) || d || [];
  return v as ArtVerse[];
}
