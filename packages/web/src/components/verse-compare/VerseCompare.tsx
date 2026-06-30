// verse-compare — VerseCompare component (faithfully migrated from
// verse-compare.jsx). Side-by-side reading of one verse across every
// translation. Reachable from the verse menu (COMPARE) or from the bottom
// toolbar of the modal where the user can add adjacent verses.
//
// All translations are filterable via the dropdown at top. Verses load from
// BIBLE.loadChapter on demand and are cached, so reopening the same compare
// modal is instant — and offline-safe once the chapters are downloaded.
import React from "react";
import {
  vcw,
  type Translation,
  type ChapterVerse,
  type ChapterEntry,
  type VerseCompareProps,
} from "./verse-compare-window.js";
import { computeInitialIds, addAdjacentVerse } from "./helpers.js";

const { useState, useEffect, useMemo } = React;

interface VerseResult {
  loading?: boolean;
  error?: string;
  text?: string;
}

export function VerseCompare({
  verse,
  passage,
  primary,
  onClose,
}: VerseCompareProps): React.ReactElement {
  const data = vcw().CODEX_DATA;
  const allTrans: Translation[] = data?.translations ?? [];

  const initialIds = useMemo(
    () => computeInitialIds(primary, allTrans),
    // Faithful to legacy: deps are primary and the allTrans reference from data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, allTrans],
  );
  const [selectedTrans, setSelectedTrans] = useState<string[]>(initialIds);
  const [verses, setVerses] = useState<number[]>([verse?.n || 1]);
  const [chapters, setChapters] = useState<Record<string, ChapterEntry>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  // Pull each selected translation's chapter on demand
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, ChapterEntry> = { ...chapters };
      for (const tId of selectedTrans) {
        const k = `${passage.bookId}.${passage.chapter}.${tId}`;
        if (next[k]) continue;
        try {
          // Faithful to original: BIBLE must be present; throws TypeError if
          // not, which the catch block below records as a chapter error.
          const v = await vcw().BIBLE!.loadChapter(passage.bookId, passage.chapter, tId);
          if (cancelled) return;
          next[k] = v;
          setChapters({ ...next });
        } catch (e: unknown) {
          const errObj = e as { message?: string };
          next[k] = { error: String(errObj?.message || e) };
          setChapters({ ...next });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Faithful stale-closure quirk from the original: `chapters` is intentionally
    // omitted so the effect only re-fires when translations or passage change, not
    // on every chapter-cache update. The `if (next[k]) continue` guards re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrans, passage.bookId, passage.chapter]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addAdjacent = (delta: number): void => {
    setVerses((prev) => addAdjacentVerse(prev, delta));
  };

  const removeVerse = (n: number): void => {
    setVerses((prev) => (prev.length > 1 ? prev.filter((x) => x !== n) : prev));
  };

  const toggleTrans = (id: string): void => {
    setSelectedTrans((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const verseText = (tId: string, n: number): VerseResult => {
    const k = `${passage.bookId}.${passage.chapter}.${tId}`;
    const ch = chapters[k];
    if (!ch) return { loading: true };
    if (!Array.isArray(ch)) return { error: ch.error };
    const verses2 = ch as ChapterVerse[];
    const v = verses2.find((x) => x.n === n);
    if (!v) return { text: "—" };
    const raw = v[tId];
    return { text: v.text || (typeof raw === "string" ? raw : "") || "" };
  };

  return (
    <div className="cx-cmp-backdrop" onClick={onClose} role="dialog" aria-label="Verse comparison">
      <div className="cx-cmp" onClick={(e) => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-cmp-h">
          <span className="cx-cmp-h-tag">CODEX · COMPARE</span>
          <span className="cx-cmp-h-ref">
            {passage.book} {passage.chapter}:{verses.join(",")}
          </span>
          <button className="cx-cmp-x" onClick={onClose} aria-label="Close" title="Close (ESC)">
            ×
          </button>
        </header>

        <div className="cx-cmp-toolbar">
          <button
            className="cx-cmp-tool"
            onClick={() => addAdjacent(-1)}
            title="Add the previous verse"
          >
            + V−1
          </button>
          <button
            className="cx-cmp-tool"
            onClick={() => addAdjacent(+1)}
            title="Add the next verse"
          >
            + V+1
          </button>
          <span className="cx-cmp-vlist">
            {verses.map((n) => (
              <span key={n} className="cx-cmp-vchip">
                v{n}
                {verses.length > 1 ? (
                  <button onClick={() => removeVerse(n)} title="Remove this verse">
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </span>
          <div className="cx-cmp-trans-picker">
            <button
              className="cx-cmp-tool"
              onClick={() => setPickerOpen((o) => !o)}
              title="Choose which translations to include"
            >
              {selectedTrans.length} translations ▾
            </button>
            {pickerOpen ? (
              <div className="cx-cmp-trans-menu" onMouseLeave={() => setPickerOpen(false)}>
                <div className="cx-cmp-trans-h">SHOW · TRANSLATIONS</div>
                {allTrans.map((t) => (
                  <label key={t.id} className="cx-cmp-trans-row">
                    <input
                      type="checkbox"
                      checked={selectedTrans.includes(t.id)}
                      onChange={() => toggleTrans(t.id)}
                    />
                    <span className="cx-cmp-trans-glyph">{t.glyph}</span>
                    <span className="cx-cmp-trans-name">
                      <b>{t.name}</b>
                      <i>
                        {t.year} · {t.lang}
                      </i>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="cx-cmp-body">
          <table className="cx-cmp-table">
            <thead>
              <tr>
                <th className="cx-cmp-th-v">V</th>
                {selectedTrans.map((tId) => {
                  const meta = allTrans.find((t) => t.id === tId);
                  return (
                    <th key={tId} className="cx-cmp-th">
                      <span className="cx-cmp-th-name">{meta?.name || tId}</span>
                      <span className="cx-cmp-th-meta">
                        {meta?.year} · {meta?.lang}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {verses.map((n) => (
                <tr key={n}>
                  <td className="cx-cmp-td-v">{n}</td>
                  {selectedTrans.map((tId) => {
                    const r = verseText(tId, n);
                    return (
                      <td key={tId} className="cx-cmp-td">
                        {r.loading ? (
                          <span className="cx-cmp-td-l">loading…</span>
                        ) : r.error ? (
                          <span className="cx-cmp-td-e">{r.error}</span>
                        ) : (
                          <span>{r.text}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
