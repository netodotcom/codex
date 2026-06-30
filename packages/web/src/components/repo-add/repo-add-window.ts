// repo-add — typed window boundary. All runtime global accesses go through
// rw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in reader-window.ts / crossref-window.ts.
import type React from "react";
import type { Repo } from "./data.js";

// Minimal slice of CODEX_DATA that this feature touches.
export interface RepoAddTranslation {
  id: string;
  [key: string]: unknown;
}

export interface RepoAddCodexData {
  translations: RepoAddTranslation[];
}

export interface RepoAddBibleApi {
  loadChapter(bookId: string, chapter: number, id: string): Promise<unknown>;
}

// ── Window globals this feature READS ────────────────────────────────────────
// ── Window globals this feature SETS  ────────────────────────────────────────
export interface RepoAddWindow {
  CODEX_DATA?: RepoAddCodexData;
  BIBLE?: RepoAddBibleApi;
  // The four globals the legacy Object.assign(window, {...}) sets at module load.
  RepoAdd?: React.ComponentType<{ onAdded?: (repo: Repo) => void }>;
  loadRepos?: () => Repo[];
  saveRepos?: (list: Repo[]) => void;
  removeRepo?: (id: string) => boolean;
}

export function rw(): RepoAddWindow {
  return window as unknown as RepoAddWindow;
}
