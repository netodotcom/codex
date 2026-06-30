// help — CODEX Help Wiki (migrated verbatim from help.jsx). Searchable,
// AI-augmented, multilingual documentation that lives inside the Settings/Tweaks
// panel. Modes: Browse (category cards + accordion), predictive search (top 5),
// Ask Oracle (POST /api/chat with the whole corpus), and on-demand Translate.
// Visual layer (serif hero, drop-caps, numbered sections, copy code blocks,
// scroll-progress, related/prev-next) is owned by styles.css "Help Wiki — Beauty
// Pass" — this component injects NO CSS of its own.
import React from "react";
import {
  SUPPORTED_LANGS,
  catMeta,
  currentUiLang,
  type Article,
  type ArticlesDoc,
} from "./data.js";
import { readTrCache, writeTrCache, cachedLangsFor } from "./tr-cache.js";
import { renderMarkdown, makeSnippet } from "./markdown.js";
import { scoreArticle } from "./search.js";
import { translateArticle } from "./translate.js";

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Mirror the legacy `e.message || String(e)` for unknown caught values.
function errMsg(e: unknown): string {
  return (e instanceof Error && e.message) ? e.message : String(e);
}

interface OracleState {
  loading: boolean;
  text?: string;
  error?: string;
}
interface TrState {
  loading: boolean;
  body?: string;
  title?: string | null;
  error?: string;
}

// ── Skeleton shimmer used during fetch + AI translation ───────────────────
function Skeleton({ rows = 5 }: { rows?: number }): React.ReactElement {
  const out: React.ReactElement[] = [];
  for (let i = 0; i < rows; i++) {
    const w = 60 + ((i * 17) % 35);
    out.push(<div key={i} className="cx-help-skel-line" style={{ width: `${w}%` }} />);
  }
  return <div className="cx-help-skel" aria-hidden="true">{out}</div>;
}

// ── Main component ─────────────────────────────────────────────────────────
export function HelpWiki(): React.ReactElement {
  const [articles, setArticles] = useState<ArticlesDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [oracleAnswer, setOracleAnswer] = useState<OracleState | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [browseMode, setBrowseMode] = useState<"cards" | "list">("cards"); // cards | list
  const [scrollPct, setScrollPct] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const articleScrollRef = useRef<HTMLDivElement | null>(null);
  const articleBodyRef = useRef<HTMLElement | null>(null);

  const [currentLang, setCurrentLang] = useState<string | null>(null);
  const [tr, setTr] = useState<TrState | null>(null);
  const [trMenuOpen, setTrMenuOpen] = useState(false);
  const autoTriedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("data/help/articles.json", { cache: "default" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json() as ArticlesDoc;
        if (!cancelled) {
          setArticles(j);
          const open: Record<string, boolean> = {};
          for (const c of (j.categories || [])) open[c] = true;
          setOpenCategories(open);
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const all: Article[] = articles?.articles || [];
  const byId = useMemo(() => {
    const m = new Map<string, Article>();
    for (const a of all) m.set(a.id, a);
    return m;
  }, [all]);

  const predictive = useMemo<Article[]>(() => {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    return all
      .map((a) => ({ a, s: scoreArticle(a, q) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 5)
      .map((x) => x.a);
  }, [query, all]);

  const askOracle = useCallback(async (): Promise<void> => {
    const q = query.trim();
    if (!q || !articles) return;
    setOracleAnswer({ loading: true });
    const corpus = (articles.articles || []).map((a) => ({
      id: a.id, title: a.title, category: a.category, tags: a.tags, body: a.body,
    }));
    const system = "You are the CODEX Help assistant. Answer the user's question ONLY using the help corpus provided. If the answer isn't in the corpus, say so plainly and suggest the closest related article by title. Keep answers concise (2–6 short paragraphs or a short list). Use markdown (headings, bold, lists, code spans). When you reference an article, cite it as **Article Title** in bold. Do not invent features.";
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          system,
          messages: [{
            role: "user",
            content: `Question: ${q}\n\n--- CODEX HELP CORPUS (JSON) ---\n${JSON.stringify(corpus)}`,
          }],
          max_tokens: 800,
        }),
      });
      const data = await r.json() as { text?: string; error?: string };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setOracleAnswer({ loading: false, text: (data.text || "").trim() || "(Oracle returned an empty answer.)" });
    } catch (e) {
      setOracleAnswer({ loading: false, error: errMsg(e) });
    }
  }, [query, articles]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      const top = predictive[0];
      if (top) {
        // Enter always opens the top match if there is one — faster, less surprising.
        setSelectedId(top.id);
      } else if (query.trim()) {
        askOracle();
      }
    } else if (e.key === "Escape" && selectedId) {
      e.preventDefault();
      setSelectedId(null);
    }
  };

  useEffect(() => {
    setCurrentLang(null);
    setTr(null);
    setTrMenuOpen(false);
    setScrollPct(0);
    // Scroll the article container to top when navigating.
    if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
  }, [selectedId]);

  const doTranslate = useCallback(async (article: Article, langCode: string): Promise<void> => {
    if (!article || !langCode) return;
    setCurrentLang(langCode);
    const cached = readTrCache(article.id, langCode);
    if (cached) {
      setTr({ loading: false, body: cached.body, title: cached.title });
      return;
    }
    setTr({ loading: true });
    try {
      const { body, title } = await translateArticle(article, langCode);
      writeTrCache(article.id, langCode, body, title);
      setTr({ loading: false, body, title });
    } catch (e) {
      setTr({ loading: false, error: errMsg(e) });
    }
  }, []);

  const selected: Article | null = selectedId ? (byId.get(selectedId) ?? null) : null;
  useEffect(() => {
    if (!selected) return;
    if (autoTriedRef.current[selected.id]) return;
    const ui = currentUiLang();
    if (!ui || ui === "en") return;
    if (!SUPPORTED_LANGS.some((l) => l.code === ui)) return;
    autoTriedRef.current[selected.id] = true;
    doTranslate(selected, ui);
  }, [selected, doTranslate]);

  // Article scroll progress.
  useEffect(() => {
    const el = articleScrollRef.current;
    if (!el || !selected) return;
    const onScroll = (): void => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0;
      setScrollPct(pct);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [selected, tr]);

  // Wire up copy-to-clipboard on code blocks after each render.
  useEffect(() => {
    const root = articleBodyRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent): void => {
      const btn = (e.target as Element | null)?.closest(".cx-help-code-copy");
      if (!btn) return;
      const txt = btn.getAttribute("data-copy") || "";
      try {
        navigator.clipboard?.writeText(txt);
        const old = btn.textContent;
        btn.textContent = "✓ copied";
        btn.classList.add("is-ok");
        setTimeout(() => { btn.textContent = old; btn.classList.remove("is-ok"); }, 1400);
      } catch {
        /* ignore */
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [selected, tr]);

  // Prev/next within category.
  const categoryPeers = useMemo<{ prev: Article | null; next: Article | null }>(() => {
    if (!selected) return { prev: null, next: null };
    const peers = all.filter((a) => a.category === selected.category);
    const idx = peers.findIndex((a) => a.id === selected.id);
    return {
      prev: idx > 0 ? (peers[idx - 1] ?? null) : null,
      next: idx >= 0 && idx < peers.length - 1 ? (peers[idx + 1] ?? null) : null,
    };
  }, [selected, all]);

  // Related: same category, ≥1 shared tag, score by overlap.
  const related = useMemo<Article[]>(() => {
    if (!selected) return [];
    const myTags = new Set<string>(selected.tags || []);
    return all
      .filter((a) => a.id !== selected.id && a.category === selected.category)
      .map((a) => {
        let overlap = 0;
        for (const t of (a.tags || [])) if (myTags.has(t)) overlap++;
        return { a, overlap };
      })
      .filter((x) => x.overlap >= 1)
      .sort((x, y) => y.overlap - x.overlap)
      .slice(0, 4)
      .map((x) => x.a);
  }, [selected, all]);

  // ── Renders ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="cx-help">
        <div className="cx-help-error">Could not load help articles: {error}</div>
      </div>
    );
  }
  if (!articles) {
    return (
      <div className="cx-help">
        <div className="cx-help-head">
          <div className="cx-help-title">HELP &amp; DOCS</div>
          <div className="cx-help-sub">Loading manual…</div>
        </div>
        <Skeleton rows={8} />
      </div>
    );
  }

  // ── Selected article view ─────────────────────────────────────────────
  if (selected) {
    const showingTranslated = !!(currentLang && tr && !tr.loading && !tr.error && tr.body);
    const displayTitle = showingTranslated && tr && tr.title ? tr.title : selected.title;
    const displayBody  = showingTranslated && tr ? tr.body : selected.body;
    const activeLangLabel = currentLang
      ? (SUPPORTED_LANGS.find((l) => l.code === currentLang)?.label || currentLang)
      : null;
    const lastUpdated = selected.lastUpdated || articles.updated;
    const icon = catMeta(selected.category).icon;

    return (
      <div className="cx-help cx-help-reading">
        {/* Scroll progress strip */}
        <div className="cx-help-progress" aria-hidden="true">
          <div className="cx-help-progress-bar" style={{ width: `${scrollPct}%` }} />
        </div>

        <div className="cx-help-bar">
          <button className="cx-help-back" onClick={() => setSelectedId(null)} aria-label="Back to help index">
            ← BACK
          </button>
          <div className="cx-help-nav-pair" aria-label="Walk through category">
            <button
              className="cx-help-nav-btn"
              disabled={!categoryPeers.prev}
              onClick={() => categoryPeers.prev && setSelectedId(categoryPeers.prev.id)}
              title={categoryPeers.prev ? `Previous: ${categoryPeers.prev.title}` : "No previous"}
            >← prev</button>
            <span className="cx-help-nav-sep">·</span>
            <button
              className="cx-help-nav-btn"
              disabled={!categoryPeers.next}
              onClick={() => categoryPeers.next && setSelectedId(categoryPeers.next.id)}
              title={categoryPeers.next ? `Next: ${categoryPeers.next.title}` : "No next"}
            >next →</button>
          </div>
          <div className="cx-help-trans-wrap">
            <button
              className="cx-help-trans-toggle"
              onClick={() => setTrMenuOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={trMenuOpen}
              title="Translate this article"
            >
              {currentLang
                ? `🌐 ${activeLangLabel} ▾`
                : "🌐 Translate ▾"}
            </button>
            {trMenuOpen && (
              <ul className="cx-help-trans-menu" role="listbox">
                <li>
                  <button
                    className="cx-help-trans-item"
                    onClick={() => {
                      setCurrentLang(null);
                      setTr(null);
                      setTrMenuOpen(false);
                    }}
                  >
                    English (original)
                  </button>
                </li>
                {SUPPORTED_LANGS.map((l) => {
                  const cached = !!readTrCache(selected.id, l.code);
                  return (
                    <li key={l.code}>
                      <button
                        className={`cx-help-trans-item ${currentLang === l.code ? "is-active" : ""}`}
                        onClick={() => {
                          setTrMenuOpen(false);
                          doTranslate(selected, l.code);
                        }}
                      >
                        <span>{l.label}</span>
                        {cached && <span className="cx-help-trans-cached" title="Cached locally">●</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {currentLang && (
          <div className="cx-help-trans-badge">
            {tr && tr.loading ? null : (
              tr && tr.error ? (
                <span className="cx-help-trans-err">
                  Translation failed — {tr.error}.{" "}
                  <button className="cx-help-trans-link" onClick={() => doTranslate(selected, currentLang)}>retry</button>
                </span>
              ) : (
                <span>
                  🌐 Translated by AI ·{" "}
                  <button
                    className="cx-help-trans-link"
                    onClick={() => { setCurrentLang(null); setTr(null); }}
                  >view original</button>
                </span>
              )
            )}
          </div>
        )}

        <div className="cx-help-scroll" ref={articleScrollRef}>
          {/* Hero title block */}
          <header className="cx-help-hero">
            <div className="cx-help-hero-meta">
              <span className="cx-help-hero-cat">
                <span className="cx-help-hero-icon" aria-hidden="true">{icon}</span>
                {selected.category}
              </span>
              <span className="cx-help-hero-dot">·</span>
              <span className="cx-help-hero-date">Updated {lastUpdated}</span>
            </div>
            <h1 className="cx-help-hero-title">{displayTitle}</h1>
            <div className="cx-help-hero-rule" aria-hidden="true" />
          </header>

          {tr && tr.loading ? (
            <div className="cx-help-trans-loading">
              <Skeleton rows={6} />
              <div className="cx-help-trans-loading-label">Translating…</div>
            </div>
          ) : (
            <article
              className="cx-help-article cx-help-article-pretty"
              ref={articleBodyRef}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(displayBody) }}
            />
          )}

          {selected.tags && selected.tags.length > 0 && (
            <div className="cx-help-tags">
              {selected.tags.map((t) => <span key={t} className="cx-help-tag">#{t}</span>)}
            </div>
          )}

          {related.length > 0 && (
            <div className="cx-help-related">
              <div className="cx-help-related-head">RELATED IN {selected.category.toUpperCase()}</div>
              <div className="cx-help-related-grid">
                {related.map((r) => (
                  <button key={r.id} className="cx-help-related-card" onClick={() => setSelectedId(r.id)}>
                    <div className="cx-help-related-title">{r.title}</div>
                    <div className="cx-help-related-tags">{(r.tags || []).slice(0, 3).join(" · ")}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="cx-help-foot-nav">
            {categoryPeers.prev && (
              <button className="cx-help-foot-nav-btn is-prev" onClick={() => categoryPeers.prev && setSelectedId(categoryPeers.prev.id)}>
                <span className="cx-help-foot-nav-dir">← previous</span>
                <span className="cx-help-foot-nav-title">{categoryPeers.prev.title}</span>
              </button>
            )}
            {categoryPeers.next && (
              <button className="cx-help-foot-nav-btn is-next" onClick={() => categoryPeers.next && setSelectedId(categoryPeers.next.id)}>
                <span className="cx-help-foot-nav-dir">next →</span>
                <span className="cx-help-foot-nav-title">{categoryPeers.next.title}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Index view ─────────────────────────────────────────────────────────
  const byCategory: Record<string, Article[]> = {};
  for (const c of (articles.categories || [])) byCategory[c] = [];
  for (const a of all) {
    let arr = byCategory[a.category];
    if (!arr) { arr = []; byCategory[a.category] = arr; }
    arr.push(a);
  }

  const showCards = !query.trim() && browseMode === "cards";

  return (
    <div className="cx-help">
      <div className="cx-help-head cx-help-head-pretty">
        <div className="cx-help-eyebrow">CODEX MANUAL · v{articles.version} · {articles.updated}</div>
        <div className="cx-help-title-pretty">Help &amp; Reference</div>
        <div className="cx-help-sub">A small library of articles — searchable, askable, translatable.</div>
      </div>

      <div className="cx-help-search-wrap cx-help-search-wrap-pretty">
        <span className="cx-help-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={searchRef}
          className="cx-help-search"
          type="text"
          placeholder="Search articles, or ask a question…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOracleAnswer(null); }}
          onKeyDown={onSearchKey}
          spellCheck={false}
        />
        <button
          className="cx-help-ask cx-help-ask-pretty"
          onClick={askOracle}
          disabled={!query.trim() || (!!oracleAnswer && oracleAnswer.loading)}
          title="Ask Oracle to answer using the help corpus"
        >
          {oracleAnswer && oracleAnswer.loading ? "ASKING…" : "✦ ASK ORACLE"}
        </button>
      </div>

      {predictive.length > 0 && (
        <ul className="cx-help-predict cx-help-predict-pretty" role="listbox" aria-label="Matching articles">
          {predictive.map((a, i) => (
            <li key={a.id}>
              <button className="cx-help-predict-row cx-help-predict-row-pretty" onClick={() => setSelectedId(a.id)}>
                <div className="cx-help-predict-main">
                  <span className="cx-help-predict-title">{a.title}</span>
                  <span className="cx-help-badge cx-help-badge-sm">{a.category}</span>
                </div>
                <div
                  className="cx-help-predict-snippet"
                  dangerouslySetInnerHTML={{ __html: makeSnippet(a.body, query.trim()) }}
                />
                <div className="cx-help-predict-hint">{i === 0 ? "press ↵" : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {oracleAnswer && oracleAnswer.loading && (
        <div className="cx-help-oracle">
          <div className="cx-help-oracle-head">
            <span className="cx-help-badge cx-help-badge-accent">ORACLE</span>
          </div>
          <Skeleton rows={4} />
        </div>
      )}
      {oracleAnswer && !oracleAnswer.loading && (oracleAnswer.text || oracleAnswer.error) && (
        <div className={`cx-help-oracle ${oracleAnswer.error ? "is-error" : ""}`}>
          <div className="cx-help-oracle-head">
            <span className="cx-help-badge cx-help-badge-accent">ORACLE</span>
            <button className="cx-help-oracle-x" onClick={() => setOracleAnswer(null)} aria-label="Dismiss Oracle answer">✕</button>
          </div>
          {oracleAnswer.error
            ? <div className="cx-help-oracle-body">Sorry — {oracleAnswer.error}</div>
            : <div className="cx-help-oracle-body"
                   dangerouslySetInnerHTML={{ __html: renderMarkdown(oracleAnswer.text) }} />}
        </div>
      )}

      {!query.trim() && (
        <div className="cx-help-mode-toggle" role="tablist" aria-label="Browse mode">
          <button
            role="tab"
            aria-selected={browseMode === "cards"}
            className={`cx-help-mode-btn ${browseMode === "cards" ? "is-active" : ""}`}
            onClick={() => setBrowseMode("cards")}
          >▦ Categories</button>
          <button
            role="tab"
            aria-selected={browseMode === "list"}
            className={`cx-help-mode-btn ${browseMode === "list" ? "is-active" : ""}`}
            onClick={() => setBrowseMode("list")}
          >☰ All articles</button>
        </div>
      )}

      {showCards ? (
        <div className="cx-help-catgrid">
          {(articles.categories || []).map((cat) => {
            const list = byCategory[cat] || [];
            if (!list.length) return null;
            const meta = catMeta(cat);
            return (
              <button
                key={cat}
                className="cx-help-catcard"
                onClick={() => { setBrowseMode("list"); setOpenCategories((s) => ({ ...Object.fromEntries(Object.keys(s).map((k) => [k, false] as const)), [cat]: true })); }}
              >
                <div className="cx-help-catcard-icon" aria-hidden="true">{meta.icon}</div>
                <div className="cx-help-catcard-name">{cat}</div>
                <div className="cx-help-catcard-blurb">{meta.blurb}</div>
                <div className="cx-help-catcard-count">{list.length} {list.length === 1 ? "article" : "articles"} →</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="cx-help-browse">
          {(articles.categories || []).map((cat) => {
            const list = byCategory[cat] || [];
            if (!list.length) return null;
            const open = openCategories[cat];
            const meta = catMeta(cat);
            return (
              <section key={cat} className="cx-help-cat">
                <button
                  className="cx-help-cat-head cx-help-cat-head-pretty"
                  onClick={() => setOpenCategories((s) => ({ ...s, [cat]: !s[cat] }))}
                  aria-expanded={open}
                >
                  <span className="cx-help-cat-caret">{open ? "▾" : "▸"}</span>
                  <span className="cx-help-cat-icon" aria-hidden="true">{meta.icon}</span>
                  <span className="cx-help-cat-name">{cat}</span>
                  <span className="cx-help-cat-count">{list.length}</span>
                </button>
                {open && (
                  <ul className="cx-help-cat-list">
                    {list.map((a) => {
                      const cached = cachedLangsFor(a.id);
                      return (
                        <li key={a.id}>
                          <button className="cx-help-row cx-help-row-pretty" onClick={() => setSelectedId(a.id)}>
                            <span className="cx-help-row-title">{a.title}</span>
                            {cached.length > 0 && (
                              <span className="cx-help-row-langs" title={`Translated to: ${cached.join(", ")}`}>
                                🌐 {cached.length}
                              </span>
                            )}
                            {a.tags && a.tags.length > 0 && (
                              <span className="cx-help-row-tags">{a.tags.slice(0, 3).join(" · ")}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="cx-help-foot">
        Press <kbd>↵</kbd> to open the top match · <kbd>Esc</kbd> to back out · click <kbd>✦ ASK ORACLE</kbd> for free-form questions
      </div>
    </div>
  );
}
