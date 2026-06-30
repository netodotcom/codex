// search — SearchBar React component (faithful port from legacy/search.js).
// Classic JSX: `import React from "react"` maps to the CDN window.React shim
// in the Vite build; real npm React is used in tests (jsdom).
// window.CODEX_SEARCH is accessed at render-time via sw(), mirroring the
// original IIFE's `window.CODEX_SEARCH.*` calls exactly.
import React, { useState, useEffect, useRef } from "react";
import type { SearchBarProps, SearchResult, ConceptResult, SearchApiError } from "./types.js";
import { sw } from "./search-window.js";

const MODE_KEY = "codex.search.mode";

function _readMode(): "text" | "concept" {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "concept" ? "concept" : "text";
  } catch { return "text"; }
}

function _writeMode(m: "text" | "concept"): void {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
}

export function SearchBar({ open, onClose, onNavigate }: SearchBarProps): React.ReactElement | null {
  const [mode, setMode]                       = useState<"text" | "concept">(_readMode);
  const [q, setQ]                             = useState("");
  const [results, setResults]                 = useState<SearchResult[]>([]);
  const [conceptResults, setConceptResults]   = useState<ConceptResult[]>([]);
  const [conceptStatus, setConceptStatus]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [conceptErr, setConceptErr]           = useState<SearchApiError | null>(null);
  const [conceptFromCache, setConceptFromCache] = useState(false);
  const [sel, setSel]                         = useState(0);
  const [statsState, setStatsState]           = useState<{ verses: number; translations: number } | null>(null);
  const inputRef  = useRef<HTMLInputElement | null>(null);
  const listRef   = useRef<HTMLUListElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    setStatsState(sw().CODEX_SEARCH?.stats?.() ?? null);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQ(""); setResults([]); setConceptResults([]);
      setConceptStatus("idle"); setConceptErr(null); setConceptFromCache(false);
      setSel(0);
    }
  }, [open]);

  useEffect(() => { _writeMode(mode); }, [mode]);

  // TEXT mode live search
  useEffect(() => {
    if (mode !== "text") return;
    let cancelled = false;
    if (!q.trim()) { setResults([]); setSel(0); return; }
    (async () => {
      try {
        const api = sw().CODEX_SEARCH;
        if (!api) return;
        const r = await api.search(q, { limit: 20 });
        if (!cancelled) {
          setResults(r);
          setSel(0);
          setStatsState(api.stats());
        }
      } catch {
        if (!cancelled) setResults([]);
      }
    })();
    return () => { cancelled = true; };
  }, [q, mode]);

  // CONCEPT mode — show cached instantly, debounce live AI fetch
  useEffect(() => {
    if (mode !== "concept") return;
    if (debounceRef.current !== null) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const query = q.trim();
    if (!query) {
      setConceptResults([]); setConceptStatus("idle");
      setConceptErr(null); setConceptFromCache(false); setSel(0);
      return;
    }
    // Try cache instantly
    // NOTE: preserved from legacy — hash function is inlined here verbatim so the
    // SearchBar is self-contained and doesn't import from helpers.ts at runtime.
    let hadCache = false;
    try {
      const lang = sw().codexLangName?.() || "English";
      // NOTE: preserved from legacy — inline hash duplicated from _hashStr in helpers.ts
      const hashStr = (s: string): string => {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36);
      };
      const cacheRaw = localStorage.getItem(
        "codex.search.concept." + hashStr(query.toLowerCase()) + "." + lang,
      );
      if (cacheRaw) {
        const c = JSON.parse(cacheRaw) as { results?: ConceptResult[] } | null;
        if (c && Array.isArray(c.results) && c.results.length) {
          setConceptResults(c.results);
          setConceptStatus("done");
          setConceptFromCache(true);
          setConceptErr(null);
          setSel(0);
          hadCache = true;
        }
      }
    } catch { /* ignore */ }

    debounceRef.current = setTimeout(async () => {
      if (!hadCache) {
        setConceptStatus("loading");
        setConceptErr(null);
      }
      try {
        const api = sw().CODEX_SEARCH;
        if (!api) return;
        const { results: res, fromCache: fc } = await api.searchSemantic(query);
        setConceptResults(res ?? []);
        setConceptStatus("done");
        setConceptFromCache(!!fc);
        setSel(0);
      } catch (rawErr) {
        if (!hadCache) {
          setConceptStatus("error");
          setConceptErr(rawErr as SearchApiError);
        }
      }
    }, 600);

    return () => { if (debounceRef.current !== null) clearTimeout(debounceRef.current); };
  }, [q, mode]);

  function pickText(r: SearchResult): void {
    if (!r) return;
    const p = r.pretty;
    onNavigate?.(p.bookId, p.chapter, p.verse);
    onClose?.();
  }

  function pickConcept(r: ConceptResult): void {
    if (!r) return;
    const bookId = r.bookId;
    if (bookId) {
      onNavigate?.(bookId, r.chapter, r.verse);
    }
    onClose?.();
  }

  function activeList(): SearchResult[] | ConceptResult[] {
    return mode === "concept" ? conceptResults : results;
  }

  function pickActive(i: number): void {
    const list = activeList();
    const r = list[i];
    if (!r) return;
    if (mode === "concept") pickConcept(r as ConceptResult);
    else pickText(r as SearchResult);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
    const list = activeList();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel(s => Math.min(list.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel(s => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "concept") {
        // Force immediate fetch (cancel debounce)
        if (debounceRef.current !== null) { clearTimeout(debounceRef.current); debounceRef.current = null; }
        if (conceptStatus === "loading" || !q.trim()) return;
        if (list.length && conceptStatus === "done") {
          pickActive(sel);
        } else {
          // Trigger an immediate semantic fetch
          (async () => {
            setConceptStatus("loading"); setConceptErr(null);
            try {
              const api = sw().CODEX_SEARCH;
              if (!api) return;
              const { results: res, fromCache: fc } = await api.searchSemantic(q.trim());
              setConceptResults(res ?? []);
              setConceptStatus("done");
              setConceptFromCache(!!fc);
              setSel(0);
            } catch (rawErr) {
              setConceptStatus("error");
              setConceptErr(rawErr as SearchApiError);
            }
          })();
        }
      } else {
        pickActive(sel);
      }
    }
  }

  useEffect(() => {
    // Scroll selected into view
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  function renderModeTabs(): React.ReactElement {
    return (
      <div className="cx-search-modes" role="tablist">
        {(["text", "concept"] as const).map(m => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={"cx-search-mode-tab" + (mode === m ? " is-active" : "")}
            onClick={() => { setMode(m); setSel(0); inputRef.current?.focus(); }}
          >
            {m === "text" ? "TEXT" : "CONCEPT"}
          </button>
        ))}
      </div>
    );
  }

  function renderDots(score: number): React.ReactElement {
    const filled = Math.max(0, Math.min(5, Math.round((score || 0) * 5)));
    const arr: React.ReactElement[] = [];
    for (let i = 0; i < 5; i++) {
      arr.push(
        <span key={i} className={"cx-search-dot" + (i < filled ? " is-on" : "")} />,
      );
    }
    return <span className="cx-search-dots" aria-label={`relevance ${filled}/5`}>{...arr}</span>;
  }

  function renderConceptResults(): React.ReactElement | null {
    if (conceptStatus === "loading") {
      return (
        <ul className="cx-search-results cx-search-concept-list" aria-busy="true">
          {[0, 1, 2, 3, 4].map(i => (
            <li key={i} className="cx-search-row cx-search-skel">
              <div className="cx-search-skel-line cx-search-skel-ref" />
              <div className="cx-search-skel-line cx-search-skel-text" />
              <div className="cx-search-skel-line cx-search-skel-why" />
            </li>
          ))}
        </ul>
      );
    }
    if (conceptStatus === "error") {
      const kind = conceptErr?.kind;
      let msg: string;
      if (kind === "auth") {
        msg = "Concept search needs an AI key. Add one in Settings → AI Engines. Switch to TEXT for offline keyword search.";
      } else if (kind === "network") {
        msg = "Network error, try again. Switch to TEXT for offline keyword search.";
      } else {
        msg = (conceptErr?.message ?? "Concept search failed.") + " Switch to TEXT for offline keyword search.";
      }
      return <div className="cx-search-empty cx-search-concept-err">{msg}</div>;
    }
    if (conceptStatus === "done" && conceptResults.length === 0 && q.trim()) {
      return <div className="cx-search-empty">No concept matches. Try rephrasing.</div>;
    }
    if (!conceptResults.length) return null;
    return (
      <ul className="cx-search-results cx-search-concept-list" ref={listRef} role="listbox">
        {conceptResults.map((r, i) => (
          <li
            key={r.ref + "|" + i}
            data-idx={i}
            className={
              "cx-search-row cx-search-concept-row" +
              (i === sel ? " is-sel" : "") +
              (r.bookId ? "" : " is-unjumpable")
            }
            role="option"
            aria-selected={i === sel}
            onMouseEnter={() => setSel(i)}
            onClick={() => pickConcept(r)}
            title={r.bookId ? "" : "Reference could not be resolved to a book id"}
          >
            <div className="cx-search-concept-head">
              <b className="cx-search-concept-ref">{r.ref}</b>
              {renderDots(r.score)}
            </div>
            {r.text ? <div className="cx-search-concept-text">{r.text}</div> : null}
            {r.relevance ? <div className="cx-search-concept-why">{r.relevance}</div> : null}
          </li>
        ))}
      </ul>
    );
  }

  const placeholder = mode === "concept"
    ? "Find passages about… (e.g. 'forgiveness', 'shepherd metaphors', 'words of Jesus on prayer')"
    : "search scripture · \"phrase\" · lov* · @KJV love";

  let footText: string;
  if (mode === "concept") {
    if (conceptStatus === "loading")                          footText = "asking the engine…";
    else if (conceptStatus === "done" && conceptFromCache)    footText = "concept · cached · offline";
    else if (conceptStatus === "done")                        footText = `concept · ${conceptResults.length} result${conceptResults.length === 1 ? "" : "s"}`;
    else if (conceptStatus === "error")                       footText = "concept · error";
    else                                                       footText = "concept · powered by AI";
  } else {
    footText = statsState
      ? `${statsState.verses.toLocaleString()} verses · ${statsState.translations} translation${statsState.translations === 1 ? "" : "s"} · offline`
      : "indexing…";
  }

  return (
    <div
      className="cx-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Scripture search"
      onClick={() => onClose?.()}
    >
      <div className="cx-search-modal" onClick={(e) => e.stopPropagation()}>
        {renderModeTabs()}
        <div className="cx-search-bar">
          <span className="cx-search-prompt">{mode === "concept" ? "✦" : "›"}</span>
          <input
            ref={inputRef}
            className="cx-search-input"
            type="search"
            autoFocus
            spellCheck={false}
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            data-cx-search="1"
          />
          <span className="cx-search-kbd">ESC</span>
        </div>
        {mode === "text"
          ? (q.trim() && results.length === 0
              ? <div className="cx-search-empty">No matches. Try fewer or different words.</div>
              : results.length
                ? (
                  <ul className="cx-search-results" ref={listRef} role="listbox">
                    {results.map((r, i) => (
                      <li
                        key={r.ref + "|" + r.translation}
                        data-idx={i}
                        className={"cx-search-row" + (i === sel ? " is-sel" : "")}
                        role="option"
                        aria-selected={i === sel}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => pickText(r)}
                      >
                        <div className="cx-search-ref">
                          <span className="cx-search-trans">{`[${r.translation.toUpperCase()}]`}</span>
                          {" "}
                          <b>{r.pretty.label}</b>
                        </div>
                        <div
                          className="cx-search-snippet"
                          dangerouslySetInnerHTML={{ __html: r.snippet }}
                        />
                      </li>
                    ))}
                  </ul>
                )
                : null
            )
          : renderConceptResults()
        }
        <div className="cx-search-foot">
          {footText}
          <span className="cx-search-hint">↑↓ navigate · ↵ open · esc close</span>
        </div>
      </div>
    </div>
  );
}
