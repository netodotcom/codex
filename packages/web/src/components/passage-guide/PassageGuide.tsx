// passage-guide — THE PASSAGE GUIDE (migrated from passage-guide.jsx). A single
// printed-study-sheet synthesis for the current chapter that fuses the AI guide
// (outline + themes + key words + historical context + synthesis) with TSK
// cross-refs, gematria numerology, Strong's word studies, a geography link, and
// reels-curated related reading. createElement is kept verbatim from v1 so the
// DOM output is byte-for-intent identical; only types were added.
import React from "react";
import { getCached, cacheKey } from "./cache.js";
import { fetchGuide } from "./api.js";
import { parseRefKey, emitDepth, navigateTo, openStrongs, openMap } from "./helpers.js";
import { pgw, type KabMap, type CrossRef, type GematriaMatch, type KabConcept } from "./passage-guide-window.js";
import type { Guide } from "./json.js";

const { useState, useEffect, useMemo, useRef, useCallback } = React;

interface PanelCtx {
  book?: string;
  bookId?: string;
  chapter?: number;
  translation?: string;
}

interface Card {
  bookId?: string;
  ref?: string;
  chapter?: number;
  title?: string;
  summary?: string;
  note?: string;
  [k: string]: unknown;
}
interface ReelsModule {
  cards?: Card[];
  entries?: Card[];
}

interface NumerologyHit {
  value: number;
  concept: KabConcept | undefined;
  match: GematriaMatch;
}

// ── Kabbalah mapping loader (cached on window) ───────────────────────
function useKabbalahMap(): KabMap | null {
  const [m, setM] = useState<KabMap | null>(() => (typeof window !== "undefined" ? pgw().__CODEX_KAB__ : null) || null);
  useEffect(() => {
    if (m) return;
    let alive = true;
    fetch("data/modules/kabbalah-mappings.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) {
          pgw().__CODEX_KAB__ = j as KabMap;
          setM(j as KabMap);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [m]);
  return m;
}

// ── Hook: gather cross-refs for the WHOLE chapter ────────────────────
function useChapterCrossRefs(bookId: string | undefined, chapter: number | undefined): CrossRef[] {
  const [refs, setRefs] = useState<CrossRef[]>([]);
  useEffect(() => {
    let alive = true;
    const lookup = pgw().CODEX_CrossRefLookup;
    if (!lookup || typeof lookup.getCrossRefs !== "function") return;
    // Sample verses 1..30 (TSK sample is sparse — we just grab whatever exists)
    const verses = Array.from({ length: 30 }, (_, i) => i + 1);
    Promise.all(
      verses.map((v) =>
        lookup
          .getCrossRefs(`${bookId}.${chapter}.${v}`)
          .then((arr) => (arr || []).map((x) => ({ ...x, from: v })))
          .catch(() => [] as CrossRef[]),
      ),
    ).then((buckets) => {
      if (!alive) return;
      const flat = ([] as CrossRef[]).concat(...buckets);
      // Dedupe by ref string
      const seen = new Set<string>();
      const out: CrossRef[] = [];
      for (const r of flat) {
        if (!r || !r.ref) continue;
        if (seen.has(r.ref)) continue;
        seen.add(r.ref);
        out.push(r);
        if (out.length >= 10) break;
      }
      setRefs(out);
    });
    return () => {
      alive = false;
    };
  }, [bookId, chapter]);
  return refs;
}

// ── Hook: scan the chapter's gematria for significant values ─────────
function useNumerologySnapshot(bookId: string | undefined, chapter: number | undefined, kabMap: KabMap | null): NumerologyHit[] {
  const [hits, setHits] = useState<NumerologyHit[]>([]);
  useEffect(() => {
    if (!kabMap || !kabMap.value_to_concept) {
      setHits([]);
      return;
    }
    const idx = pgw().CODEX_GEMATRIA_INDEX;
    if (!idx) {
      setHits([]);
      return;
    }
    let alive = true;
    const v2c = kabMap.value_to_concept;
    const significant = Object.keys(v2c)
      .map((n) => parseInt(n, 10))
      .filter(Number.isFinite);
    (async () => {
      try {
        if (typeof idx.ensure === "function") await idx.ensure();
      } catch {
        /* ignore */
      }
      if (!alive) return;
      const out: NumerologyHit[] = [];
      const seenValues = new Set<number>();
      for (const value of significant) {
        if (out.length >= 3) break;
        if (seenValues.has(value)) continue;
        let matches: GematriaMatch[] = [];
        try {
          matches = idx.find(value) || [];
        } catch {
          /* ignore */
        }
        const inChapter = matches.filter((m) => {
          const p = parseRefKey(m.ref);
          return p && p.bookId === bookId && p.chapter === chapter;
        });
        if (inChapter.length) {
          seenValues.add(value);
          out.push({
            value,
            concept: v2c[String(value)],
            match: inChapter[0]!,
          });
        }
      }
      if (alive) setHits(out);
    })();
    return () => {
      alive = false;
    };
  }, [bookId, chapter, kabMap]);
  return hits;
}

// ── Related reading: pull from reels-curated by book ────────────────
function useRelatedReading(bookId: string | undefined, chapter: number | undefined): Card[] {
  const [related, setRelated] = useState<Card[]>([]);
  useEffect(() => {
    let alive = true;
    const finish = (arr: Card[]): void => {
      if (alive) setRelated(arr.slice(0, 3));
    };
    // Try reels-curated module via CODEX_MODULES, then fall back to direct fetch
    (async () => {
      let mod: ReelsModule | null = null;
      try {
        const modules = pgw().CODEX_MODULES;
        if (modules && modules.loadModule) {
          mod = (await modules.loadModule("reels-curated")) as ReelsModule;
        }
      } catch {
        /* ignore */
      }
      if (!mod) {
        try {
          const r = await fetch("data/modules/reels-curated.json");
          if (r.ok) mod = (await r.json()) as ReelsModule;
        } catch {
          /* ignore */
        }
      }
      if (!mod) return finish([]);
      const cards = mod.cards || mod.entries || [];
      if (!Array.isArray(cards)) return finish([]);
      // Prefer cards anchored on a different chapter of the same book,
      // then anything in the same book, then anything at all.
      const sameBookOther = cards.filter(
        (c) => c && (c.bookId === bookId || (typeof c.ref === "string" && c.ref.toLowerCase().startsWith(String(bookId) + "."))) && c.chapter !== chapter,
      );
      const others = cards.filter((c) => c && !sameBookOther.includes(c));
      finish([...sameBookOther, ...others]);
    })();
    return () => {
      alive = false;
    };
  }, [bookId, chapter]);
  return related;
}

// ── Section primitives ───────────────────────────────────────────────
function Skeleton({ lines = 3 }: { lines?: number }): React.ReactElement {
  return React.createElement(
    "div",
    { className: "cx-pg-skeleton" },
    Array.from({ length: lines }, (_, i) => React.createElement("div", { key: i, className: "cx-pg-skel-line", style: { width: 60 + ((i * 17) % 35) + "%" } })),
  );
}

interface SectionProps {
  id: string;
  title: string;
  kind: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}
function Section({ id, title, kind, defaultOpen = true, children }: SectionProps): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return React.createElement(
    "section",
    { className: "cx-pg-section", id },
    React.createElement(
      "header",
      {
        className: "cx-pg-sec-head",
        onClick: () => setOpen((o) => !o),
        role: "button",
        tabIndex: 0,
        "aria-expanded": open,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        },
      },
      React.createElement("span", { className: "cx-pg-sec-kind" }, kind),
      React.createElement("h3", { className: "cx-pg-sec-title" }, title),
      React.createElement("span", { className: "cx-pg-sec-chev", "aria-hidden": true }, open ? "−" : "+"),
    ),
    open ? React.createElement("div", { className: "cx-pg-sec-body" }, children) : null,
  );
}

// ── Main component ───────────────────────────────────────────────────
export function PassageGuide(ctx: PanelCtx): React.ReactElement {
  const { book, bookId, chapter, translation } = ctx || {};
  const kabMap = useKabbalahMap();
  const [guide, setGuide] = useState<Guide | null>(() => (bookId ? getCached(bookId, chapter) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);
  const emittedRef = useRef<Set<string>>(new Set());

  // Fetch / load guide whenever chapter changes
  useEffect(() => {
    if (!bookId || !chapter) return;
    const cached = getCached(bookId, chapter);
    if (cached) {
      setGuide(cached);
      setLoading(false);
      setError("");
      return;
    }
    setGuide(null);
    setError("");
    setLoading(true);
    const my = ++reqIdRef.current;
    fetchGuide(bookId, chapter, book || bookId)
      .then((data) => {
        if (my === reqIdRef.current) {
          setGuide(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (my !== reqIdRef.current) return;
        setError((err as { message?: string }).message || String(err));
        setLoading(false);
      });
  }, [bookId, chapter, book]);

  // Emit a depth-action the first time a guide resolves for this chapter.
  // De-duped per bookId.chapter so re-renders / cache-hits don't double-count.
  useEffect(() => {
    if (!guide || !bookId || !chapter) return;
    const ref = `${bookId}.${chapter}`;
    if (emittedRef.current.has(ref)) return;
    emittedRef.current.add(ref);
    emitDepth("passage-guide-read", ref, 4);
  }, [guide, bookId, chapter]);

  const verseCount = useMemo<number | null>(() => {
    try {
      const bible = pgw().BIBLE;
      const ch = bible && bible.getCachedChapter ? bible.getCachedChapter(bookId, chapter, translation || "kjv") : null;
      if (ch && Array.isArray(ch.verses)) return ch.verses.length;
    } catch {
      /* ignore */
    }
    return null;
  }, [bookId, chapter, translation, guide]);

  const crossRefs = useChapterCrossRefs(bookId, chapter);
  const numerology = useNumerologySnapshot(bookId, chapter, kabMap);
  const related = useRelatedReading(bookId, chapter);

  const hasStrongs = !!pgw().CODEX_StrongsLookup;

  const regenerate = useCallback(() => {
    if (!bookId || !chapter) return;
    try {
      localStorage.removeItem(cacheKey(bookId, chapter));
    } catch {
      /* ignore */
    }
    setGuide(null);
    setError("");
    setLoading(true);
    const my = ++reqIdRef.current;
    fetchGuide(bookId, chapter, book || bookId, { force: true })
      .then((data) => {
        if (my === reqIdRef.current) {
          setGuide(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (my !== reqIdRef.current) return;
        setError((err as { message?: string }).message || String(err));
        setLoading(false);
      });
  }, [bookId, chapter, book]);

  if (!bookId || !chapter) {
    return React.createElement("div", { className: "cx-pg-empty" }, "Open a chapter to see its Passage Guide.");
  }

  // ── Hero ───────────────────────────────────────────────────────────
  const hero = React.createElement(
    "header",
    { className: "cx-pg-hero" },
    React.createElement(
      "div",
      { className: "cx-pg-hero-meta" },
      React.createElement("span", { className: "cx-pg-hero-cat" }, "❖ PASSAGE GUIDE"),
      React.createElement("span", { className: "cx-pg-hero-dot" }, "·"),
      React.createElement("span", null, `${book || bookId} ${chapter}`),
      verseCount
        ? [
            React.createElement("span", { key: "d", className: "cx-pg-hero-dot" }, "·"),
            React.createElement("span", { key: "v" }, `${verseCount} verses`),
          ]
        : null,
    ),
    React.createElement("h2", { className: "cx-pg-hero-title" }, `${book || bookId} ${chapter}`),
    guide && guide.overview
      ? React.createElement("p", { className: "cx-pg-hero-overview" }, guide.overview)
      : loading
        ? React.createElement(Skeleton, { lines: 2 })
        : null,
    React.createElement("div", { className: "cx-pg-hero-rule" }),
    React.createElement(
      "div",
      { className: "cx-pg-hero-actions" },
      React.createElement(
        "button",
        {
          className: "cx-pg-btn",
          onClick: regenerate,
          disabled: loading,
          title: loading ? "Generating…" : "Regenerate Passage Guide",
        },
        loading ? "Generating…" : guide ? "↻ Regenerate" : "Generate",
      ),
      guide && guide._provider ? React.createElement("span", { className: "cx-pg-prov" }, `via ${guide._provider}`) : null,
    ),
  );

  // ── Outline ────────────────────────────────────────────────────────
  const outlineSection = React.createElement(
    Section,
    { id: "outline", kind: "I", title: "Outline" },
    loading && !guide
      ? React.createElement(Skeleton, { lines: 4 })
      : guide && guide.outline && guide.outline.length
        ? React.createElement(
            "ol",
            { className: "cx-pg-outline" },
            guide.outline.map((s, i) => {
              const firstV = (() => {
                const m = String(s.range || "").match(/^(\d+)/);
                return m ? parseInt(m[1]!, 10) : null;
              })();
              return React.createElement(
                "li",
                {
                  key: i,
                  className: "cx-pg-outline-item",
                  onClick: () => firstV && navigateTo(bookId, book, chapter, firstV),
                  role: firstV ? "button" : undefined,
                  tabIndex: firstV ? 0 : undefined,
                },
                React.createElement(
                  "div",
                  { className: "cx-pg-outline-head" },
                  React.createElement("span", { className: "cx-pg-outline-title" }, s.title || `Section ${i + 1}`),
                  s.range ? React.createElement("span", { className: "cx-pg-outline-range" }, `v${s.range}`) : null,
                ),
                s.summary ? React.createElement("p", { className: "cx-pg-outline-sum" }, s.summary) : null,
              );
            }),
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No outline yet."),
  );

  // ── Themes ─────────────────────────────────────────────────────────
  const themesSection = React.createElement(
    Section,
    { id: "themes", kind: "II", title: "Key Themes" },
    loading && !guide
      ? React.createElement(Skeleton, { lines: 2 })
      : guide && guide.themes && guide.themes.length
        ? React.createElement(
            "div",
            { className: "cx-pg-themes" },
            guide.themes.map((t, i) =>
              React.createElement(
                "button",
                {
                  key: i,
                  className: "cx-pg-theme",
                  onClick: () => t.verse_anchor && navigateTo(bookId, book, chapter, t.verse_anchor),
                  title: t.verse_anchor ? `Jump to verse ${t.verse_anchor}` : "",
                },
                React.createElement("span", { className: "cx-pg-theme-name" }, t.name),
                t.verse_anchor ? React.createElement("span", { className: "cx-pg-theme-anchor" }, `v${t.verse_anchor}`) : null,
              ),
            ),
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No themes yet."),
  );

  // ── Cross-references ───────────────────────────────────────────────
  const crl = pgw().CODEX_CrossRefLookup;
  const xrefFmt: (k: string) => string = (crl && crl.formatRef) || ((k) => k);
  const xrefSection = React.createElement(
    Section,
    { id: "xrefs", kind: "III", title: "Top Cross-References" },
    crossRefs.length
      ? (() => {
          // Group by theme when present
          const byTheme = new Map<string, CrossRef[]>();
          for (const r of crossRefs) {
            const k = r.theme || "Parallels";
            if (!byTheme.has(k)) byTheme.set(k, []);
            byTheme.get(k)!.push(r);
          }
          return React.createElement(
            "div",
            { className: "cx-pg-xrefs" },
            Array.from(byTheme.entries()).map(([theme, arr], i) =>
              React.createElement(
                "div",
                { key: i, className: "cx-pg-xref-group" },
                React.createElement("div", { className: "cx-pg-xref-theme" }, theme),
                React.createElement(
                  "ul",
                  { className: "cx-pg-xref-list" },
                  arr.map((r, j) => {
                    const p = parseRefKey(r.ref);
                    return React.createElement(
                      "li",
                      { key: j },
                      React.createElement(
                        "button",
                        {
                          className: "cx-pg-xref-btn",
                          onClick: () => p && navigateTo(p.bookId, null, p.chapter, p.verse),
                          title: "Navigate",
                        },
                        xrefFmt(r.ref),
                      ),
                      r.from ? React.createElement("span", { className: "cx-pg-xref-from" }, `from v${r.from}`) : null,
                    );
                  }),
                ),
              ),
            ),
          );
        })()
      : React.createElement("p", { className: "cx-pg-muted" }, pgw().CODEX_CrossRefLookup ? "No TSK entries for this chapter in the sample set." : "Cross-reference module not loaded."),
  );

  // ── Word studies ───────────────────────────────────────────────────
  const wordsSection = React.createElement(
    Section,
    { id: "words", kind: "IV", title: "Word Studies" },
    loading && !guide
      ? React.createElement(Skeleton, { lines: 3 })
      : guide && guide.key_words && guide.key_words.length
        ? React.createElement(
            "ul",
            { className: "cx-pg-words" },
            guide.key_words.map((w, i) => {
              const entry = hasStrongs && w.strongs ? pgw().CODEX_StrongsLookup!(w.strongs) : null;
              const clickable = !!(hasStrongs && w.strongs);
              return React.createElement(
                "li",
                { key: i, className: "cx-pg-word" },
                React.createElement(
                  "div",
                  { className: "cx-pg-word-head" },
                  w.original ? React.createElement("span", { className: "cx-pg-word-orig", lang: "he" }, w.original) : null,
                  React.createElement("span", { className: "cx-pg-word-translit" }, w.translit || ""),
                  w.strongs
                    ? React.createElement(
                        "button",
                        {
                          className: "cx-pg-word-strongs",
                          disabled: !clickable,
                          onClick: () => openStrongs(w.strongs),
                          title: clickable ? "Open Strong's entry" : "Strong's lexicon not loaded",
                        },
                        w.strongs,
                      )
                    : null,
                  w.verse_anchor
                    ? React.createElement(
                        "button",
                        {
                          className: "cx-pg-word-anchor",
                          onClick: () => navigateTo(bookId, book, chapter, w.verse_anchor),
                          title: "Jump to verse",
                        },
                        `v${w.verse_anchor}`,
                      )
                    : null,
                ),
                React.createElement(
                  "div",
                  { className: "cx-pg-word-gloss" },
                  React.createElement("b", null, w.word || ""),
                  entry && entry.gloss
                    ? React.createElement("span", { className: "cx-pg-word-lex" }, " — " + entry.gloss)
                    : entry && entry.definition
                      ? React.createElement("span", { className: "cx-pg-word-lex" }, " — " + entry.definition)
                      : null,
                ),
              );
            }),
          )
        : React.createElement("p", { className: "cx-pg-muted" }, "No words yet."),
  );

  // ── Numerology ────────────────────────────────────────────────────
  const numerologySection = numerology.length
    ? React.createElement(
        Section,
        { id: "numerology", kind: "V", title: "Numerology Snapshot", defaultOpen: true },
        React.createElement(
          "ul",
          { className: "cx-pg-num" },
          numerology.map((n, i) => {
            const p = parseRefKey(n.match.ref);
            return React.createElement(
              "li",
              { key: i, className: "cx-pg-num-row" },
              React.createElement("div", { className: "cx-pg-num-val" }, n.value),
              React.createElement(
                "div",
                { className: "cx-pg-num-body" },
                React.createElement("div", { className: "cx-pg-num-concept" }, n.concept && n.concept.concept ? n.concept.concept : "—"),
                React.createElement(
                  "div",
                  { className: "cx-pg-num-cite" },
                  React.createElement(
                    "button",
                    {
                      className: "cx-pg-link",
                      onClick: () => p && navigateTo(p.bookId, book, p.chapter, p.verse),
                    },
                    `${book || bookId} ${p ? p.chapter + ":" + (p.verse || "?") : ""}`,
                  ),
                  n.match.word ? React.createElement("span", { className: "cx-pg-num-word", lang: "he" }, ` — ${n.match.word}`) : null,
                  n.match.system ? React.createElement("span", { className: "cx-pg-num-sys" }, ` (${n.match.system})`) : null,
                ),
              ),
            );
          }),
        ),
      )
    : null;

  // ── Historical context ────────────────────────────────────────────
  const historySection = React.createElement(
    Section,
    { id: "history", kind: "VI", title: "Historical Context" },
    loading && !guide
      ? React.createElement(Skeleton, { lines: 2 })
      : guide && guide.historical_context
        ? React.createElement("p", { className: "cx-pg-prose" }, guide.historical_context)
        : React.createElement("p", { className: "cx-pg-muted" }, "—"),
  );

  // ── Geography link ────────────────────────────────────────────────
  const geographySection = React.createElement(
    Section,
    { id: "geo", kind: "VII", title: "Geography" },
    React.createElement(
      "p",
      { className: "cx-pg-prose" },
      "Named places in this chapter can be explored on the map. ",
      React.createElement(
        "button",
        {
          className: "cx-pg-link",
          onClick: () => openMap(bookId, book, chapter),
        },
        "Open verse-map →",
      ),
    ),
  );

  // ── Synthesis ─────────────────────────────────────────────────────
  const synthesisSection = React.createElement(
    Section,
    { id: "synthesis", kind: "VIII", title: "Synthesis" },
    loading && !guide
      ? React.createElement(Skeleton, { lines: 4 })
      : guide && guide.synthesis
        ? React.createElement("p", { className: "cx-pg-prose cx-pg-synth" }, guide.synthesis)
        : React.createElement("p", { className: "cx-pg-muted" }, "—"),
  );

  // ── Related reading ───────────────────────────────────────────────
  const relatedSection = related.length
    ? React.createElement(
        Section,
        { id: "related", kind: "IX", title: "Related Reading" },
        React.createElement(
          "div",
          { className: "cx-pg-related" },
          related.map((c, i) => {
            const ref = c.ref || `${c.bookId || ""}.${c.chapter || ""}`;
            const p = typeof ref === "string" ? parseRefKey(ref) : null;
            const label = c.title || (p ? `${p.bookId} ${p.chapter}${p.verse ? ":" + p.verse : ""}` : ref);
            return React.createElement(
              "button",
              {
                key: i,
                className: "cx-pg-related-card",
                onClick: () => p && navigateTo(p.bookId, null, p.chapter, p.verse),
              },
              React.createElement("div", { className: "cx-pg-related-label" }, label),
              c.summary || c.note ? React.createElement("div", { className: "cx-pg-related-sum" }, c.summary || c.note) : null,
            );
          }),
        ),
      )
    : null;

  return React.createElement(
    "div",
    { className: "cx-pg" },
    hero,
    error ? React.createElement("div", { className: "cx-pg-error" }, "Could not generate guide: " + error) : null,
    outlineSection,
    themesSection,
    xrefSection,
    wordsSection,
    numerologySection,
    historySection,
    geographySection,
    synthesisSection,
    relatedSection,
    React.createElement("footer", { className: "cx-pg-foot" }, "CODEX Passage Guide · cached locally · regenerate to refresh"),
  );
}
