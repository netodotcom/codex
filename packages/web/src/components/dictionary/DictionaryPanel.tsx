// dictionary — React panel component (migrated faithfully from dictionary.jsx).
// All styling is inline (the original was self-contained to avoid CSS collisions).
// No self-injected <style> tag — hasCss = false.
import React from "react";
import {
  loadDict,
  kindLabel,
  kindColor,
  entryMatchesQuery,
  dictPicksForChapter,
  formatRef,
  navigateToRef,
} from "./helpers.js";
import type { DictModule, DictEntry } from "./helpers.js";

export interface DictionaryPanelProps {
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

// ── Styles (inline so no CSS dependency) ──────────────────────────────
const paneStyle: React.CSSProperties = {
  padding: "10px 12px 14px",
  color: "var(--cx-fg, #c9d4dc)",
  fontFamily: "var(--cx-font-ui, ui-sans-serif, system-ui)",
  fontSize: 13,
  lineHeight: 1.5,
};
const headerStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
  paddingBottom: 8,
  marginBottom: 10,
};
const titleRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const partialPillStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 10,
  padding: "2px 6px",
  border: "1px solid var(--cx-warn, #ffc46b)",
  color: "var(--cx-warn, #ffc46b)",
  borderRadius: 3,
  letterSpacing: "0.08em",
};
const searchStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--cx-bg-2, rgba(255,255,255,0.04))",
  color: "var(--cx-fg, #c9d4dc)",
  border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  borderRadius: 3,
  outline: "none",
};
const letterBarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 2,
  marginTop: 8,
  fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
};
const letterBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid transparent",
  padding: "1px 5px",
  fontSize: 11,
  fontFamily: "inherit",
  borderRadius: 2,
  minWidth: 18,
};
const sectionHStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  opacity: 0.7,
  margin: "0 0 4px",
  fontWeight: 600,
};
const statusStyle: React.CSSProperties = { padding: "16px 4px", opacity: 0.8 };
const listStyle: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const resultRowStyle: React.CSSProperties = {
  padding: "4px 0",
  borderBottom: "1px dotted var(--cx-rule, rgba(255,255,255,0.06))",
};
const resultBtnStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: 0,
  color: "var(--cx-fg, #c9d4dc)",
  padding: "4px 2px",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
};
const wikiLinkStyle: React.CSSProperties = {
  color: "var(--cx-accent, #7ee0ff)",
  textDecoration: "underline",
  fontSize: 12,
};
const picksStripStyle: React.CSSProperties = {
  marginBottom: 12,
  paddingBottom: 10,
  borderBottom: "1px dashed var(--cx-rule, rgba(126,224,255,0.18))",
};
const picksHStyle: React.CSSProperties = {
  ...sectionHStyle,
  marginBottom: 6,
};
const picksRowStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const pickCardStyle: React.CSSProperties = {
  background: "var(--cx-bg-2, rgba(126,224,255,0.06))",
  border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
  color: "var(--cx-fg, #c9d4dc)",
  padding: "6px 9px",
  cursor: "pointer",
  borderRadius: 3,
  fontFamily: "inherit",
  textAlign: "left",
  minWidth: 90,
};
const entryStyle: React.CSSProperties = { marginTop: 4 };
const entryTitleStyle: React.CSSProperties = {
  fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', 'Cardo', serif)",
  fontSize: 26,
  fontWeight: 600,
  margin: "4px 0 4px",
  lineHeight: 1.15,
};
const kindBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  letterSpacing: "0.14em",
  padding: "1px 6px",
  border: "1px solid",
  borderRadius: 2,
  marginBottom: 10,
};
const entryBodyStyle: React.CSSProperties = {
  fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', 'Cardo', serif)",
  fontSize: 15,
  lineHeight: 1.6,
  color: "var(--cx-fg, #c9d4dc)",
};
const pullQuoteStyle: React.CSSProperties = {
  margin: "10px 0 10px 8px",
  paddingLeft: 12,
  borderLeft: "3px solid var(--cx-accent, #7ee0ff)",
  fontStyle: "italic",
  color: "var(--cx-fg, #c9d4dc)",
};
const pullCiteStyle: React.CSSProperties = {
  fontStyle: "normal",
  fontSize: "0.85em",
  opacity: 0.7,
  fontFamily: "var(--cx-font-mono, ui-monospace, monospace)",
};
const chipRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4 };
const refChipStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--cx-rule, rgba(126,224,255,0.3))",
  color: "var(--cx-accent, #7ee0ff)",
  padding: "2px 7px",
  fontSize: 11,
  fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
  cursor: "pointer",
  borderRadius: 2,
};
const relChipStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--cx-rule, rgba(200,168,255,0.4))",
  color: "#c8a8ff",
  padding: "2px 7px",
  fontSize: 11,
  fontFamily: "inherit",
  borderRadius: 2,
};
const backBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--cx-rule, rgba(126,224,255,0.25))",
  color: "var(--cx-fg, #c9d4dc)",
  padding: "1px 7px",
  fontSize: 11,
  cursor: "pointer",
  borderRadius: 3,
  fontFamily: "inherit",
};
const footStyle: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 8,
  borderTop: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
  fontSize: 10,
  opacity: 0.55,
  letterSpacing: "0.04em",
};

// ── renderBody ────────────────────────────────────────────────────────────
// Render dictionary body. Italicize scripture-reference-looking citations
// (e.g. "Gen. 12:1") and pull-quote any sentence that contains one,
// matching the Easton-as-pull-quote aesthetic.
function renderBody(body: string | undefined | null): React.ReactNode | null {
  if (!body) return null;
  const text = String(body);
  // Split into sentences (rough).
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
  return parts.map((s, i) => {
    // Detect quoted scripture (text enclosed in 'single quotes')
    const m = s.match(/'([^']{8,})'\s*\(([^)]*\d[^)]*)\)/);
    if (m && m.index !== undefined) {
      const before = s.slice(0, m.index);
      const quote = m[1] ?? "";
      const cite = m[2] ?? "";
      const fullMatch = m[0] ?? "";
      const after = s.slice(m.index + fullMatch.length);
      return (
        <React.Fragment key={i}>
          {before}
          <blockquote style={pullQuoteStyle}>
            "{quote}" <span style={pullCiteStyle}>— {cite}</span>
          </blockquote>
          {after && <span>{after} </span>}
        </React.Fragment>
      );
    }
    return <span key={i}>{s} </span>;
  });
}

// ── Panel ─────────────────────────────────────────────────────────────────
export function DictionaryPanel(props: DictionaryPanelProps): React.ReactElement {
  const { bookId, chapter, translation } = props;
  const [mod, setMod] = React.useState<DictModule | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [query, setQuery] = React.useState("");
  const [letter, setLetter] = React.useState<string | null>(null);
  // Navigation trail of entry keys; top of stack = currently displayed entry.
  const [trail, setTrail] = React.useState<string[]>([]);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDict().then(
      (m) => { if (!cancelled) { setMod(m); setLoading(false); } },
      (e: unknown) => { if (!cancelled) { setErr((e instanceof Error ? e.message : String(e))); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, []);

  // Listen for verse-menu "Look up in Dictionary" event to auto-search.
  React.useEffect(() => {
    function onDictOpen(ev: Event): void {
      const ce = ev as CustomEvent<{ text?: string }>;
      const t = ce.detail && (ce.detail.text || "");
      if (!t) return;
      // Find the first capitalized word and use as query.
      const tok = String(t).match(/\b[A-Z][a-z]{2,}\b/);
      if (tok) {
        setQuery(tok[0] ?? "");
        setTrail([]);
        setLetter(null);
        if (searchRef.current) searchRef.current.focus();
      }
    }
    window.addEventListener("codex:dict-open", onDictOpen);
    return () => window.removeEventListener("codex:dict-open", onDictOpen);
  }, []);

  const entries: Record<string, DictEntry> = mod?.entries ?? {};
  const allKeys = React.useMemo(() => Object.keys(entries).sort((a, b) => {
    return (entries[a]?.title || a).localeCompare(entries[b]?.title || b);
  }), [entries]);

  const letters = React.useMemo(() => {
    const s = new Set<string>();
    for (const k of allKeys) {
      const entry = entries[k];
      const t = entry?.title || k;
      s.add(t.charAt(0).toUpperCase());
    }
    return [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((l) => s.has(l));
  }, [allKeys, entries]);

  const searchResults = React.useMemo(() => {
    if (!query.trim()) return [];
    const scored: [string, number][] = [];
    for (const k of allKeys) {
      const entry = entries[k];
      if (!entry) continue;
      const s = entryMatchesQuery(k, entry, query.trim());
      if (s > 0) scored.push([k, s]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, 5).map((x) => x[0]);
  }, [query, allKeys, entries]);

  const letterEntries = React.useMemo(() => {
    if (!letter) return [];
    return allKeys.filter((k) => (entries[k]?.title || k).charAt(0).toUpperCase() === letter);
  }, [letter, allKeys, entries]);

  const picks = React.useMemo(() => {
    if (!mod || !bookId || !chapter) return [];
    return dictPicksForChapter(mod, bookId, chapter, translation);
  }, [mod, bookId, chapter, translation]);

  const currentKey = trail.length > 0 ? (trail[trail.length - 1] ?? null) : null;
  const currentEntry: DictEntry | null = currentKey != null ? (entries[currentKey] ?? null) : null;

  const openEntry = React.useCallback((key: string) => {
    if (!key || !entries[key]) return;
    setTrail((t) => (t[t.length - 1] === key ? t : [...t, key]));
  }, [entries]);

  const onBack = React.useCallback(() => {
    setTrail((t) => (t.length > 1 ? t.slice(0, -1) : []));
  }, []);
  const onClearEntry = React.useCallback(() => setTrail([]), []);

  if (loading) return <div style={paneStyle}><div style={statusStyle}>Loading dictionary…</div></div>;
  if (err)    return <div style={paneStyle}><div style={{ ...statusStyle, color: "var(--cx-warn, #ffc46b)" }}>Couldn't load dictionary: {err}</div></div>;

  return (
    <div className="cx-dict-pane" style={paneStyle}>
      <header style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={{ fontSize: 20, marginRight: 6 }}>ℵ</span>
          <b style={{ fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)", fontSize: 18 }}>
            Bible Dictionary
          </b>
          {mod && mod.meta && mod.meta._partial ? (
            <span style={partialPillStyle} title="Sample of ~200 entries from Easton's ~4000.">
              SAMPLE · {allKeys.length} of ~4000
            </span>
          ) : null}
        </div>
        <div style={{ marginTop: 6 }}>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Search Abraham, covenant, Bethlehem…"
            onChange={(e) => { setQuery(e.target.value); setLetter(null); }}
            style={searchStyle}
            aria-label="Search the dictionary"
          />
        </div>
        <div style={letterBarStyle}>
          {[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((L) => {
            const enabled = letters.includes(L);
            const active = letter === L;
            return (
              <button
                key={L}
                onClick={() => { if (enabled) { setLetter(L === letter ? null : L); setQuery(""); setTrail([]); } }}
                disabled={!enabled}
                style={{
                  ...letterBtnStyle,
                  color: active ? "var(--cx-accent, #7ee0ff)" : (enabled ? "var(--cx-fg, #c9d4dc)" : "rgba(255,255,255,0.15)"),
                  borderColor: active ? "var(--cx-accent, #7ee0ff)" : "transparent",
                  cursor: enabled ? "pointer" : "default",
                }}
                title={enabled ? `Entries beginning with ${L}` : `No entries for ${L} in this sample`}
              >{L}</button>
            );
          })}
        </div>
      </header>

      {/* Chapter picks strip */}
      {!currentEntry && !query.trim() && !letter && picks.length > 0 ? (
        <section style={picksStripStyle}>
          <div style={picksHStyle}>Dictionary picks for this chapter</div>
          <div style={picksRowStyle}>
            {picks.map((k) => {
              const pickEntry = entries[k];
              if (!pickEntry) return null;
              return (
                <button key={k} onClick={() => openEntry(k)} style={pickCardStyle} title={`Open ${pickEntry.title}`}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{pickEntry.title}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, letterSpacing: "0.08em", color: kindColor(pickEntry.kind) }}>
                    {kindLabel(pickEntry.kind)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Search results */}
      {!currentEntry && query.trim() ? (
        <section style={{ marginBottom: 10 }}>
          <div style={sectionHStyle}>Results</div>
          {searchResults.length === 0 ? (
            <div style={{ ...statusStyle, paddingTop: 8 }}>
              No matches for <b>"{query}"</b> in the sample.
              <div style={{ marginTop: 8 }}>
                <a
                  href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query + " bible")}`}
                  target="_blank" rel="noopener noreferrer" style={wikiLinkStyle}
                >Search Wikipedia for "{query}" →</a>
              </div>
            </div>
          ) : (
            <ul style={listStyle}>
              {searchResults.map((k) => {
                const srEntry = entries[k];
                if (!srEntry) return null;
                return (
                  <li key={k} style={resultRowStyle}>
                    <button style={resultBtnStyle} onClick={() => openEntry(k)}>
                      <b>{srEntry.title}</b>
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, color: kindColor(srEntry.kind), letterSpacing: "0.08em" }}>
                        {kindLabel(srEntry.kind)}
                      </span>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                        {(srEntry.body || "").slice(0, 110)}…
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* Letter browse */}
      {!currentEntry && letter ? (
        <section>
          <div style={sectionHStyle}>{letter}</div>
          <ul style={listStyle}>
            {letterEntries.map((k) => {
              const letEntry = entries[k];
              if (!letEntry) return null;
              return (
                <li key={k} style={resultRowStyle}>
                  <button style={resultBtnStyle} onClick={() => openEntry(k)}>
                    <b>{letEntry.title}</b>
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, color: kindColor(letEntry.kind), letterSpacing: "0.08em" }}>
                      {kindLabel(letEntry.kind)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Empty browse state */}
      {!currentEntry && !query.trim() && !letter && picks.length === 0 ? (
        <div style={{ ...statusStyle, opacity: 0.75 }}>
          Search above, tap a letter, or open a verse and use <i>Look up in Dictionary</i>.
        </div>
      ) : null}

      {/* Entry view */}
      {currentEntry ? (
        <article style={entryStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {trail.length > 1 ? (
              <button onClick={onBack} style={backBtnStyle} title="Back to previous entry">← back</button>
            ) : null}
            <button onClick={onClearEntry} style={backBtnStyle} title="Close entry">× close</button>
          </div>
          <h2 style={entryTitleStyle}>{currentEntry.title}</h2>
          <div style={{ ...kindBadgeStyle, color: kindColor(currentEntry.kind), borderColor: kindColor(currentEntry.kind) }}>
            {kindLabel(currentEntry.kind)}
          </div>
          <div className="cx-dict-body" style={entryBodyStyle}>
            {renderBody(currentEntry.body)}
          </div>
          {Array.isArray(currentEntry.refs) && currentEntry.refs.length ? (
            <div style={{ marginTop: 12 }}>
              <div style={sectionHStyle}>Scripture</div>
              <div style={chipRowStyle}>
                {currentEntry.refs.map((r) => (
                  <button key={r} style={refChipStyle} onClick={() => navigateToRef(r)} title={`Open ${formatRef(r)}`}>
                    {formatRef(r)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(currentEntry.related) && currentEntry.related.length ? (
            <div style={{ marginTop: 12 }}>
              <div style={sectionHStyle}>Related entries</div>
              <div style={chipRowStyle}>
                {currentEntry.related.map((r) => {
                  const relEntry = entries[r];
                  const present = !!relEntry;
                  return (
                    <button
                      key={r}
                      style={{ ...relChipStyle, opacity: present ? 1 : 0.4, cursor: present ? "pointer" : "default" }}
                      onClick={() => { if (present) openEntry(r); }}
                      title={present && relEntry ? `Open ${relEntry.title}` : "Not in this sample"}
                      disabled={!present}
                    >
                      {present && relEntry ? relEntry.title : r}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </article>
      ) : null}

      <footer style={footStyle}>
        Easton's Bible Dictionary (1893, public domain) — sample of {allKeys.length}.
      </footer>
    </div>
  );
}
