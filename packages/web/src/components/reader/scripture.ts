// reader — red-letter scripture rendering logic (migrated from components.jsx).
// The part-splitting algorithm is pure and testable; renderScripture (in
// scripture.tsx) maps the parts to JSX. NFC-normalised so accent forms compose
// identically across regex match → indexOf wrap → display (Greek LXX, Hebrew
// with niqqud both depend on this).

export interface ScripturePart {
  t: string;
  kind: "red" | null;
}

// Final-resort Jesus-quote extractor — used when the cross-translation DB flags
// a verse as containing Jesus's words but the per-translation parser failed to
// find them. Looks for the "said/saith/spake … unto …, X" attribution and
// treats the trailing capitalised clause as the quote.
export function extractJesusQuoteHeuristic(text: string): string[] | null {
  const re = /\b(?:said|saith|answered|spake|cried|replied)\s+(?:also\s+|again\s+|then\s+)?(?:unto\s+(?:them|him|her|me|you|the\s+\w+)(?:\s+\w+){0,3}\s*)?,\s+([A-Z][^]{6,}?)$/;
  const m = text.match(re);
  return m && m[1] !== undefined && m[1].trim().length > 4 ? [m[1].trim()] : null;
}

// Split a verse into red-letter / plain parts. Whole-verse fallback escalation:
// if the DB knows Jesus speaks but the per-translation parser found nothing, try
// the heuristic; only paint the WHOLE verse red as a last resort (no-quote-mark
// translations like the Latin Vulgate). A single {kind:"red"} part spanning the
// whole text is the unified representation of that last resort.
export function buildScriptureParts(rawText: string, redQuotes: string[] | null | undefined, wholeVerse: boolean): ScripturePart[] {
  const text = rawText && rawText.normalize ? rawText.normalize("NFC") : rawText;
  if (wholeVerse && (!redQuotes || !redQuotes.length)) {
    const extracted = extractJesusQuoteHeuristic(text);
    if (extracted) {
      redQuotes = extracted;
      wholeVerse = false;
    }
  }
  if (wholeVerse && (!redQuotes || !redQuotes.length)) {
    return [{ t: text, kind: "red" }];
  }

  let parts: ScripturePart[] = [{ t: text, kind: null }];
  const wrap = (quotes: string[] | null | undefined, kind: "red", onlyOnPlain: boolean): void => {
    if (!quotes?.length) return;
    const sorted = [...quotes].sort((a, b) => b.length - a.length);
    const next: ScripturePart[] = [];
    for (const p of parts) {
      if (onlyOnPlain && p.kind) {
        next.push(p);
        continue;
      }
      let leftover = p.t;
      const segments: ScripturePart[] = [];
      while (leftover.length) {
        let bestIdx = -1;
        let bestQ: string | null = null;
        for (const q of sorted) {
          const i = leftover.indexOf(q);
          if (i !== -1 && (bestIdx === -1 || i < bestIdx)) {
            bestIdx = i;
            bestQ = q;
          }
        }
        if (bestIdx === -1 || bestQ === null) {
          segments.push({ t: leftover, kind: p.kind });
          break;
        }
        if (bestIdx > 0) segments.push({ t: leftover.slice(0, bestIdx), kind: p.kind });
        segments.push({ t: bestQ, kind });
        leftover = leftover.slice(bestIdx + bestQ.length);
      }
      next.push(...segments);
    }
    parts = next;
  };

  wrap(redQuotes, "red", true);
  return parts;
}
