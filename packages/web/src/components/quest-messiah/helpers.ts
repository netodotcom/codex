// quest-messiah — pure helpers + Phase 2.5 engagement bridge (additive, defensive).
// groupBySection / splitRefs / expandRefs / loadProgress / saveProgress are
// pure / localStorage-only and ground-truth testable. emitDepth / emitQuestStep
// touch window.CODEX_ENGAGEMENT but are fully guarded so the quest still runs
// standalone / in Lite mode / offline.

import type { ProphecyCard, SectionGroup, QuestProgress } from "./data.js";
import { PROGRESS_KEY, QUEST_ID } from "./data.js";
import { qmw } from "./quest-messiah-window.js";

// Group cards by section so the sidebar can collapse them.
export function groupBySection(cards: ProphecyCard[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let cur: SectionGroup | null = null;
  for (const c of cards) {
    if (!cur || cur.section !== c.section) {
      cur = { section: c.section, cards: [] };
      groups.push(cur);
    }
    cur.cards.push(c);
  }
  return groups;
}

// Split a multi-ref string ("Genesis 12:3; 22:18") into individual refs.
export function splitRefs(s: string): string[] {
  if (!s) return [];
  return s.split(/;\s*/).map(x => x.trim()).filter(Boolean);
}

// Detect if a string lacks a book name (e.g. "22:18" alone) and inherit
// from the previous ref's book. Used for the second part of "Genesis 12:3; 22:18".
export function expandRefs(refStr: string): string[] {
  const parts = splitRefs(refStr);
  let lastBook: string | null = null;
  return parts.map(p => {
    const firstChar = p[0];
    if (/^\d/.test(p) && lastBook !== null && firstChar !== undefined && /^\d/.test(firstChar)) {
      // Pure chapter:verse form — prefix with last seen book
      return lastBook + " " + p;
    }
    const m = p.match(/^([1-3]?\s*[A-Za-z]+)/);
    if (m) {
      const book = m[1];
      if (book !== undefined) lastBook = book.trim();
    }
    return p;
  });
}

// Feed quest progress into the unified CODEX_ENGAGEMENT engine so studying
// prophecies counts toward continuity + mastery. Every engine touch is guarded
// so the quest still runs standalone / in Lite mode / offline.
// A studied card is a depth action (weight 3, like a quest-step).
export function emitDepth(type: string, ref: string | null, weight: number, domain: string | null): void {
  try {
    const E = qmw().CODEX_ENGAGEMENT;
    if (E && typeof E.emit === "function") { E.emit(type, ref, weight, domain); return; }
    if (typeof window !== "undefined" && typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("codex:depth-action", {
        detail: { type, ref: ref ?? null, weight, domain: domain ?? null },
      }));
    }
  } catch (_e) {}
}

export function emitQuestStep(step: number, status: string): void {
  try {
    if (typeof window !== "undefined" && typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("codex:quest-step", {
        detail: { questId: QUEST_ID, step, status, domain: "canon-coverage" },
      }));
    }
  } catch (_e) {}
}

export function loadProgress(): QuestProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "null") as Partial<QuestProgress> | null;
    return { studied: [], lastIdx: 0, ...(raw ?? {}) };
  } catch {
    return { studied: [], lastIdx: 0 };
  }
}

export function saveProgress(p: QuestProgress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}
