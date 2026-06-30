// reader — left rail (migrated from components.jsx). Three tabs: Library (the
// book/chapter tree, provided by window.Library), Oracle (window.Oracle), and
// Marks (bookmarks with literal + AI-ranked semantic search). The rail resizer
// and the two heavy tab bodies are rendered from runtime globals.
import React from "react";
import { CornerFrame } from "./chrome.js";
import { MarkRow } from "./MarkRow.js";
import { pad } from "./solar.js";
import { tx, rw } from "./reader-window.js";
import type { Mark } from "./types.js";

const { useState, useEffect, useMemo } = React;

type AiResults = null | "loading" | Array<{ key: string; reason: string }>;

export interface LeftRailProps {
  activeBookId: string;
  activeChapter: number;
  marks?: Mark[];
  highlightColors?: Record<string, { swatch?: string } | undefined>;
  onSelectMark: (m: Mark) => void;
  onClearMark: (m: Mark) => void;
  onTogglePinMark?: (m: Mark) => void;
  onMarkCurrent?: () => void;
  onSelectChapter: (bookId: string, ch: number) => void;
  currentRef?: string;
  oracleProps?: Record<string, unknown>;
  isCollapsed?: boolean;
  onCollapse?: () => void;
}

export function LeftRail({
  activeBookId,
  activeChapter,
  marks = [],
  highlightColors,
  onSelectMark,
  onClearMark,
  onTogglePinMark,
  onMarkCurrent,
  onSelectChapter,
  currentRef,
  oracleProps,
  onCollapse,
}: LeftRailProps): React.ReactElement {
  const [tab, setTab] = useState("library");
  useEffect(() => {
    const onPrefill = (): void => setTab("oracle");
    window.addEventListener("oracle:prefill", onPrefill);
    return () => window.removeEventListener("oracle:prefill", onPrefill);
  }, []);
  useEffect(() => {
    const onShortcut = (e: Event): void => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "toggle-oracle") setTab("oracle");
      else if (action === "toggle-bookmarks") setTab("marks");
    };
    window.addEventListener("codex:shortcut", onShortcut);
    return () => window.removeEventListener("codex:shortcut", onShortcut);
  }, []);
  const [bmQuery, setBmQuery] = useState("");
  const [aiMarkResults, setAiMarkResults] = useState<AiResults>(null);

  const literalMatches = useMemo(() => {
    const q = bmQuery.trim().toLowerCase();
    if (!q) return marks;
    return marks.filter(
      (b) =>
        (b.ref || "").toLowerCase().includes(q) ||
        (b.note || "").toLowerCase().includes(q) ||
        (b.color || "").toLowerCase().includes(q) ||
        (b.text || "").toLowerCase().includes(q),
    );
  }, [marks, bmQuery]);

  useEffect(() => {
    const q = bmQuery.trim();
    const MarkSearch = rw().MarkSearch;
    if (!q || q.length < 3 || !MarkSearch || !marks.length) {
      setAiMarkResults(null);
      return;
    }
    if (literalMatches.length >= 2) {
      setAiMarkResults(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setAiMarkResults("loading");
      const ranked = await MarkSearch.rank(q, marks, currentRef);
      if (cancelled) return;
      setAiMarkResults(ranked);
    }, 550);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [bmQuery, marks, literalMatches.length, currentRef]);

  const aiActive = Array.isArray(aiMarkResults) && aiMarkResults.length > 0;
  const aiLoading = aiMarkResults === "loading";
  const aiReasonByKey: Record<string, string> = aiActive ? Object.fromEntries(aiMarkResults.map((r) => [r.key, r.reason])) : {};
  const filteredMarks = useMemo(() => {
    if (aiActive) {
      const byKey: Record<string, Mark> = Object.fromEntries(marks.map((m) => [m.key, m]));
      return aiMarkResults.map((r) => byKey[r.key]).filter((m): m is Mark => Boolean(m));
    }
    return literalMatches;
  }, [aiActive, aiMarkResults, marks, literalMatches]);

  const TABS = [
    { id: "library", label: tx("tab.library"), glyph: "📖", title: tx("tab.library.title") },
    { id: "oracle", label: tx("tab.oracle"), glyph: "◉", title: tx("tab.oracle.title") },
    { id: "marks", label: tx("tab.marks"), glyph: "✦", title: `${tx("marks")} (${marks.length})` },
  ];

  const Resizer = rw().LeftRailResizer;
  const Library = rw().Library;
  const Oracle = rw().Oracle;

  return (
    <aside className="cx-rail cx-rail-l">
      {Resizer ? <Resizer /> : null}
      {onCollapse ? (
        <button className="cx-rail-fold cx-rail-fold-l" onClick={onCollapse} title="Hide library (click the spine to bring it back)" aria-label="Collapse left rail">
          ◀
        </button>
      ) : null}
      <div className="cx-ltabs">
        {TABS.map((t) => (
          <button key={t.id} className={`cx-ltab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)} title={t.title}>
            <span className="cx-ltab-glyph">{t.glyph}</span>
            <span className="cx-ltab-lbl">{t.label}</span>
            {t.id === "marks" && marks.length > 0 ? <span className="cx-ltab-badge">{marks.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <CornerFrame label="LIBRARY" className="cx-rail-flex">
          {Library ? (
            <Library
              activeBookId={activeBookId}
              activeChapter={activeChapter}
              onSelectChapter={onSelectChapter}
              activeTranslation={(oracleProps && (oracleProps["primary"] as string)) || "kjv"}
              onJumpRef={(ref: string) => {
                try {
                  window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref } }));
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : null}
        </CornerFrame>
      ) : null}

      {tab === "oracle" ? (
        <CornerFrame label="ORACLE · NEUTRAL" className="cx-rail-flex">
          {Oracle ? <Oracle {...(oracleProps || {})} /> : <div style={{ padding: 14, color: "var(--cx-fg-dim)" }}>Oracle loading…</div>}
        </CornerFrame>
      ) : null}

      {tab === "marks" ? (
        <CornerFrame label={`${tx("marks.tab")} · ${tx("marks")}`} className="cx-rail-flex">
          <div className="cx-bm-head">
            <span>
              {tx("marks.head")} · {pad(marks.length)}
            </span>
            <span style={{ display: "inline-flex", gap: 6 }}>
              <button
                className="cx-mini-btn"
                onClick={async () => {
                  if (!marks.length) {
                    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "No marks to export.", kind: "warn" } }));
                    return;
                  }
                  const lines = marks.map((m) => {
                    const colour = m.color ? ` (${m.color})` : "";
                    const text = (m.text || "").replace(/\s+/g, " ").trim();
                    return `${m.ref || m.key || "?"}${colour} — ${text}`;
                  });
                  const txt = lines.join("\n");
                  const json = JSON.stringify(marks, null, 2);
                  const blob = `${txt}\n\n---\n\n${json}`;
                  try {
                    await navigator.clipboard.writeText(blob);
                    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `${marks.length} marks copied to clipboard.`, kind: "ok" } }));
                  } catch (e) {
                    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `Copy failed: ${(e as Error).message || e}`, kind: "err" } }));
                  }
                }}
                title="Export all marks to clipboard (text + JSON)"
              >
                ⤓ EXPORT
              </button>
              <button className="cx-mini-btn" onClick={onMarkCurrent} title={tx("marks.add")}>
                {tx("marks.add")}
              </button>
            </span>
          </div>
          <div className="cx-search">
            <span className="cx-search-icon">⌕</span>
            <input placeholder={tx("marks.search")} value={bmQuery} onChange={(e) => setBmQuery(e.target.value)} />
            {aiLoading ? (
              <span className="cx-bm-ai-chip is-loading" title="Semantic search thinking…">
                ✦ AI…
              </span>
            ) : aiActive ? (
              <span className="cx-bm-ai-chip is-on" title="Showing semantic matches ranked by the Oracle">
                ✦ AI
              </span>
            ) : null}
            {bmQuery ? (
              <button className="cx-search-x" onClick={() => setBmQuery("")}>
                ×
              </button>
            ) : null}
          </div>
          {aiActive ? (
            <div className="cx-bm-ai-note">
              Semantic ranking · {aiMarkResults.length} {aiMarkResults.length === 1 ? "match" : "matches"} for "{bmQuery.trim()}"
            </div>
          ) : null}
          <ul className="cx-bm-list">
            {aiLoading && filteredMarks.length === 0 ? (
              <li className="cx-bm-empty">— Asking the Oracle for related marks… —</li>
            ) : filteredMarks.length === 0 ? (
              <li className="cx-bm-empty">— {marks.length === 0 ? tx("marks.empty") : "no match"} —</li>
            ) : (
              filteredMarks.map((m, i) => (
                <MarkRow
                  key={m.key}
                  mark={m}
                  idx={i}
                  onSelect={onSelectMark}
                  onClear={onClearMark}
                  onTogglePin={onTogglePinMark}
                  swatch={m.color ? highlightColors?.[m.color]?.swatch : undefined}
                  aiReason={aiReasonByKey[m.key]}
                />
              ))
            )}
          </ul>
        </CornerFrame>
      ) : null}
    </aside>
  );
}
