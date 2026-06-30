// reader — the centre scripture reader (migrated from components.jsx). Owns the
// chapter head (title, translation switcher, view options), the verse body
// (single column / side-by-side grid / mobile carousel, with inline gnosis), and
// the pager foot with the chapter grid. Swipe + trackpad gestures navigate
// chapters; the saved cursor scrolls into view on load.
import React from "react";
import { CornerFrame, Pill } from "./chrome.js";
import { QuickTranslationSwitcher } from "./QuickTranslationSwitcher.js";
import { ReaderViewPopover } from "./ReaderViewPopover.js";
import { ChapterGridPopover } from "./ChapterGridPopover.js";
import { VerseRow } from "./VerseRow.js";
import { VerseSideRow } from "./VerseSideRow.js";
import { GnosisInline, type GnosisEntry } from "./GnosisInline.js";
import { gnosisInsertionPoints } from "./gnosis.js";
import { rw } from "./reader-window.js";
import type { Passage, Verse, Translation } from "./types.js";

const { useState, useEffect, useRef } = React;

export interface ReaderProps {
  passage: Passage;
  primary: string;
  compareTranslations: string[];
  sideBySide: boolean;
  gnosisOn: boolean;
  redLetter: boolean;
  fontScale: number;
  highlightedVerse?: number;
  onSelectVerse: (n: number) => void;
  onToggleSideBySide?: () => void;
  onToggleRedLetter?: () => void;
  onCycleFontSize?: () => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  highlights?: Record<string, { color?: string } | undefined>;
  highlightColor?: string;
  onToggleHighlight?: (n: number) => void;
  onOpenVerseMenu?: (v: Verse, rect: DOMRect) => void;
  panelData?: { gnosis?: GnosisEntry[] } | null;
  schizo?: boolean;
}

export function Reader({
  passage,
  primary,
  compareTranslations,
  sideBySide,
  gnosisOn,
  redLetter,
  fontScale,
  highlightedVerse,
  onSelectVerse,
  onToggleSideBySide,
  onToggleRedLetter,
  onCycleFontSize,
  onPrevChapter,
  onNextChapter,
  highlights,
  onToggleHighlight,
  onOpenVerseMenu,
  panelData,
  schizo,
}: ReaderProps): React.ReactElement {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [chapterGridAnchor, setChapterGridAnchor] = useState<DOMRect | null>(null);

  // Swipe / horizontal-scroll-to-navigate.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let x0: number | null = null;
    let y0: number | null = null;
    let dxAcc = 0;
    let lastWheelAt = 0;
    let dispatched = false;
    const THRESH = 60;
    const Y_LOCKOUT = 50;
    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      x0 = t.clientX;
      y0 = t.clientY;
      dispatched = false;
    };
    const onTouchMove = (e: TouchEvent): void => {
      if (x0 == null || dispatched) return;
      const t = e.touches[0];
      if (!t || y0 == null) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dy) > Y_LOCKOUT && Math.abs(dy) > Math.abs(dx)) {
        x0 = null;
        return;
      }
      if (Math.abs(dx) > THRESH) {
        if (dx < 0) onNextChapter?.();
        else onPrevChapter?.();
        dispatched = true;
        x0 = null;
      }
    };
    const onTouchEnd = (): void => {
      x0 = null;
      y0 = null;
      dispatched = false;
    };
    const onWheel = (e: WheelEvent): void => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      const now = Date.now();
      if (now - lastWheelAt > 220) dxAcc = 0;
      lastWheelAt = now;
      dxAcc += e.deltaX;
      if (Math.abs(dxAcc) > 80) {
        if (dxAcc > 0) onNextChapter?.();
        else onPrevChapter?.();
        dxAcc = 0;
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [onPrevChapter, onNextChapter]);

  // Scroll the saved cursor into view when a chapter finishes loading.
  useEffect(() => {
    if (passage.loading) return;
    if (!highlightedVerse || highlightedVerse <= 1) return;
    const body = bodyRef.current;
    if (!body) return;
    const target = body.querySelector(".cx-verse.is-hl, .cx-verse-row.is-hl") as HTMLElement | null;
    if (!target) return;
    const targetTop = target.offsetTop - 24;
    body.scrollTop = Math.max(0, targetTop);
  }, [passage.loading, passage.bookId, passage.chapter, highlightedVerse]);

  const compareCols = sideBySide ? [primary, ...compareTranslations.filter((t) => t !== primary)] : [primary];

  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (): void => setIsNarrow(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  const useCarousel = sideBySide && isNarrow && compareCols.length > 1;
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [carIdx, setCarIdx] = useState(0);
  useEffect(() => {
    if (!useCarousel) return;
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = (): void => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (i !== carIdx) setCarIdx(i);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [useCarousel, carIdx, compareCols.length]);

  const data = rw().CODEX_DATA;
  if (!data) return <main className="cx-reader" />;

  const colsMeta = compareCols.map((id) => data.translations.find((t) => t.id === id)).filter((t): t is Translation => Boolean(t));
  const primaryMeta = data.translations.find((t) => t.id === primary) || data.translations[0];
  const bookMeta = data.books.find((b) => b.id === passage.bookId);
  const totalChapters = bookMeta?.chapters || 1;

  const idx = data.books.findIndex((b) => b.id === passage.bookId);
  const prevBook = idx > 0 ? data.books[idx - 1] : undefined;
  const nextBook = idx < data.books.length - 1 ? data.books[idx + 1] : undefined;
  const prevLabel = passage.chapter > 1 ? `${passage.book.toUpperCase()} ${passage.chapter - 1}` : prevBook ? `${prevBook.name.toUpperCase()} ${prevBook.chapters}` : "";
  const nextLabel = passage.chapter < totalChapters ? `${passage.book.toUpperCase()} ${passage.chapter + 1}` : nextBook ? `${nextBook.name.toUpperCase()} 1` : "";

  const verseText = (v: Verse, tId: string): string => (v[tId] as string) || (v["kjv"] as string) || (v["web"] as string) || (v["bbe"] as string) || "";

  const versesFor = (tId: string): Verse[] => {
    const vis = passage.verses.filter((v) => verseText(v, tId));
    return vis.length ? vis : passage.verses;
  };

  if (!primaryMeta) return <main className="cx-reader" />;

  const activeVVCount = passage.verses.filter((v) => v[primary] != null && v[primary] !== "").length || passage.verses.length || "—";
  const bodyStyle = { "--cx-fs": `${fontScale}px` } as React.CSSProperties;

  return (
    <main className="cx-reader">
      <CornerFrame label={`${passage.book.toUpperCase()} · CH ${passage.chapter} · ${activeVVCount} VV`}>
        <div className="cx-reader-head">
          <div className="cx-reader-titles">
            <h1
              role="button"
              tabIndex={0}
              title="Open the Library"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent("codex:open-library"));
                } catch {
                  /* ignore */
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  try {
                    window.dispatchEvent(new CustomEvent("codex:open-library"));
                  } catch {
                    /* ignore */
                  }
                }
              }}
            >
              {passage.title || `${passage.book} ${passage.chapter}`}
            </h1>
            {passage.subtitle ? <p>{passage.subtitle}</p> : null}
          </div>
          <div className="cx-reader-meta">
            <QuickTranslationSwitcher primary={primary} primaryMeta={primaryMeta} />
            {gnosisOn ? <Pill accent>⟁</Pill> : null}
            <ReaderViewPopover
              redLetter={redLetter}
              onToggleRedLetter={onToggleRedLetter}
              fontScale={fontScale}
              onCycleFontSize={onCycleFontSize}
              sideBySide={sideBySide}
              onToggleSideBySide={onToggleSideBySide}
            />
          </div>
        </div>

        {sideBySide && colsMeta.length > 1 ? (
          <div className="cx-cols-head" style={{ gridTemplateColumns: `repeat(${colsMeta.length}, minmax(160px,1fr))` }}>
            {colsMeta.map((t, i) => (
              <div key={t.id} className={`cx-col-h ${i === 0 ? "is-primary" : ""}`}>
                <span className="cx-col-h-glyph">{t.glyph}</span>
                <div>
                  <b>{t.name}</b>
                  <span>
                    {t.year} · {t.lang}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div
          ref={(el) => {
            bodyRef.current = el;
            carouselRef.current = useCarousel ? el : null;
          }}
          className={`cx-reader-body ${sideBySide ? "is-cols" : ""} ${useCarousel ? "is-carousel" : ""}`}
          style={bodyStyle}
        >
          {passage.loading ? (
            <div className="cx-loading">
              <span className="cx-loading-orb" />
              <span>
                RETRIEVING · {passage.book} {passage.chapter} · across {compareCols.length} translation{compareCols.length === 1 ? "" : "s"}…
              </span>
            </div>
          ) : passage.error ? (
            <div className="cx-loading is-err">
              <span>⚠ FETCH FAILED</span>
              <code>{passage.error}</code>
              <span style={{ opacity: 0.6, fontSize: 11 }}>check connection · cached chapters still readable</span>
            </div>
          ) : passage.verses.length === 0 ? (
            <div className="cx-loading">— no verses returned —</div>
          ) : useCarousel ? (
            colsMeta.map((tMeta) => (
              <div key={`page-${tMeta.id}`} className="cx-carousel-page">
                <div className="cx-col-h" style={{ padding: "8px 12px", borderBottom: "1px solid var(--cx-line)" }}>
                  <span className="cx-col-h-glyph">{tMeta.glyph}</span>
                  <div>
                    <b>{tMeta.name}</b> <span style={{ opacity: 0.6 }}>· {tMeta.year} · {tMeta.lang}</span>
                  </div>
                </div>
                {versesFor(tMeta.id).map((v) => (
                  <VerseRow
                    key={`v${v.n}-${tMeta.id}`}
                    v={v}
                    isHl={highlightedVerse === v.n}
                    isLatin={tMeta.lang === "LA"}
                    markColor={highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null}
                    text={verseText(v, tMeta.id)}
                    redLetter={redLetter}
                    primary={tMeta.id}
                    onSelectVerse={onSelectVerse}
                    onToggleHighlight={onToggleHighlight}
                    onOpenVerseMenu={onOpenVerseMenu}
                    passage={passage}
                    schizo={schizo}
                  />
                ))}
              </div>
            ))
          ) : sideBySide && colsMeta.length > 1 ? (
            (() => {
              const gnosisEntries = gnosisOn && panelData?.gnosis ? panelData.gnosis : [];
              const rows = passage.verses.filter((v) => colsMeta.some((t) => verseText(v, t.id)));
              const points = gnosisInsertionPoints(rows.length, gnosisEntries.length);
              return rows.flatMap((v, vi) => {
                const out: React.ReactNode[] = [
                  <VerseSideRow
                    key={`v${v.n}`}
                    v={v}
                    colsMeta={colsMeta}
                    isHl={highlightedVerse === v.n}
                    markColor={highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null}
                    redLetter={redLetter}
                    verseText={verseText}
                    onSelectVerse={onSelectVerse}
                    onToggleHighlight={onToggleHighlight}
                    onOpenVerseMenu={onOpenVerseMenu}
                    passage={passage}
                    schizo={schizo}
                  />,
                ];
                if (points.has(vi + 1)) {
                  const gi = points.get(vi + 1);
                  const entry = gi != null ? gnosisEntries[gi] : undefined;
                  if (entry) out.push(<GnosisInline key={`g${gi}`} entry={entry} />);
                }
                return out;
              });
            })()
          ) : (
            (() => {
              const gnosisEntries = gnosisOn && panelData?.gnosis ? panelData.gnosis : [];
              const rows = versesFor(primary);
              const points = gnosisInsertionPoints(rows.length, gnosisEntries.length);
              return rows.flatMap((v, vi) => {
                const out: React.ReactNode[] = [
                  <VerseRow
                    key={`v${v.n}`}
                    v={v}
                    isHl={highlightedVerse === v.n}
                    isLatin={primaryMeta.lang === "LA"}
                    markColor={highlights ? highlights[`${passage.bookId}.${passage.chapter}.${v.n}`]?.color : null}
                    text={verseText(v, primary)}
                    redLetter={redLetter}
                    primary={primary}
                    onSelectVerse={onSelectVerse}
                    onToggleHighlight={onToggleHighlight}
                    onOpenVerseMenu={onOpenVerseMenu}
                    passage={passage}
                    schizo={schizo}
                  />,
                ];
                if (points.has(vi + 1)) {
                  const gi = points.get(vi + 1);
                  const entry = gi != null ? gnosisEntries[gi] : undefined;
                  if (entry) out.push(<GnosisInline key={`g${gi}`} entry={entry} />);
                }
                return out;
              });
            })()
          )}
        </div>

        {useCarousel ? (
          <div className="cx-carousel-dots" role="tablist" aria-label="Translation pages">
            {colsMeta.map((tMeta, i) => (
              <button
                key={tMeta.id}
                type="button"
                className={`cx-carousel-dot ${i === carIdx ? "is-on" : ""}`}
                aria-label={`Show ${tMeta.name}`}
                onClick={() => {
                  const el = carouselRef.current;
                  if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="cx-reader-foot">
          <button className="cx-nav-btn" onClick={onPrevChapter} disabled={!prevLabel} title={prevLabel || "Beginning"} aria-label={`Previous: ${prevLabel || "Beginning"}`}>
            <span className="cx-nav-arrow" aria-hidden="true">
              &lsaquo;
            </span>
            <span className="cx-nav-btn-label">{prevLabel || ""}</span>
          </button>
          <button
            type="button"
            className="cx-reader-progress"
            title="Jump to chapter"
            aria-label={`Jump to chapter in ${passage.book}`}
            onClick={(e) => setChapterGridAnchor(e.currentTarget.getBoundingClientRect())}
          >
            <span>
              {passage.chapter} of {totalChapters}
            </span>
            <div className="cx-prog">
              <div className="cx-prog-fill" style={{ width: `${(passage.chapter / totalChapters) * 100}%` }} />
            </div>
          </button>
          {chapterGridAnchor ? (
            <ChapterGridPopover
              bookId={passage.bookId}
              totalChapters={totalChapters}
              currentChapter={passage.chapter}
              anchorRect={chapterGridAnchor}
              onPick={(ch) => {
                try {
                  window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref: `${passage.bookId}.${ch}.1` } }));
                } catch {
                  /* ignore */
                }
              }}
              onClose={() => setChapterGridAnchor(null)}
            />
          ) : null}
          <button className="cx-nav-btn" onClick={onNextChapter} disabled={!nextLabel} title={nextLabel || "End"} aria-label={`Next: ${nextLabel || "End"}`}>
            <span className="cx-nav-btn-label">{nextLabel || ""}</span>
            <span className="cx-nav-arrow" aria-hidden="true">
              &rsaquo;
            </span>
          </button>
        </div>
      </CornerFrame>
    </main>
  );
}
