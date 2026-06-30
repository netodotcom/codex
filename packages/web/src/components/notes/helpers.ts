// notes — pure helpers migrated from notes.jsx.
// localStorage keys, the SavedNote interface, note I/O, and formatTs are all
// tested independently; everything else in the component is wired side-effectful UI.

export const NOTES_KEY     = "codex.notes.v1";       // array of saved notes
export const NOTES_DRAFT   = "codex.notes.draft";    // unsaved textarea content
export const NOTES_POS     = "codex.notes.pos";      // { right, bottom }
export const NOTES_VIS     = "codex.notes.visible";  // "1" | "0"
export const NOTES_LIST_OP = "codex.notes.listOpen"; // "1" | "0"

export interface SavedNote {
  id: string;
  text: string;
  ref: string;
  ts: number;
}

export interface NotePosition {
  right: number;
  bottom: number;
}

/** Type guard for a persisted position object. */
export function isPosition(v: unknown): v is NotePosition {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>)["right"] === "number" &&
    typeof (v as Record<string, unknown>)["bottom"] === "number"
  );
}

export function loadNotes(): SavedNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedNote[];
  } catch { return []; }
}

export function saveNotes(arr: SavedNote[]): void {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(arr)); } catch {}
}

export function formatTs(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)         return "just now";
  if (diff < 3600)       return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}d`;
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}·${pad(d.getDate())}`;
}
