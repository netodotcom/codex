// verse-art — pure helpers (migrated faithfully from verse-art.jsx).
// Covers the AI-prompt constants, the multi-source image resolver, and
// tolerantParse (a thin bridge to window.CODEX_INTEL.intelParseJSON).

import { vaw } from "./verse-art-window.js";

// ── Prompt constants ──────────────────────────────────────────────────────
export const ART_PROMPT = `You are CODEX ART — a visual-arts curator for biblical passages. For the given verse, identify notable paintings, frescoes, illuminated manuscripts, sculptures, or films that depict THIS specific scene. Return a single JSON object. No prose, no fences, only the JSON.

Schema:
{
  "scene":   "1 sentence naming the scene depicted (e.g. 'The Annunciation to Mary').",
  "works": [
    {
      "title":       "Work title",
      "artist":      "Artist name (or 'Anonymous')",
      "year":        <integer year, BCE negative — best estimate>,
      "medium":      "e.g. 'oil on canvas', 'fresco', 'illuminated manuscript', 'film'",
      "location":    "Museum / collection / location if known, else ''",
      "commonsFile": "Wikimedia Commons filename if you are confident it exists (e.g. 'Caravaggio_-_The_Calling_of_Saint_Matthew.jpg'). Empty string if unsure.",
      "wikipedia":   "Wikipedia article title if known (English), else ''",
      "summary":     "2 sentences on composition + significance — calm, scholarly.",
      "themes":      "3–5 short visual themes, comma-separated"
    }
  ]
}

Rules:
- 6–8 works. Span eras (Byzantine → Renaissance → Baroque → Modern → Contemporary) when plausible.
- Only include works whose existence and attribution you are confident in.
- commonsFile must be a real file you have seen referenced; otherwise leave empty (placeholder will show).
- Calm scholarly tone. No exclamations, no emoji.
- Return ONLY the JSON object.`;

export function ART_MORE_PROMPT(excludeTitles: string[]): string {
  return `Same task as before — return MORE artworks for the same verse, in the same JSON schema. EXCLUDE these already-shown titles: ${excludeTitles.map(t => `"${t}"`).join(", ")}. Aim for different artists, eras, or media. 6 new works.`;
}

// ── Truncation-tolerant JSON parse (delegates to shared intel layer) ──────
export function tolerantParse(s: string): unknown {
  return vaw().CODEX_INTEL?.intelParseJSON(s);
}

// ── Data shapes (exported for components and tests) ───────────────────────
export interface ArtWork {
  title: string;
  artist?: string;
  year?: number | null;
  medium?: string;
  location?: string;
  commonsFile?: string;
  wikipedia?: string;
  summary?: string;
  themes?: string;
}

export interface ArtData {
  scene?: string;
  works?: ArtWork[];
}

// ── Multi-source image resolver ───────────────────────────────────────────
// Each result is memoised in module scope so repeat opens of the same artwork
// (or other cards citing the same artist) don't refetch.
const _artImgCache = new Map<string, string | null>();

export async function resolveArtImage(work: ArtWork): Promise<string | null> {
  const key = `${work.commonsFile || ""}|${work.wikipedia || ""}|${work.title}|${work.artist || ""}`;
  if (_artImgCache.has(key)) {
    const v = _artImgCache.get(key);
    return v !== undefined ? v : null;
  }
  const result = await (async (): Promise<string | null> => {
    // 1. Direct Commons file path (Claude's most-confident hint)
    if (work.commonsFile) {
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(work.commonsFile)}?width=600`;
      if (await preloadImg(url)) return url;
    }
    // 2. Wikipedia article summary by article title (most reliable signal)
    if (work.wikipedia) {
      const t = work.wikipedia.replace(/ /g, "_");
      const url = await wikiThumb(t);
      if (url) return url;
    }
    // 3. Summary lookup by the work's title alone
    if (work.title) {
      const url = await wikiThumb(work.title.replace(/ /g, "_"));
      if (url) return url;
    }
    // 4. Title + artist combined (catches "<artist>'s <work>" article titles)
    if (work.title && work.artist) {
      const combo = `${work.title} ${work.artist}`.replace(/ /g, "_");
      const url = await wikiThumb(combo);
      if (url) return url;
    }
    // 5. Commons MediaWiki search — last resort, finds any matching file
    try {
      const q = `${work.title} ${work.artist || ""}`.trim();
      const r = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=6&format=json&origin=*`,
        { headers: { "Accept": "application/json" } }
      );
      if (r.ok) {
        const j = (await r.json()) as {
          query?: {
            search?: Array<{ title?: string }>;
          };
        };
        const first = j?.query?.search?.[0]?.title;
        if (first) {
          const file = first.replace(/^File:/, "");
          const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`;
          if (await preloadImg(url)) return url;
        }
      }
    } catch {
      // ignore
    }
    return null;
  })();
  _artImgCache.set(key, result);
  return result;
}

export function preloadImg(src: string): Promise<boolean> {
  return new Promise<boolean>(res => {
    const img = new Image();
    img.onload  = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
}

export async function wikiThumb(slug: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    return j.thumbnail?.source ?? j.originalimage?.source ?? null;
  } catch {
    return null;
  }
}
