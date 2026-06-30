// verse-map — PolityTimeline component (Backlog 4.1, sub-slice 11). Migrated from
// verse-map.jsx (l.1322). Pure math in polity.ts; fmtYear + the AI year-context
// fetch are injected so the component is testable without window/network.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type Polity,
  yearBounds,
  clampYear,
  majorTicks as computeMajor,
  minorTicks as computeMinor,
  boundaryTicks as computeBoundary,
  activePolity,
  fmtMajor,
} from "./polity.js";

export interface YearContext {
  headline: string;
  events?: string[];
}

export interface TheoryName {
  name: string;
  note: string;
}

export interface PolityTimelineProps {
  polities: Polity[];
  verseYear?: number;
  theoryNames?: TheoryName[];
  fmtYear(year: number): string;
  fetchYearContext(year: number): Promise<YearContext>;
}

export function PolityTimeline({
  polities,
  verseYear,
  theoryNames,
  fmtYear,
  fetchYearContext,
}: PolityTimelineProps): React.ReactElement {
  const { yMin, yMax } = useMemo(() => yearBounds(polities), [polities]);
  const initialYear = typeof verseYear === "number" && !Number.isNaN(verseYear) ? verseYear : 0;
  const clampedInitial = clampYear(initialYear, yMin, yMax);
  const [year, setYear] = useState(clampedInitial);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("codex:year", { detail: { year } }));
  }, [year]);

  const active = useMemo(() => activePolity(polities, year), [polities, year]);
  const majorTicks = useMemo(() => computeMajor(yMin, yMax), [yMin, yMax]);
  const minorTicks = useMemo(() => computeMinor(yMin, yMax, majorTicks), [yMin, yMax, majorTicks]);
  const boundaryTicks = useMemo(() => computeBoundary(polities, yMin, yMax), [polities, yMin, yMax]);

  const tickWrapRef = useRef<HTMLDivElement>(null);
  const [skipEvery, setSkipEvery] = useState(0);
  useEffect(() => {
    if (!tickWrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 320;
      const need = majorTicks.length * 48;
      setSkipEvery(w < need ? (w < need / 2 ? 2 : 1) : 0);
    });
    ro.observe(tickWrapRef.current);
    return () => ro.disconnect();
  }, [majorTicks.length]);

  const [ctxBadge, setCtxBadge] = useState<YearContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      fetchYearContext(year)
        .then(setCtxBadge)
        .catch(() => {})
        .finally(() => setCtxLoading(false));
    }, 320);
    setCtxLoading(true);
    return () => clearTimeout(t);
  }, [year, fetchYearContext]);

  const left = (t: number): string => `${((t - yMin) / (yMax - yMin)) * 100}%`;

  return (
    <div className="cx-map-timeline">
      <div className="cx-map-timeline-h">
        <span className="cx-map-timeline-tag">CHRONO</span>
        <span className="cx-map-timeline-yr">{fmtYear(year)}</span>
        {year === clampedInitial ? <span className="cx-map-timeline-vy">· verse year</span> : null}
        <button
          className="cx-map-timeline-reset"
          onClick={() => setYear(clampedInitial)}
          title="Snap back to the verse's own year"
          aria-label="Reset to verse year"
        >
          ⟲
        </button>
      </div>

      <div className={`cx-map-timeline-active ${active ? "" : "is-empty"}`}>
        {active ? (
          <>
            <span className="cx-map-timeline-active-name">{active.name}</span>
            <span className="cx-map-timeline-active-range">
              {fmtYear(active.from)} – {fmtYear(active.to)}
            </span>
          </>
        ) : (
          <span className="cx-map-timeline-active-name">— no recorded polity —</span>
        )}
      </div>

      <input
        type="range"
        className="cx-map-timeline-slider"
        min={yMin}
        max={yMax}
        step={1}
        value={year}
        onChange={(e) => setYear(parseInt(e.target.value, 10))}
        aria-label="Year"
      />

      <div className="cx-map-timeline-ticks" ref={tickWrapRef}>
        {boundaryTicks.map((t, i) => (
          <span key={`b${i}`} className="cx-map-timeline-tick is-boundary" style={{ left: left(t) }} aria-hidden />
        ))}
        {minorTicks.map((t) => (
          <span key={`m${t}`} className="cx-map-timeline-tick is-minor" style={{ left: left(t) }} aria-hidden />
        ))}
        {majorTicks.map((t, i) => (
          <span
            key={t}
            className={`cx-map-timeline-tick is-major ${skipEvery && i % (skipEvery + 1) !== 0 ? "is-dim" : ""}`}
            style={{ left: left(t) }}
            title={fmtYear(t)}
          >
            {fmtMajor(t)}
          </span>
        ))}
      </div>

      <div className={`cx-map-yrctx ${ctxLoading ? "is-loading" : ""}`} aria-live="polite">
        <span className="cx-map-yrctx-tag">WHEN</span>
        {ctxBadge ? (
          <div className="cx-map-yrctx-body">
            <b>{ctxBadge.headline}</b>
            {Array.isArray(ctxBadge.events) && ctxBadge.events.length ? (
              <ul>
                {ctxBadge.events.slice(0, 3).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <span className="cx-map-yrctx-load">resolving {fmtYear(year)}…</span>
        )}
      </div>

      <details className="cx-map-timeline-list">
        <summary>full timeline · {polities.length} polities</summary>
        <ul>
          {polities.map((p, i) => (
            <li
              key={i}
              className={active && active.name === p.name && active.from === p.from ? "is-active" : ""}
              onClick={() => setYear(Math.round((p.from + p.to) / 2))}
              role="button"
              title={`Jump to mid-${p.name}`}
            >
              <span className="cx-pl-name">{p.name}</span>
              <span className="cx-pl-range">
                {fmtYear(p.from)} – {fmtYear(p.to)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {Array.isArray(theoryNames) && theoryNames.length > 0 ? (
        <details className="cx-map-timeline-theory">
          <summary>theory + esoterica · {theoryNames.length}</summary>
          <ul>
            {theoryNames.map((t, i) => (
              <li key={i}>
                <b>{t.name}</b>
                <span>{t.note}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
