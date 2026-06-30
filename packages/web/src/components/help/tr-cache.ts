// help — local-storage translation cache (migrated verbatim from help.jsx).
// AI translations of articles are memoised under codex.help.tr.<id>.<lang>
// so a reader pays the round-trip once. All access is wrapped in try/catch,
// exactly as the legacy did (private mode / quota failures are swallowed).
import { SUPPORTED_LANGS } from "./data.js";

export const TR_KEY = (id: string, lang: string): string => `codex.help.tr.${id}.${lang}`;
export const TR_TITLE_KEY = (id: string, lang: string): string => `codex.help.tr.${id}.${lang}.title`;

export interface TrCacheEntry {
  body: string;
  title: string | null;
}

export function readTrCache(id: string, lang: string): TrCacheEntry | null {
  try {
    const body  = localStorage.getItem(TR_KEY(id, lang));
    const title = localStorage.getItem(TR_TITLE_KEY(id, lang));
    if (body) return { body, title: title || null };
  } catch {
    /* ignore */
  }
  return null;
}

export function writeTrCache(id: string, lang: string, body: string, title: string | null): void {
  try {
    localStorage.setItem(TR_KEY(id, lang), body);
    if (title) localStorage.setItem(TR_TITLE_KEY(id, lang), title);
  } catch {
    /* ignore */
  }
}

export function cachedLangsFor(id: string): string[] {
  const out: string[] = [];
  for (const l of SUPPORTED_LANGS) {
    try {
      if (localStorage.getItem(TR_KEY(id, l.code))) out.push(l.code);
    } catch {
      /* ignore */
    }
  }
  return out;
}
