// passage-guide — the drafter call (migrated verbatim from passage-guide.jsx).
// One fetch per chapter to /api/chat, de-duped via an in-flight map and cached
// on success. Reads window.codexLangName through the boundary for localisation.
import { cacheKey, getCached, putCached } from "./cache.js";
import { extractJSON, validate, type Guide } from "./json.js";
import { pgw } from "./passage-guide-window.js";

// ── Prompt ───────────────────────────────────────────────────────────
export const PROMPT_SYSTEM = `You are the CODEX PASSAGE GUIDE drafter. For one Bible chapter, produce a compact JSON object that fuses outline, themes, key word studies, historical context, and a one-paragraph synthesis. Scholarly, multi-tradition, never proselytising.

OUTPUT FORMAT — RETURN ONLY a single JSON object, no prose, no fences:

{
  "_schema": 1,
  "overview": "ONE sentence — under 25 words — capturing the chapter's heart.",
  "outline": [   // 4-6 entries that partition the chapter sequentially
    { "title": "4-7 word section title", "range": "1-11", "summary": "30-50 words of what happens in this section" }
  ],
  "themes": [   // 4-6 entries
    { "name": "1-3 word theme (e.g. 'No condemnation')", "verse_anchor": <int — the single verse most representative> }
  ],
  "key_words": [   // exactly 5 — the most significant original-language words
    { "word": "english gloss", "original": "Hebrew/Greek native script", "translit": "english transliteration", "verse_anchor": <int>, "strongs": "G3056 or H1234" }
  ],
  "historical_context": "2-3 sentences of historical-cultural setting that illuminate the chapter.",
  "synthesis": "ONE beautiful paragraph (60-100 words) that weaves outline + themes + words + context into a single arc — what this chapter is really doing."
}

Rules:
- All verse_anchor values must be real verses in the chapter.
- Strong's numbers: real ones from your training (G#### for Greek NT, H#### for Hebrew OT). If genuinely unsure, omit the field.
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON. Stay compact.`;

export interface FetchGuideOpts {
  force?: boolean;
  provider?: string;
  model?: string;
}

interface ChatResponse {
  error?: string;
  text?: string;
  provider?: string;
  model?: string;
}

const inflight = new Map<string, Promise<Guide>>();

export async function fetchGuide(bookId: string, chapter: number, bookName: string, opts: FetchGuideOpts = {}): Promise<Guide> {
  const key = cacheKey(bookId, chapter);
  const cached = !opts.force && getCached(bookId, chapter);
  if (cached) return cached;
  if (inflight.has(key)) return inflight.get(key)!;

  const langName = (pgw().codexLangName && pgw().codexLangName!()) || "English";
  const langDirective =
    langName === "English"
      ? ""
      : `\n\nLANGUAGE: All human-readable STRING values (overview, titles, summaries, theme names, glosses, historical_context, synthesis) MUST be written in ${langName}. Keep native-script terms (Hebrew/Greek) and their transliterations as-is. Keep Strong's IDs in English.`;

  const userMsg = `Draft the CODEX Passage Guide for: ${bookName} ${chapter}.
Return ONLY the JSON object as specified.${langDirective}`;

  const p = (async (): Promise<Guide> => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: PROMPT_SYSTEM + langDirective,
        messages: [{ role: "user", content: userMsg }],
        max_tokens: 2200,
        provider: opts.provider,
        model: opts.model,
      }),
    });
    const data = (await r.json()) as ChatResponse;
    if (!r.ok) throw new Error(data.error || `passage-guide HTTP ${r.status}`);
    const parsed = validate(extractJSON(data.text || ""));
    parsed._provider = data.provider || opts.provider || "anthropic";
    parsed._model = data.model || opts.model || null;
    putCached(bookId, chapter, parsed);
    return parsed;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}
