// ai-quests — pure helpers and domain types (migrated faithfully from
// ai-quests.jsx). localStorage wrappers, engagement event emitters, AI-key
// detection, quest-id generation, JSON extraction, and the URL-hash share
// codec. All functions are tested in helpers.test.ts; window-global reads
// go through aqw() (ai-quests-window.ts) so jsdom tests run without
// manually setting up window properties.
import { aqw } from "./ai-quests-window.js";

// ── Domain types ───────────────────────────────────────────────────────────────
export interface QuestStep {
  n: number;
  passage: string;
  passage_ref: string;
  intro: string;
  question: string;
  guidance: string;
}

export interface Quest {
  id: string;
  theme: string;
  created?: number;
  title: string;
  blurb: string;
  estimate_minutes: number;
  steps: QuestStep[];
  synthesis_prompt?: string;
}

/** String-or-number index so the original `answers[step.n]` key (a number)
 *  works at runtime; TypeScript will auto-coerce it to a string in the
 *  underlying object, but we need the index type wide enough to typecheck. */
export type Answers = Record<string | number, string>;

export interface QuestEnvelope {
  id: string;
  title: string;
  theme: string;
  blurb: string;
  estimate_minutes: number;
  steps: QuestStep[];
  answers: Answers;
  reflection: string;
  feedback: string | null;
  completed_at: number;
  synthesis_prompt?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
export const SUGGESTED: readonly string[] = [
  "Trace covenant from Abraham to Christ",
  "What does Jesus say about prayer?",
  "Find the Spirit in the Old Testament",
  "How the apostles understood the resurrection",
  "Names of God in the Pentateuch",
  "Wisdom about suffering across the Bible",
];

export const SAVED_KEY = "codex.quests.completed";
export const stateKey   = (id: string): string => `codex.quest.${id}.state`;
export const answersKey = (id: string): string => `codex.quest.${id}.answers`;
export const draftKey   = (id: string): string => `codex.quest.${id}.draft`;

// ── localStorage helpers ───────────────────────────────────────────────────────
export function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function lsSet(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
export function lsDel(k: string): void {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

// ── Phase 2.5 engagement bridge (additive, defensive) ─────────────────────────
// Feed AI-quest progress into the unified CODEX_ENGAGEMENT engine so each
// completed step counts toward continuity + mastery. Every engine touch is
// guarded so the quest still runs standalone / in Lite mode / offline.
export function emitDepth(
  type: string,
  ref: string | null,
  weight: number,
  domain: string | null,
): void {
  try {
    const E = aqw().CODEX_ENGAGEMENT;
    if (E && typeof E.emit === "function") {
      E.emit(type, ref, weight, domain);
      return;
    }
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("codex:depth-action", {
          detail: { type, ref: ref ?? null, weight, domain: domain ?? null },
        }),
      );
    }
  } catch { /* defensive */ }
}

export function emitQuestStep(
  questId: string,
  step: number,
  status: string,
  domain: string | null,
): void {
  try {
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("codex:quest-step", {
          detail: { questId, step, status, domain: domain ?? null },
        }),
      );
    }
  } catch { /* defensive */ }
}

// ── Runtime helpers ────────────────────────────────────────────────────────────
export function getTweaks(): { provider?: string; model?: string } {
  const data = aqw().CODEX_DATA;
  return (data && data.tweaks) ?? {};
}

export function hasAiKey(): boolean {
  // Check the REAL key store (codex.api.keys.v1) — the same source the
  // request layer (direct-api.js) uses — not the tweaks model-picker. The
  // old heuristic checked t.provider/t.model, so a user who set their key in
  // Settings → API keys but never opened the model picker got a false
  // "no API key" even though the Oracle works fine.
  try {
    const raw = localStorage.getItem("codex.api.keys.v1");
    const k = (JSON.parse(raw ?? "null") as Record<string, unknown> | null) ?? {};
    if (k["active"] === "ollama") return true; // local, keyless
    if (k["anthropic"] || k["grok"] || k["groq"] || k["gemini"]) return true;
  } catch { /* ignore */ }
  // Legacy single-key fallback.
  try { if (localStorage.getItem("codex.anthropic.key")) return true; } catch { /* ignore */ }
  // Last resort: a model/provider explicitly chosen still counts.
  const t = getTweaks();
  return !!(t.provider || t.model);
}

export function newQuestId(): string {
  return "q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

// ── JSON extraction ────────────────────────────────────────────────────────────
// Extract the first {...} JSON object from a possibly-noisy model reply.
export function extractJson(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  const parse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s) as unknown;
      return v !== null && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const r = parse(trimmed);
  if (r) return r;
  const m = trimmed.match(/\{[\s\S]*\}/);
  return m ? parse(m[0]!) : null;
}

// ── Share codec ────────────────────────────────────────────────────────────────
// Hash a finished quest into a shareable URL fragment, mirroring the
// study-builder pattern: `#quest=<base64-json>`.
export function encodeShare(
  envelope: Pick<Quest, "id" | "title" | "theme" | "blurb" | "estimate_minutes" | "steps">,
): string {
  try {
    const json = JSON.stringify(envelope);
    // eslint-disable-next-line no-restricted-globals
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return `${location.origin}${location.pathname}#quest=${b64}`;
  } catch {
    return location.href;
  }
}

export function tryImportFromHash(): Partial<Quest> | null {
  if (!location.hash || !location.hash.startsWith("#quest=")) return null;
  try {
    const b64 = location.hash.slice("#quest=".length);
    // eslint-disable-next-line no-restricted-globals
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as Partial<Quest>;
  } catch {
    return null;
  }
}
