// reels — typed window boundary and shared data types. Reels reads runtime
// globals (engagement engines, book-data API, the modules loader, the plugins
// API, ReactDOM for portal, the normie-toggle component) and sets one
// (CODEX_Reels). Centralise the typing here; callers use rw() and read/write
// lazily at call time. Standard browser globals (localStorage, fetch,
// CustomEvent, setTimeout) keep their lib.dom typings and are used directly.
import type React from "react";

// ── Card data shapes ─────────────────────────────────────────────────────────
export interface ReelCard {
  type: string;
  id?: string;
  anchor?: string;
  title?: string;
  body?: string;
  hue?: string;
  // art-verse
  image?: string;
  artist?: string;
  year?: number | string;
  medium?: string;
  // symbol
  glyph?: string;
  // prophecy-pair
  prophecy?: string;
  fulfillment?: string;
  fulfillment_text?: string;
  // question
  question?: string;
  answer?: string;
  // quest-tease
  questId?: string;
}

// Navigation context passed to the panel by the plugin system.
export interface NavCtx {
  bookId?: string;
  chapter?: number | string;
  book?: string;
  verse?: number | string;
}

export interface ReaderProfile {
  topBooks?: string[];
  topTypes?: string[];
}

// ── Runtime API shapes ────────────────────────────────────────────────────────
export interface ReelsModulesApi {
  loadModule(id: string): Promise<{ cards?: ReelCard[] }>;
}

export interface ReelsBookNameApi {
  bookName?(bookId: string): string | undefined;
}

export interface ReelsEngageApi {
  buildReaderProfile?(): ReaderProfile | null;
  trackReel?(): void;
  isReelLiked?(card: ReelCard): boolean;
  toggleReelLike?(card: ReelCard): { liked: boolean };
}

export interface ReelsEngagementApi {
  emit?(
    type: string,
    ref: string | null | undefined,
    weight: number,
    domain: string | null,
  ): void;
  questState?(id: string): { status?: string } | null;
  startQuest?(id: string): Promise<void> | void;
}

export interface ReelsPluginsApi {
  register(plugin: unknown): unknown;
}

// ── The window ─────────────────────────────────────────────────────────────────
export interface ReelsWindow {
  CODEX_MODULES?: ReelsModulesApi;
  CODEX_DATA?: ReelsBookNameApi;
  CODEX_ENGAGE?: ReelsEngageApi;
  CODEX_ENGAGEMENT?: ReelsEngagementApi;
  CODEX_PLUGINS_API?: ReelsPluginsApi;
  codexJumpToRef?: (display: string) => void;
  CODEX_NormieToggle?: React.ComponentType<{ text: string; scope?: string }>;
  ReactDOM?: {
    createPortal(node: React.ReactNode, container: Element): React.ReactPortal;
  };
  CODEX_Reels?: {
    ReelsFeed: React.ComponentType<{
      ctx: NavCtx;
      fullscreen?: boolean;
      onClose?: () => void;
    }>;
    ReelsPanel: React.ComponentType<NavCtx>;
    refillDeck(ctx: NavCtx, targetSize?: number): Promise<void>;
    schedulePreload(ctx: NavCtx): void;
  };
}

export function rw(): ReelsWindow {
  return window as unknown as ReelsWindow;
}
