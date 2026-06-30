// reader — solar clock strip (migrated from components.jsx). A fluid 24-hour
// strip; night/dawn/day/dusk bands baked into one CSS gradient. Tick density
// adapts to the rendered width via a ResizeObserver so labels never overlap.
import React from "react";
import { pad } from "./solar.js";
import type { Solar } from "./solar.js";

const { useState, useEffect, useRef } = React;

export function SunStrip({ solar }: { solar: Solar }): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tickHours, setTickHours] = useState<number[]>([0, 6, 12, 18, 24]);

  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 0;
      const want = Math.max(3, Math.min(13, Math.floor(w / 38) + 1));
      const candidates = [1, 2, 3, 4, 6, 8, 12, 24];
      const stepHours = candidates.find((s) => 24 / s + 1 <= want) || 24;
      const out: number[] = [];
      for (let h = 0; h <= 24; h += stepHours) out.push(h);
      setTickHours(out);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const nowPct = solar.t01 * 100;
  const sunNorm = Math.max(0, Math.min(1, solar.sunPct / 100));
  const sunY = 8 - sunNorm * 6;

  return (
    <div className={`cx-sun is-${solar.phase}`} ref={wrapRef} title={`${solar.label} · sun ${Math.round(solar.sunPct)}% of zenith`}>
      <div className="cx-sun-bar" aria-hidden="true">
        <div className="cx-sun-bar-grad" />
        {tickHours.map((h) => (
          <span key={h} className="cx-sun-tick" style={{ left: `${(h / 24) * 100}%` }} data-h={pad(h)}>
            {pad(h)}
          </span>
        ))}
        <div className="cx-sun-cursor" style={{ left: `${nowPct}%` }}>
          <span className="cx-sun-cursor-dot" />
          <svg className="cx-sun-cursor-sun" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <circle cx="6" cy={sunY} r="2.2" fill="currentColor" />
          </svg>
        </div>
      </div>
      <div className="cx-sun-meta" aria-label={`${solar.label} ${Math.round(solar.sunPct)} percent of zenith`}>
        <span className="cx-sun-meta-phase">{solar.label.toLowerCase()}</span>
        <span className="cx-sun-meta-dot" aria-hidden="true">
          ·
        </span>
        <span className="cx-sun-meta-sun">
          {Math.round(solar.sunPct)}
          <i>%</i>
        </span>
      </div>
    </div>
  );
}
