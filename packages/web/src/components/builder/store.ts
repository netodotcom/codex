// builder — study store: local-id minting, localStorage persistence, empty-study
// factory, and URL/file study import (migrated verbatim from builder.jsx). State
// lives in localStorage at codex.studies.v1, exactly as v1.

// A study item is a loose record — verse / note / panel / crossref each carry a
// different subset of fields, and external `codex:add-to-study` payloads spread
// through unchanged, so we keep an open index signature to preserve every key.
export interface StudyItem {
  type: string;
  _id?: string;
  ref?: string;
  text?: string;
  translation?: string;
  body?: string;
  kind?: string;
  source?: string;
  note?: string;
  [k: string]: unknown;
}
export interface StudySection {
  id: string;
  heading: string;
  items: StudyItem[];
}
export interface Study {
  id: string;
  title: string;
  created: number;
  modified: number;
  sections: StudySection[];
}
export interface StudyStore {
  studies: Study[];
  activeStudyId: string | null;
}

export const LS_KEY = "codex.studies.v1";

// ── ULID-ish (timestamp + random suffix; good enough for local ids) ──
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Persistence ─────────────────────────────────────────────────────
export function loadStore(): StudyStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { studies: [], activeStudyId: null };
    const parsed = JSON.parse(raw) as StudyStore | null;
    if (!parsed || !Array.isArray(parsed.studies)) return { studies: [], activeStudyId: null };
    return parsed;
  } catch {
    return { studies: [], activeStudyId: null };
  }
}
export function saveStore(s: StudyStore): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn("studies: save failed", e);
  }
}

export function makeEmptyStudy(title?: string): Study {
  const now = Date.now();
  return {
    id: uid("study"),
    title: title || "Untitled study",
    created: now,
    modified: now,
    sections: [{ id: uid("section"), heading: "I. ", items: [] }],
  };
}

// Apply a study object to the store (for URL imports). Re-ids to avoid collisions.
export function importStudyObject(studyObj: unknown): boolean {
  const o = studyObj as { sections?: unknown } | null | undefined;
  if (!o || !Array.isArray(o.sections)) return false;
  const store = loadStore();
  const copy = {
    ...(o as Record<string, unknown>),
    id: uid("study"),
    created: Date.now(),
    modified: Date.now(),
    sections: (o.sections as unknown[]).map((s) => {
      const sec = s as { heading?: unknown; items?: unknown };
      return {
        id: uid("section"),
        heading: (sec.heading as string | undefined) || "",
        items: Array.isArray(sec.items) ? (sec.items as StudyItem[]).slice() : [],
      };
    }),
  } as unknown as Study;
  store.studies.push(copy);
  store.activeStudyId = copy.id;
  saveStore(store);
  window.dispatchEvent(new CustomEvent("codex:studies-changed"));
  return true;
}
