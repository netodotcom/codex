// verse-map — FootScrub component (Backlog 4.1, sub-slice 10). Migrated from
// verse-map.jsx (l.1907). Drag/keyboard scrub across the polity chronology.
// Pure math lives in scrub.ts; eraTint in geo.ts; fmtYear is injected (intel).
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Polity } from "./polity.js";
import { scrubList, scrubBounds, activeIndex, pct } from "./scrub.js";
import { eraTint } from "./geo.js";

export interface FootScrubProps {
  polities: Polity[];
  verseYear?: number;
  fmtYear(year: number): string;
}

export function FootScrub({ polities, verseYear, fmtYear }: FootScrubProps): React.ReactElement | null {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const list = useMemo(() => scrubList(polities), [polities]);
  const { yMin, yMax } = useMemo(() => scrubBounds(list), [list]);
  const vy =
    typeof verseYear === "number" && !Number.isNaN(verseYear) ? Math.max(yMin, Math.min(yMax, verseYear)) : yMin;
  const [year, setYear] = useState(vy);

  const activeIdx = useMemo(() => activeIndex(list, year), [list, year]);
  const active = list[activeIdx] || null;

  useEffect(() => {
    try {
      (window as unknown as { __CODEX_MAP_ERA?: unknown }).__CODEX_MAP_ERA = active
        ? { name: active.name, from: active.from, to: active.to, year }
        : null;
      const ro = document.getElementById("cx-map-era");
      if (ro) ro.textContent = active ? `ERA ${active.name.toUpperCase()} · ${fmtYear(year)}` : "";
      const wrap = trackRef.current && trackRef.current.closest(".cx-map-field-wrap");
      if (wrap instanceof HTMLElement) wrap.style.setProperty("--cx-mapx-era-tint", eraTint(activeIdx, list.length));
      window.dispatchEvent(new CustomEvent("codex:year", { detail: { year } }));
    } catch {
      /* DOM not present (SSR/test) — ignore */
    }
  }, [year, activeIdx, active?.name, list.length, fmtYear]);

  const yearAtX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return year;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    return Math.round(yMin + t * (yMax - yMin));
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = true;
    try {
      trackRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported */
    }
    setYear(yearAtX(e.clientX));
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (draggingRef.current) setYear(yearAtX(e.clientX));
  };
  const onUp = (): void => {
    draggingRef.current = false;
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!list.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const ni = Math.max(0, Math.min(list.length - 1, activeIdx + dir));
      const p = list[ni];
      if (p) setYear(Math.round((p.from + p.to) / 2));
    } else if (e.key === "Home") {
      e.preventDefault();
      setYear(vy);
    }
  };

  if (!list.length) return null;
  return (
    <div className="cx-mapx-scrub" role="group" aria-label="Time scrub — polity chronology">
      <div className="cx-mapx-scrub-ro" aria-hidden="true">
        <span className="cx-mapx-scrub-tag">⧖ TIME</span>
        <span className="cx-mapx-scrub-era">{active ? active.name : "—"}</span>
        <span className="cx-mapx-scrub-yr">{fmtYear(year)}</span>
      </div>
      <div
        className="cx-mapx-scrub-track"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Year — drag across the chronology"
        aria-valuemin={yMin}
        aria-valuemax={yMax}
        aria-valuenow={year}
        aria-valuetext={active ? `${fmtYear(year)} — ${active.name}` : fmtYear(year)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        {list.map((p, i) => (
          <span
            key={i}
            className={"cx-mapx-scrub-seg" + (i === activeIdx ? " is-active" : "")}
            style={{
              left: pct(p.from, yMin, yMax) + "%",
              width: Math.max(0.4, pct(p.to, yMin, yMax) - pct(p.from, yMin, yMax)) + "%",
              background: `color-mix(in srgb, ${eraTint(i, list.length)} ${i === activeIdx ? 72 : 30}%, transparent)`,
            }}
            title={`${p.name} · ${fmtYear(p.from)} – ${fmtYear(p.to)}`}
          />
        ))}
        <span className="cx-mapx-scrub-vy" style={{ left: pct(vy, yMin, yMax) + "%" }} title="verse year" aria-hidden="true">
          ✦
        </span>
        <span className="cx-mapx-scrub-cursor" style={{ left: pct(year, yMin, yMax) + "%" }} aria-hidden="true" />
      </div>
    </div>
  );
}
