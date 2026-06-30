// oracle2 — typed window boundary (migrated from oracle2.jsx). The oracle reads
// several runtime globals (reader cursor, AI-busy orb, artifact renderer, bible
// cache, kernel tools, plugin API, navigation) and sets one (OracleX). Every
// window access goes through ow() so the types stay narrow. Standard DOM globals
// (localStorage, fetch, CustomEvent, document) keep their lib.dom typings.
import type React from "react";

export interface CodexNow {
  ref?: string;
  bookId?: string;
  chapter?: number | string;
  verse?: number | string;
  translation?: string;
}

export interface AiBusyApi {
  begin(label: string): unknown;
  end(id: unknown): void;
}

export interface ArtifactsApi {
  directiveDoc?(): string;
  Rich?: React.ComponentType<{ text: string }>;
}

export interface BibleVerseCache {
  n?: number | string;
  text?: string;
  [key: string]: unknown;
}

export interface BibleApi {
  getCachedChapter?(
    bookId: string,
    chapter: number | string | undefined,
    tr: string,
  ): BibleVerseCache[] | null | undefined;
}

export interface KernelToolSpec {
  name: string;
  description?: string;
}

export interface KernelApi {
  toolSpecs?(): KernelToolSpec[];
  tools?(): string[];
  call(tool: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface PluginPanelSpec {
  id: string;
  label: string;
  glyph: string;
  render(): React.ReactElement;
}

export interface PluginsApi {
  register(plugin: {
    id: string;
    name: string;
    version: string;
    panels: PluginPanelSpec[];
  }): boolean | void;
}

export interface Oracle2Window {
  CODEX_NOW?: CodexNow;
  CODEX_AI_BUSY?: AiBusyApi;
  CODEX_ARTIFACTS?: ArtifactsApi;
  BIBLE?: BibleApi;
  CODEX_KERNEL?: KernelApi;
  CODEX_PLUGINS_API?: PluginsApi;
  codexJumpToRef?: (ref: string) => void;
  OracleX?: unknown;
}

export function ow(): Oracle2Window {
  return window as unknown as Oracle2Window;
}
