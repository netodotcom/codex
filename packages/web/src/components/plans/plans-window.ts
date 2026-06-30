// plans — typed window boundary (migrated from plans.jsx). The plan UI reads a
// handful of runtime globals: the module loader, book data, the unified
// continuity engine, the legacy engagement engine, and the reader's nav door.
// Every read goes through pw() so the casts live in exactly one place.
import type { Plan, Continuity, ParsedReading } from "./types.js";

export interface CodexBook {
  id: string;
  name: string;
}
export interface CodexData {
  books?: CodexBook[];
}

export interface CodexModules {
  loadModule(id: string): Promise<Plan>;
}

// Unified continuity engine (Phase 2.5). Guarded everywhere — absent in Lite.
export interface EngagementApi {
  emit?(type: string, ref: string, weight: number, domain: string): void;
  continuity?(): Continuity | null;
}

export interface StreakData {
  history: Record<string, unknown>;
  longest?: number;
}

// Legacy engagement engine — heatmap, achievements, streak warnings.
export interface EngageApi {
  loadStreak(): StreakData;
  recordDay(): void;
  checkAchievements(): void;
  streakWarning(): { msg: string } | null | undefined;
}

// ── Plugin registration surface (index.tsx writes these) ─────────────────────
export interface PlansPluginPanel {
  id: string;
  label: string;
  glyph: string;
  icon: string;
  render: (ctx?: Record<string, unknown>) => unknown;
}
export interface PlansPlugin {
  id: string;
  name: string;
  version: string;
  panels: PlansPluginPanel[];
}
export interface PlansPluginsApi {
  register(plugin: PlansPlugin): unknown;
}

// The reuse/testing surface the legacy IIFE set on window.CODEX_Plans.
export interface PlansPublicApi {
  PlansPanel: (ctx: Record<string, unknown>) => unknown;
  loadPlan: (id: string) => Promise<Plan | null>;
  parseReading: (ref: string) => ParsedReading;
}

export interface PlansWindow {
  CODEX_MODULES?: CodexModules;
  CODEX_DATA?: CodexData;
  CODEX_ENGAGEMENT?: EngagementApi;
  CODEX_ENGAGE?: EngageApi;
  codexJumpToRef?: (ref: string) => void;
  CODEX_PLUGINS_API?: PlansPluginsApi;
  CODEX_Plans?: PlansPublicApi;
}

export function pw(): PlansWindow {
  return window as unknown as PlansWindow;
}
