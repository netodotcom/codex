// vox — helpers (migrated verbatim from vox.jsx). Pure shape/label/prefs logic
// plus the window-reading doors (books, translation language, the BIBLE chapter
// loader, the prayer-formats module loader). The pure pieces are ground-truth
// tested; the door pieces read runtime globals through vw().
import { vw, type VoxBook, type VoxVerse, type VoxPrefs, type PrayerPack } from "./vox-window.js";

export function booksList(): VoxBook[] {
  const data = vw().CODEX_DATA;
  return (data && data.books) || [];
}
export function bookName(bookId: string | undefined): string | undefined {
  const b = booksList().find((x) => x.id === bookId);
  return b ? b.name : bookId;
}
export function activeTranslationLang(translationId: string | undefined): string {
  try {
    const data = vw().CODEX_DATA;
    const t = ((data && data.translations) || [])
      .find((x) => x.id === translationId);
    const lang = (t && (t.lang || t.language)) || "en";
    return String(lang).toLowerCase();
  } catch {
    return "en";
  }
}

export function isNaturalVoice(v: SpeechSynthesisVoice | null | undefined): boolean {
  const n = (v && v.name) || "";
  return /(natural|neural|enhanced|premium|wavenet|studio|hd)/i.test(n);
}

export function langDisplay(code: string): string {
  const M: Record<string, string> = {
    en: "English", es: "Español", fr: "Français", de: "Deutsch",
    it: "Italiano", pt: "Português", he: "עברית", ar: "العربية",
    zh: "中文", ja: "日本語", ko: "한국어", ru: "Русский",
    el: "Ελληνικά", la: "Latina", hi: "हिन्दी", nl: "Nederlands",
    pl: "Polski", tr: "Türkçe", sv: "Svenska", id: "Bahasa",
  };
  return M[code] || code.toUpperCase();
}

// Verse-shape helpers — CODEX verses are { n, <translationId>: text, ... }.
export function verseNum(v: VoxVerse | null | undefined): number | string | undefined {
  return v ? (v.n != null ? v.n : (v.verse != null ? v.verse : v.num)) : undefined;
}
export function verseTextOf(v: VoxVerse | null | undefined, translation?: string): string {
  if (!v) return "";
  if (translation) {
    const tv = v[translation];
    if (typeof tv === "string" && tv) return tv;
  }
  if (typeof v.kjv === "string" && v.kjv) return v.kjv;
  if (typeof v.web === "string" && v.web) return v.web;
  if (typeof v.text === "string" && v.text) return v.text;
  if (typeof v.t === "string" && v.t) return v.t;
  for (const k in v) {
    const val = v[k];
    if (k !== "n" && typeof val === "string" && val) return val;
  }
  return "";
}

// Read a chapter's verses via the canonical BIBLE store. Uses loadChapter
// (the real export — there is no getChapter, which is why VOX always said
// "Nothing to read"), with a cached-read fallback.
export async function loadChapterVerses(
  bookId: string | undefined,
  chapter: number | string | undefined,
  translation: string | undefined,
): Promise<VoxVerse[]> {
  try {
    const bible = vw().BIBLE;
    if (bible && typeof bible.loadChapter === "function") {
      const res: unknown = await bible.loadChapter(bookId, chapter, translation);
      if (Array.isArray(res)) return res as VoxVerse[];
      const maybe = res as { verses?: unknown } | null;
      if (maybe && Array.isArray(maybe.verses)) return maybe.verses as VoxVerse[];
    }
  } catch {}
  try {
    const bible = vw().BIBLE;
    if (bible && typeof bible.getCachedChapter === "function") {
      const ch: unknown = bible.getCachedChapter(bookId, chapter, translation);
      if (Array.isArray(ch)) return ch as VoxVerse[];
      const maybe = ch as { verses?: unknown } | null;
      if (maybe && Array.isArray(maybe.verses)) return maybe.verses as VoxVerse[];
    }
  } catch {}
  return [];
}

// Per-voice prefs persistence
export function prefsKey(voiceId: string | undefined): string {
  return "codex.vox.prefs." + (voiceId || "default");
}
export function loadPrefs(voiceId: string | undefined): VoxPrefs {
  try {
    const j = localStorage.getItem(prefsKey(voiceId));
    if (j) return JSON.parse(j) as VoxPrefs;
  } catch {}
  return { rate: 1.0, pitch: 1.0, volume: 1.0 };
}
export function savePrefs(voiceId: string | undefined, prefs: VoxPrefs): void {
  try { localStorage.setItem(prefsKey(voiceId), JSON.stringify(prefs)); } catch {}
}

// ───────────────────────────────────────────────────────────────────────
// Prayer-formats module loader
// ───────────────────────────────────────────────────────────────────────
let _prayersPromise: Promise<PrayerPack> | null = null;
export function loadPrayerFormats(): Promise<PrayerPack> {
  if (_prayersPromise) return _prayersPromise;
  _prayersPromise = (async (): Promise<PrayerPack> => {
    // Try the modules system first (cached in IndexedDB).
    try {
      const modules = vw().CODEX_MODULES;
      if (modules && typeof modules.loadModule === "function") {
        const m = (await modules.loadModule("prayer-formats")) as PrayerPack | null;
        if (m && Array.isArray(m.formats)) return m;
      }
    } catch {}
    // Fallback — direct fetch of the bundled file.
    try {
      const r = await fetch("data/modules/prayer-formats.json");
      if (r.ok) return (await r.json()) as PrayerPack;
    } catch {}
    return { formats: [] };
  })().catch((e) => { _prayersPromise = null; throw e; });
  return _prayersPromise;
}
