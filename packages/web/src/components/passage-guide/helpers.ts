// passage-guide — navigation + engagement helpers (migrated verbatim from
// passage-guide.jsx). parseRefKey is pure (ground-truth tested); the rest are
// thin window-boundary side-effects: depth-action emission, the reader-nav door
// (codexJumpToRef or a codex:navigate event), and Strong's / verse-map openers.
import { pgw } from "./passage-guide-window.js";

export interface ParsedRefKey {
  bookId: string;
  chapter: number;
  verse: number | null;
}

// Parse a TSK ref-string like "jhn.3.16" → { bookId, chapter, verse }
export function parseRefKey(key: unknown): ParsedRefKey | null {
  if (typeof key !== "string") return null;
  const parts = key.split(".");
  if (parts.length < 2) return null;
  const bookId = parts[0]!.toLowerCase();
  const chapter = parseInt(parts[1]!, 10);
  const tail = parts[2];
  const verse = tail ? parseInt(tail, 10) : null;
  if (!bookId || !Number.isFinite(chapter)) return null;
  return { bookId, chapter, verse };
}

// ── Engagement emission (guarded; no-op if the engine is absent) ──────
export function emitDepth(type: string, ref: string, weight: number): void {
  if (!type) return;
  try {
    window.dispatchEvent(
      new CustomEvent("codex:depth-action", {
        detail: { type, ref, weight },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function navigateTo(bookId: string, bookName: string | null | undefined, chapter: number, verse: number | null | undefined): void {
  try {
    if (typeof pgw().codexJumpToRef === "function") {
      pgw().codexJumpToRef!(`${bookName || bookId} ${chapter}${verse ? ":" + verse : ""}`);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("codex:navigate", {
        detail: { book: bookName || bookId, bookId, chapter, verse: verse || undefined },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function openStrongs(strongsId: string | undefined): void {
  if (!strongsId) return;
  try {
    window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: strongsId } }));
    window.dispatchEvent(
      new CustomEvent("codex:open-panel", {
        detail: { pluginId: "strongs-concordance", panelId: "strongs", ctx: { strongs: strongsId } },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function openMap(bookId: string, bookName: string | null | undefined, chapter: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent("codex:open-map", {
        detail: { bookId, book: bookName, chapter },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("codex:open-panel", {
        detail: { pluginId: "verse-map", panelId: "map", ctx: { bookId, book: bookName, chapter } },
      }),
    );
  } catch {
    /* ignore */
  }
}
