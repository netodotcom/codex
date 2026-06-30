// omnibar — typed window boundary (migrated from omnibar.jsx). The bar reaches
// the whole OS through runtime globals: the kernel's ref parser, the search and
// bible engines, the cross-ref formatter, the navigation/console openers, the
// desk and the panel API. Centralise the typing here; everything else calls
// ow() and reads what it needs, lazily, at call time. Standard DOM globals
// (document, localStorage, dispatchEvent, CustomEvent, KeyboardEvent) are used
// directly — only CODEX-* runtime surfaces go through this accessor.

// The kernel's parse — bookId/bookName/chapter, optional verse span.
export interface KernelRef {
  bookId: string;
  bookName: string;
  chapter: number;
  v1?: number | null;
  v2?: number | null;
}

// A single verse row as the bible engine returns it (loose by design).
export interface VerseRow {
  verse?: number;
  n?: number;
  text?: string;
}

// One search hit — ref/id + text/snippet, all optional.
export interface SearchHit {
  ref?: string;
  id?: string;
  text?: string;
  snippet?: string;
}

export interface BookEntry {
  id: string;
  name: string;
  chapters?: number;
}

export interface OmnibarWindow {
  CODEX_KERNEL?: { parseRef?(s: string): KernelRef | null };
  codexOpenConstellation?: () => void;
  codexOpenOps?: (q: string) => void;
  codexDesk?: { on(): boolean; focus(): void; open(id: string): void };
  codexOpenPanel?: (id: string) => void;
  codexJumpToRef?: (ref: string) => void;
  CODEX_DATA?: { books?: BookEntry[]; tweaks?: { primary?: string } };
  BIBLE?: { loadChapter(bookId: string, chapter: number, primary: string): Promise<unknown> };
  CODEX_SEARCH?: { search?(text: string, opts: { limit: number }): Promise<SearchHit[]> };
  CODEX_CrossRefLookup?: { formatRef?(ref: string): string };
}

export function ow(): OmnibarWindow {
  return window as unknown as OmnibarWindow;
}
