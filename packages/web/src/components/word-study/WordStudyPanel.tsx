// word-study — WordStudyPanel component (migrated faithfully from word-study.jsx).
// Deep-dive on a single Greek/Hebrew/English word: hero header, semantic range,
// frequency-by-book bar chart, first occurrences, AI-fetched related words, and a
// 1-paragraph theology pull. All logic, DOM output, event listeners, and side-effects
// are byte-for-intent identical to the legacy IIFE component.
import React from "react";
import {
  lsGet, lsSet,
  emitDepth, hasAiKey,
  bookName, parseRef, navigate, lookup,
  splitSemanticRange,
  aiCacheGet, aiCacheSet,
  fetchRelated, fetchTheology,
  frequencyFor,
  LS_LAST,
} from "./helpers.js";
import type { RelatedItem, RelatedData, FreqResult } from "./helpers.js";
import type { WsStrongsEntry } from "./word-study-window.js";

const { useState, useEffect, useMemo, useRef } = React;

// ── Internal types ────────────────────────────────────────────────────────────
type Lang = "heb" | "grk" | "eng";

interface WordEntry {
  strongs: string | null;
  entry: WsStrongsEntry | null;
  word: string;
  lang: Lang;
}

interface FreqState extends FreqResult {
  loading: boolean;
}

interface AiState {
  related: RelatedData | null;
  theology: string | null;
  loading: boolean;
  err: unknown;
}

interface LastStudied {
  word?: string | null;
  strongs?: string | null;
}

// ── renderRelGroup (module-level, mirrors legacy placement) ───────────────────
function renderRelGroup(label: string, list: RelatedItem[] | null | undefined): React.ReactElement | null {
  if (!list || !list.length) return null;
  return (
    <div className="cx-ws-rel-group">
      <div className="cx-ws-rel-label">{label}</div>
      <ul className="cx-ws-rel-list">
        {list.map((it, i) => {
          const w = (it && (it.word || it.term)) || "";
          const s = it && it.strongs;
          const m = (it && (it.meaning || it.gloss)) || "";
          return (
            <li key={i} className="cx-ws-rel-item">
              <span
                className="cx-ws-rel-word"
                onClick={s ? () => {
                  window.dispatchEvent(new CustomEvent("codex:word-study-open", { detail: { strongs: s, word: w } }));
                } : undefined}
                style={s ? { cursor: "pointer", textDecoration: "underline dotted" } : undefined}
              >
                {w}
              </span>
              {s ? <code className="cx-ws-rel-strongs">{s}</code> : null}
              {m ? <span className="cx-ws-rel-mean">{"— " + m}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function WordStudyPanel(_props: Record<string, unknown>): React.ReactElement {
  const last: LastStudied = lsGet<LastStudied | null>(LS_LAST, null) ?? {};
  const initialVal = last.word || last.strongs || "";
  const [query, setQuery] = useState(initialVal);
  const [inputVal, setInputVal] = useState(initialVal);

  const [freq, setFreq] = useState<FreqState>({ total: 0, byBook: [], hits: [], loading: false });
  const [ai, setAi] = useState<AiState>({ related: null, theology: null, loading: false, err: null });

  // De-dupe set: words for which we've already emitted 'word-study-complete'.
  const studiedRef = useRef<Record<string, boolean>>({});

  // Resolve studied word from query — could be a Strong's # or a word.
  const entry = useMemo<WordEntry | null>(() => {
    const q = (query || "").trim();
    if (!q) return null;
    if (/^[HG]\d+$/i.test(q)) {
      const e = lookup(q.toUpperCase());
      const firstChar = q.charAt(0).toUpperCase();
      const lang: Lang = firstChar === "H" ? "heb" : "grk";
      if (e) return { strongs: q.toUpperCase(), entry: e, word: e.word || q.toUpperCase(), lang };
      return { strongs: q.toUpperCase(), entry: null, word: q.toUpperCase(), lang };
    }
    return { strongs: null, entry: null, word: q, lang: "eng" };
  }, [query]);

  // Persist last-studied
  useEffect(() => {
    if (!query) return;
    lsSet(LS_LAST, { word: entry && entry.word, strongs: entry && entry.strongs });
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Engagement: emit 'word-study-complete' once per resolved study (de-duped
  // per word/Strong's so it fires once, not per render). w5, hebrew-greek.
  useEffect(() => {
    if (!entry || !entry.word) return;
    const key = (entry.strongs || entry.word || "").toString().toLowerCase();
    if (!key) return;
    const seen = studiedRef.current;
    if (seen[key]) return;
    seen[key] = true;
    emitDepth("word-study-complete", entry.strongs || entry.word, 5);
  }, [entry?.word, entry?.strongs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for cross-feature triggers
  useEffect(() => {
    function onWordStudy(ev: Event): void {
      const d = (ev as CustomEvent<{ strongs?: string; word?: string }>).detail || {};
      const next = d.strongs || d.word || "";
      if (next) { setQuery(next); setInputVal(next); }
    }
    function onStrongs(ev: Event): void {
      const d = (ev as CustomEvent<{ strongs?: string }>).detail;
      const s = d && d.strongs;
      if (s) { setQuery(s); setInputVal(s); }
    }
    window.addEventListener("codex:word-study-open", onWordStudy);
    window.addEventListener("codex:strongs-open", onStrongs);
    return () => {
      window.removeEventListener("codex:word-study-open", onWordStudy);
      window.removeEventListener("codex:strongs-open", onStrongs);
    };
  }, []);

  // Frequency lookup whenever the searched word changes
  useEffect(() => {
    if (!entry || !entry.word) { setFreq({ total: 0, byBook: [], hits: [], loading: false }); return; }
    // For Strong's lookups, use the English gloss/translit; pure English uses itself.
    const glossParts = entry.entry?.gloss ? String(entry.entry.gloss).split(/[,;]/) : [];
    const firstGlossPart = glossParts.length > 0 && glossParts[0] !== undefined
      ? glossParts[0].trim()
      : "";
    const probe = firstGlossPart || entry.word;
    if (!probe) return;
    setFreq((f) => ({ total: f.total, byBook: f.byBook, hits: f.hits, loading: true }));
    frequencyFor(probe).then((out) => {
      setFreq({ ...out, loading: false });
    });
  }, [entry?.word, entry?.strongs]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI lookups — only for Strong's-anchored words, cached, only if AI configured
  useEffect(() => {
    setAi({ related: null, theology: null, loading: false, err: null });
    if (!entry || !entry.strongs) return;
    const strongs = entry.strongs;
    const cached = aiCacheGet(strongs);
    if (cached) {
      setAi({ related: cached.related ?? null, theology: cached.theology ?? null, loading: false, err: null });
      return;
    }
    if (!hasAiKey()) return;
    setAi({ related: null, theology: null, loading: true, err: null });
    const w = entry.entry?.word || entry.word;
    const g = entry.entry?.gloss || "";
    Promise.all([
      fetchRelated(strongs, w).catch(() => null),
      fetchTheology(strongs, w, g).catch(() => null),
    ]).then(([related, theology]) => {
      const pack = { related, theology };
      if (pack.related || pack.theology) aiCacheSet(strongs, pack);
      setAi({ related: pack.related ?? null, theology: pack.theology ?? null, loading: false, err: null });
    });
  }, [entry?.strongs]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: React.FormEvent): void {
    if (e && e.preventDefault) e.preventDefault();
    setQuery((inputVal || "").trim());
  }

  const maxBookCount = freq.byBook.reduce((m, b) => Math.max(m, b.count), 0);
  const first5 = (freq.hits || []).slice(0, 5);

  // Build hero block
  const entryData = entry && entry.entry;
  const heroWord = (entryData && entryData.word) || (entry && entry.word) || "";
  const translit = entryData && entryData.translit;
  const gloss = entryData && entryData.gloss;
  const langClass = entry && entry.lang === "heb" ? "cx-ws-hero-heb"
    : entry && entry.lang === "grk" ? "cx-ws-hero-grk"
    : "cx-ws-hero-eng";

  return (
    <div className="cx-ws-panel cx-pane-body">

      {/* Search box */}
      <form className="cx-ws-search" onSubmit={submit}>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Word or Strong's # (e.g. love, G25, H157)"
          aria-label="Word study search"
          className="cx-ws-input"
        />
        <button type="submit" className="cx-ws-go">Study</button>
      </form>

      {!query
        ? (
          <div className="cx-ws-empty">
            <p>{"Search a word above, click a Strong's number, or use the verse menu's "}<b>{"Word Study"}</b>{" action."}</p>
            <p className="cx-muted">{"Try: "}<code>{"G25"}</code>{" (agape), "}<code>{"H157"}</code>{" (ahab), or "}<i>{"love"}</i>{"."}</p>
          </div>
        )
        : (
          <>
            {/* 1. Hero */}
            <section className="cx-ws-section cx-ws-hero">
              <div className={"cx-ws-hero-word " + langClass}>{heroWord}</div>
              {translit ? <div className="cx-ws-hero-translit">{translit}</div> : null}
              <div className="cx-ws-hero-meta">
                {entry && entry.strongs ? <code className="cx-ws-strongs">{entry.strongs}</code> : null}
                {gloss ? <span className="cx-ws-gloss">{gloss}</span> : null}
              </div>
            </section>

            {/* 2. Semantic range */}
            {entryData && entryData.def
              ? (
                <section className="cx-ws-section">
                  <h4 className="cx-ws-h">Semantic range</h4>
                  <ul className="cx-ws-srange">
                    {splitSemanticRange(entryData.def).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </section>
              )
              : null}

            {/* 3. Frequency */}
            <section className="cx-ws-section">
              <h4 className="cx-ws-h">Frequency in your library</h4>
              {freq.loading
                ? <p className="cx-muted">{"Counting…"}</p>
                : freq.total === 0
                  ? <p className="cx-muted">{"No occurrences found yet. Open more chapters to seed the search index."}</p>
                  : (
                    <>
                      <p className="cx-ws-freq-total">
                        <b>{freq.total}</b>
                        {" occurrences across "}
                        <b>{freq.byBook.length}</b>
                        {" book"}{freq.byBook.length === 1 ? "" : "s"}{"."}
                      </p>
                      <ul className="cx-ws-bars">
                        {freq.byBook.slice(0, 18).map((b) => {
                          const pct = maxBookCount ? Math.round((b.count / maxBookCount) * 100) : 0;
                          return (
                            <li key={b.bookId} className="cx-ws-bar-row">
                              <span className="cx-ws-bar-name">{b.name}</span>
                              <span className="cx-ws-bar-track">
                                <span className="cx-ws-bar-fill" style={{ width: pct + "%" }} />
                              </span>
                              <span className="cx-ws-bar-count">{b.count}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )
              }
            </section>

            {/* 4. First occurrences */}
            {first5.length
              ? (
                <section className="cx-ws-section">
                  <h4 className="cx-ws-h">First occurrences</h4>
                  <ul className="cx-ws-occ">
                    {first5.map((h, i) => {
                      const p = parseRef(h.ref || "");
                      const label = bookName(p.bookId) + " " + p.chapter + ":" + p.verse;
                      // snippet comes from search.js _snippet() which HTML-escapes
                      // text before wrapping matches in <mark>. As a safety net,
                      // strip any tags that aren't <mark>.
                      const rawSnip = h.snippet || h.text || "";
                      const snippet = rawSnip.replace(/<(?!\/?mark\b)[^>]+>/gi, "");
                      return (
                        <li
                          key={i}
                          className="cx-ws-occ-item"
                          onClick={() => navigate(p.bookId, p.chapter, p.verse)}
                        >
                          <div className="cx-ws-occ-ref">{label}</div>
                          <div className="cx-ws-occ-snip" dangerouslySetInnerHTML={{ __html: snippet }} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )
              : null}

            {/* 5. Related / synonyms / antonyms (AI) */}
            {entry && entry.strongs
              ? (
                <section className="cx-ws-section">
                  <h4 className="cx-ws-h">Related words</h4>
                  {ai.loading
                    ? <p className="cx-muted">{"Asking the lexicographer…"}</p>
                    : !ai.related
                      ? (
                        <p className="cx-muted">
                          {hasAiKey()
                            ? "No related-words data available."
                            : "Configure an AI engine in Settings to enable related-words discovery."}
                        </p>
                      )
                      : (
                        <div className="cx-ws-related">
                          {renderRelGroup("Related", ai.related.related)}
                          {renderRelGroup("Hebrew counterparts", ai.related.hebrew_counterparts)}
                          {renderRelGroup("Antonyms", ai.related.antonyms)}
                        </div>
                      )
                  }
                </section>
              )
              : null}

            {/* 6. Theology pull */}
            {entry && entry.strongs && (ai.theology || ai.loading)
              ? (
                <section className="cx-ws-section">
                  <h4 className="cx-ws-h">Why it matters</h4>
                  {ai.loading && !ai.theology
                    ? <p className="cx-muted">{"Drafting…"}</p>
                    : <blockquote className="cx-ws-theology">{ai.theology}</blockquote>
                  }
                </section>
              )
              : null}

            {/* 7. Citation chain */}
            {entryData && typeof entryData.usage === "number" && entryData.usage > 50
              ? (
                <section className="cx-ws-section">
                  <h4 className="cx-ws-h">Key passages</h4>
                  <p className="cx-muted cx-ws-cite-note">
                    {"Occurs ~"}{entryData.usage}{" times — a high-frequency lemma. See first occurrences above; full citation chain coming with the expanded lexicon."}
                  </p>
                </section>
              )
              : null}
          </>
        )
      }
    </div>
  );
}
