// timeline — pure-ish helpers (migrated from timeline.jsx). Year labels, OSIS
// ref parsing, significance, tick spacing, easing. The reader-navigation door
// (gotoRef) and book-name resolution read window globals; everything else is
// pure and ground-truth tested.
import type { TimelineEvent } from "./data.js";

interface HelperWindow {
  CODEX_DATA?: { books?: Array<{ id?: string; name?: string }> };
  codexGoto?: (bookId: string, chapter: number, verse: number) => void;
  codexJumpToRef?: (display: string) => void;
}
function hw(): HelperWindow {
  return window as unknown as HelperWindow;
}

export function yearLabel(y: number): string {
  if (y < 0) return `${-y} BC`;
  if (y === 0) return "1 BC/AD";
  return `AD ${y}`;
}

const FALLBACK: Record<string, string> = {
  gen: "Genesis", exo: "Exodus", lev: "Leviticus", num: "Numbers", deu: "Deuteronomy",
  jos: "Joshua", jdg: "Judges", rut: "Ruth",
  "1sa": "1 Samuel", "2sa": "2 Samuel", "1ki": "1 Kings", "2ki": "2 Kings",
  "1ch": "1 Chronicles", "2ch": "2 Chronicles", ezr: "Ezra", neh: "Nehemiah", est: "Esther",
  job: "Job", psa: "Psalms", pro: "Proverbs", ecc: "Ecclesiastes", sng: "Song of Songs",
  isa: "Isaiah", jer: "Jeremiah", lam: "Lamentations", eze: "Ezekiel", dan: "Daniel",
  hos: "Hosea", joe: "Joel", amo: "Amos", oba: "Obadiah", jon: "Jonah", mic: "Micah",
  nah: "Nahum", hab: "Habakkuk", zep: "Zephaniah", hag: "Haggai", zec: "Zechariah", mal: "Malachi",
  mat: "Matthew", mrk: "Mark", luk: "Luke", jhn: "John", act: "Acts",
  rom: "Romans", "1co": "1 Corinthians", "2co": "2 Corinthians", gal: "Galatians",
  eph: "Ephesians", php: "Philippians", col: "Colossians",
  "1th": "1 Thessalonians", "2th": "2 Thessalonians", "1ti": "1 Timothy", "2ti": "2 Timothy",
  tit: "Titus", phm: "Philemon", heb: "Hebrews", jas: "James",
  "1pe": "1 Peter", "2pe": "2 Peter", "1jn": "1 John", "2jn": "2 John", "3jn": "3 John",
  jud: "Jude", rev: "Revelation",
};

export function bookIdToName(id: string): string {
  const data = hw().CODEX_DATA;
  if (data && data.books) {
    const direct = data.books.find((b) => (b.id || "").toLowerCase() === id);
    if (direct) return direct.name || id;
    const guess = data.books.find((b) => (b.id || "").toLowerCase().startsWith(id) || id.startsWith((b.id || "").toLowerCase()));
    if (guess) return guess.name || id;
  }
  return FALLBACK[id] || id;
}

export interface ParsedRef {
  bookId: string;
  chapter: number;
  verse: number | null;
  display: string;
  raw: string;
}

export function parseScriptureRef(ref: string): ParsedRef | null {
  if (!ref) return null;
  const head = String(ref).split("-")[0] ?? "";
  const parts = head.split(".");
  const bookId = (parts[0] ?? "").toLowerCase();
  const chapter = parts[1] ? parseInt(parts[1], 10) : 1;
  const verse = parts[2] ? parseInt(parts[2], 10) : null;
  const display = verse ? `${bookIdToName(bookId)} ${chapter}:${verse}` : `${bookIdToName(bookId)} ${chapter}`;
  return { bookId, chapter, verse, display, raw: ref };
}

export function resolveBookId(osisBook: string): string | null {
  const want = String(osisBook || "").toLowerCase();
  const books = hw().CODEX_DATA?.books || [];
  const direct = books.find((b) => (b.id || "").toLowerCase() === want);
  if (direct) return direct.id ?? null;
  const pfx = books.find((b) => want.startsWith((b.id || "").toLowerCase()) || (b.id || "").toLowerCase().startsWith(want));
  return pfx ? pfx.id ?? null : null;
}

// The one door to the reader — every clicked ref lands HERE.
export function gotoRef(rawRef: string): void {
  const p = parseScriptureRef(rawRef);
  if (!p) return;
  const id = resolveBookId(p.bookId);
  if (id && typeof hw().codexGoto === "function") {
    hw().codexGoto?.(id, p.chapter, p.verse || 1);
    return;
  }
  if (typeof hw().codexJumpToRef === "function") {
    hw().codexJumpToRef?.(p.display);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("codex:navigate", {
      detail: { book: bookIdToName(p.bookId), bookId: p.bookId, chapter: p.chapter, verse: p.verse || 1 },
    }),
  );
}

// Does an event reference the given (bookId, chapter)?
export function eventMatchesPassage(ev: TimelineEvent | undefined, bookId: string | null, chapter: number | null): boolean {
  if (!ev || !ev.scripture || !bookId) return false;
  const wantBook = String(bookId).toLowerCase();
  for (const r of ev.scripture) {
    const p = parseScriptureRef(r);
    if (!p) continue;
    if (p.bookId === wantBook || wantBook.startsWith(p.bookId) || p.bookId.startsWith(wantBook)) {
      if (!chapter) return true;
      const span = String(r).split("-");
      if (span.length === 1) {
        if (p.chapter === chapter) return true;
      } else {
        const tailParts = (span[1] ?? "").split(".");
        const endCh = tailParts.length >= 2 ? parseInt(tailParts[0] ?? "", 10) : p.chapter;
        if (chapter >= p.chapter && chapter <= endCh) return true;
      }
    }
  }
  return false;
}

// Significance = breadth of attestation in the record itself (refs/people/places).
export function sigOf(ev: TimelineEvent): number {
  const s = (ev.scripture || []).length;
  const p = (ev.people || []).length;
  const pl = (ev.places || []).length;
  const spanY = ev.year_range ? Math.abs((ev.year_range[1] || 0) - (ev.year_range[0] || 0)) : 0;
  return Math.min(5, 1 + s * 0.9 + p * 0.35 + pl * 0.25 + (spanY > 20 ? 0.5 : 0));
}

export function pickTickInterval(spanYears: number, pxPerYear: number): number {
  const targetPx = 90;
  const wantYears = targetPx / Math.max(pxPerYear, 0.0001);
  const candidates = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000];
  for (const c of candidates) if (c >= wantYears) return c;
  return 2000;
}

export function reduceMotion(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
