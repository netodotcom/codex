// reader — "translate for normies" support (migrated from components.jsx).
// normieHash + the language labels are pure; currentUiLang is the window/storage
// boundary. The NormieToggle component (normie.tsx) does the cached AI rewrite.

export const NORMIE_LANG_LABELS: Record<string, string> = {
  en: "English", es: "Spanish", de: "German", fr: "French", pt: "Portuguese",
  la: "Latin", he: "Hebrew", el: "Greek", hi: "Hindi", it: "Italian",
  ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
};

// Stable 32-bit string hash in base36 — keys the per-text+lang plain-version
// cache so a rewrite is a one-time call.
export function normieHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

interface NormieWindow {
  CODEX_LANG?: string;
}

export function currentUiLang(): string {
  try {
    if (typeof window !== "undefined") {
      const w = window as unknown as NormieWindow;
      if (w.CODEX_LANG) return w.CODEX_LANG;
      const stored = localStorage.getItem("codex.lang");
      if (stored) return stored;
    }
  } catch {
    /* ignore */
  }
  return "en";
}
