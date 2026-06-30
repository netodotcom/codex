// continuity — typed window boundary (migrated from continuity.jsx). The whole
// surface is PRESENTATION + WIRING on top of window.CODEX_ENGAGEMENT; every
// runtime global the legacy IIFE read through bare identifiers is centralised &
// typed here, plus the small window-touching helpers (t, emitDepth, jumpRef,
// saveReflectionNote, buildCtx) so the components stay declarative.
import type React from "react";
import { safe, FALLBACK_DOMAINS } from "./helpers.js";

// ── Engine contract (window.CODEX_ENGAGEMENT, owned by engagement.js). The
//    legacy assumes these methods exist and lets safe()/try-catch absorb a
//    mid-load absence; we mirror that by typing the methods as present.
export interface ContinuityStatus {
  current?: number;
  longest?: number;
  grace?: number;
  graceCap?: number;
  graceSpent?: number;
  nextGraceIn?: number;
  sinceGrace?: number;
  lastDay?: string | null;
  statusText?: string;
  statusKey?: string;
}
export interface MasteryCell {
  score?: number;
  threads?: number;
  level?: number;
  levelLabel?: string;
}
export type MasteryMap = Record<string, MasteryCell>;
export interface MasteryLevel {
  min: number;
}
export interface MilestonesData {
  unlocked?: Record<string, unknown>;
}
export interface EventLogEntry {
  type: string;
  ref?: string | null;
  weight?: number;
  domain?: string | null;
  ts?: unknown;
}
export interface QuestStep {
  kind?: string;
  prompt?: string;
  refs?: string[] | null;
  reveal?: string | null;
}
export interface QuestMeta {
  id?: string;
  title?: string;
  tradition?: string;
  domain?: string;
  ring?: unknown;
}
export interface QuestModule {
  meta?: QuestMeta;
  steps?: QuestStep[];
}
export interface QuestState {
  status?: string;
  step?: number;
}
export interface QuestListItem {
  id: string;
  title?: string;
  domain?: string;
  tradition?: string;
  status?: string;
  step?: number;
  steps?: number;
}
export interface NextThreadSuggestion {
  kind?: string;
  title?: string;
  ref?: string;
  reason?: string;
}

export interface Engine {
  continuity(): ContinuityStatus | null;
  continuityStatus(): ContinuityStatus | null;
  mastery(): MasteryMap | null;
  milestones(): MilestonesData;
  eventLog(): EventLogEntry[] | Promise<EventLogEntry[]>;
  getQuest(id: string): QuestModule | Promise<QuestModule | null> | null;
  questState(id: string): QuestState | null;
  startQuest(id: string): unknown;
  advanceQuest(id: string): unknown;
  listQuests(): QuestListItem[] | Promise<QuestListItem[]>;
  nextThread(ctx: Record<string, unknown>): NextThreadSuggestion | null;
  emit(type: string, ref?: string, weight?: number, domain?: string | null): void;
  DOMAINS?: string[];
  MASTERY_LEVELS?: MasteryLevel[];
}

export interface PluginPanelSpec {
  id: string;
  label: string;
  glyph: string;
  icon: string;
  render: (ctx: Record<string, unknown>) => React.ReactElement;
}
export interface PluginsApi {
  register(plugin: { id: string; name: string; version: string; panels: PluginPanelSpec[] }): void;
}

// Best-effort ctx detail carried on codex:navigate / codex:open-panel events.
export interface BuildCtxDetail {
  ref?: string;
  book?: string;
}

export interface CWindow {
  t?: (k: string) => string;
  CODEX_ENGAGEMENT?: Engine;
  codexJumpToRef?: (display: string) => void;
  CODEX_DATA?: { tweaks?: { provider?: string; model?: string } };
  CODEX_LIBRARY?: { list?: () => unknown };
  CODEX_TODAY_DAF?: unknown;
  CODEX_WEEK_PARSHA?: unknown;
  CODEX_PLUGINS_API?: PluginsApi;
  IntelBanner?: React.ComponentType<{ console?: string; scope?: string; note?: string }>;
}

export function cw(): CWindow {
  return window as unknown as CWindow;
}

// ── Engine access — every call guarded; engine may be absent / mid-load.
export function ENG(): Engine | null {
  return (typeof window !== "undefined" && cw().CODEX_ENGAGEMENT) || null;
}

// ── Lite mode — ?lite=1 hides engagement surfaces entirely. The engine still
//    loads; we just render nothing. (Never throws if location is odd.)
function detectLite(): boolean {
  try {
    const q = new URLSearchParams(window.location.search || "");
    return q.get("lite") === "1" || q.get("lite") === "true";
  } catch {
    return false;
  }
}
export const LITE: boolean = detectLite();

// ── i18n — terse helper. Falls back to the supplied English if the global i18n
//    module hasn't registered the cx.* keys.
export function t(key: string, fallback?: string | null, vars?: Record<string, unknown>): string {
  let out: string = fallback != null ? fallback : key;
  try {
    const wt = cw().t;
    if (typeof wt === "function") {
      const v = wt(key);
      if (v && v !== key) out = v;
    }
  } catch {
    /* ignore */
  }
  if (vars) {
    out = String(out).replace(/\{(\w+)\}/g, (m, k: string) => {
      return vars[k] != null ? String(vars[k]) : m;
    });
  }
  return out;
}

export function reducedMotion(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Read from the engine so we never drift from its taxonomy; fall back to the
// contract list.
export function domains(): string[] {
  const e = ENG();
  const d = e && Array.isArray(e.DOMAINS) ? e.DOMAINS : null;
  return d && d.length ? d : FALLBACK_DOMAINS;
}

// Emit a depth event through the engine (preferred) or the bus (fallback).
// Called ONLY on a genuine depth action, never on open/scroll/view.
export function emitDepth(type: string, ref?: string | null, weight?: number, domain?: string | null): void {
  const e = ENG();
  try {
    if (e && typeof e.emit === "function") {
      e.emit(type, ref || undefined, weight, domain);
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("codex:depth-action", {
        detail: { type: type, ref: ref || null, weight: weight, domain: domain || null },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function jumpRef(refStr: string): void {
  try {
    if (refStr && cw().codexJumpToRef) cw().codexJumpToRef?.(refStr);
  } catch {
    /* ignore */
  }
}

// Persist to the same store notes.jsx uses, then emit the note-written depth
// event (weight 2, cross-cutting) so it qualifies the day + feeds continuity.
export function saveReflectionNote(questTitle: string | undefined, _stepIdx: number, text: string): void {
  try {
    const KEY = "codex.notes.v1";
    let arr: unknown[] = [];
    try {
      arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      arr = [];
    }
    if (!Array.isArray(arr)) arr = [];
    arr.push({
      id: "quest-reflect-" + Date.now().toString(36),
      text: String(text || "").slice(0, 4000),
      ref: null,
      tag: "quest",
      title: "Reflection · " + (questTitle || ""),
      created: Date.now(),
    });
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  emitDepth("note-written", "quest-reflect", undefined, null);
}

// Assemble a best-effort ctx for nextThread() from cheap host signals.
export function buildCtx(detail: BuildCtxDetail | null): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  try {
    const d = detail || {};
    if (d.ref) ctx.ref = d.ref;
    if (d.book) ctx.book = d.book;
    // The user's own library (gematria-tagged refs), if the host exposes it.
    const lib = safe(() => {
      const L = cw().CODEX_LIBRARY;
      return (L && L.list && L.list()) || null;
    }, null);
    if (Array.isArray(lib)) ctx.library = lib;
    // Today's daf / this week's parsha if the host pre-staged them.
    const daf = safe(() => cw().CODEX_TODAY_DAF || null, null);
    if (daf) ctx.daf = daf;
    const parsha = safe(() => cw().CODEX_WEEK_PARSHA || null, null);
    if (parsha) ctx.parsha = parsha;
    ctx.crossrefsAvailable = true;
  } catch {
    /* ignore */
  }
  return ctx;
}
