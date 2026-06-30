// reader — top status bar (migrated from components.jsx). Logo + side quests +
// bookmark/streak ticks on the left, the solar strip centre, the clock + 3-state
// theme toggle + mobile omnibar door on the right. Some legacy props
// (primary/onSelectPrimary/onToggleLeft/onToggleRight/gnosisOn) are retained on
// the type for call-site compatibility but no longer rendered here.
import React from "react";
import { Tick } from "./chrome.js";
import { SunStrip } from "./SunStrip.js";
import { SideQuestsButton } from "./SideQuestsButton.js";
import { pad, fmtClock, fmtDate } from "./solar.js";
import { rw } from "./reader-window.js";
import type { Solar } from "./solar.js";

export interface StatusBarProps {
  now: Date;
  solar: Solar;
  dark: boolean;
  autoTheme: boolean;
  onToggleTheme: () => void;
  onToggleAuto: () => void;
  bookmarkCount: number;
  gnosisOn?: boolean;
  primary?: string;
  onSelectPrimary?: (id: string) => void;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export function StatusBar({ now, solar, dark, autoTheme, onToggleTheme, onToggleAuto, bookmarkCount }: StatusBarProps): React.ReactElement {
  const version = rw().CODEX_VERSION?.v || "7.7";
  const streak = rw().CODEX_ENGAGE?.loadStreak?.();
  return (
    <header className="cx-status">
      <div className="cx-status-l">
        <div className="cx-logo">
          <svg viewBox="0 0 32 32" className="cx-sigil cx-sigil-std" aria-hidden>
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="0.7" opacity=".7" />
            <path d="M16 2 L16 30 M2 16 L30 16" stroke="currentColor" strokeWidth="0.6" opacity=".55" />
            <path d="M16 6 L20 16 L16 26 L12 16 Z" fill="currentColor" opacity=".9" />
            <circle cx="16" cy="16" r="1.6" fill="var(--cx-bg)" />
          </svg>
          <svg viewBox="0 0 32 32" className="cx-sigil cx-sigil-drift" aria-hidden>
            <path d="M16 3 L29 27 L3 27 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M16 3 L16 1 M29 27 L31 28.5 M3 27 L1 28.5" stroke="currentColor" strokeWidth="0.8" opacity=".7" />
            <ellipse cx="16" cy="20" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="16" cy="20" r="2.2" fill="currentColor" />
            <circle cx="16" cy="20" r="0.7" fill="var(--cx-bg)" />
            <path d="M5 20 L1.5 18 M27 20 L30.5 18 M16 12 L16 8" stroke="currentColor" strokeWidth="0.7" opacity=".55" />
          </svg>
          <div className="cx-logo-txt">
            <b className="cx-logo-name">
              <span className="cx-logo-std">CODEX</span>
              <span className="cx-logo-drift">CODƎX</span>
            </b>
            <span className="cx-logo-sub">
              <span className="cx-logo-std">{`NOCTURNE · v${version}`}</span>
              <span className="cx-logo-drift">VEILED.GLYPH · NIHIL OBSTAT</span>
            </span>
          </div>
        </div>

        <div className="cx-status-sep cx-hide-narrow" />

        <SideQuestsButton />

        <Tick className="cx-hide-narrow">
          BMK&nbsp;<b>{pad(bookmarkCount)}</b>
        </Tick>
        {streak && streak.current > 0 ? (
          <span className="cx-streak-pill" title={`Longest: ${streak.longest} days`}>
            <span className="cx-flame">{"🔥"}</span>
            {streak.current}
          </span>
        ) : null}
      </div>

      <div className="cx-status-c cx-hide-narrow">
        <SunStrip solar={solar} />
      </div>

      <div className="cx-status-r">
        <div className="cx-clock">
          <span className="cx-clock-time">{fmtClock(now)}</span>
          <span className="cx-clock-date">
            {fmtDate(now)} · LOCAL · {solar.label}
          </span>
        </div>

        <button
          className={`cx-theme-toggle ${autoTheme ? "is-auto" : dark ? "is-dark" : "is-light"}`}
          onClick={() => {
            if (autoTheme) {
              onToggleAuto();
              if (dark) onToggleTheme();
            } else if (dark) {
              onToggleAuto();
            } else {
              onToggleTheme();
            }
          }}
          aria-label={autoTheme ? `Auto theme (${dark ? "night" : "day"}) — click for light` : dark ? "Night theme — click for auto" : "Day theme — click for dark"}
          title={autoTheme ? `Auto · ${dark ? "night" : "day"}` : dark ? "Night" : "Day"}
        >
          <span className="cx-theme-track">
            <span className="cx-theme-thumb">
              <svg className="cx-theme-sun" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <circle cx="8" cy="8" r="3" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <line x1="8" y1="1.5" x2="8" y2="3" />
                  <line x1="8" y1="13" x2="8" y2="14.5" />
                  <line x1="1.5" y1="8" x2="3" y2="8" />
                  <line x1="13" y1="8" x2="14.5" y2="8" />
                  <line x1="3.4" y1="3.4" x2="4.5" y2="4.5" />
                  <line x1="11.5" y1="11.5" x2="12.6" y2="12.6" />
                  <line x1="3.4" y1="12.6" x2="4.5" y2="11.5" />
                  <line x1="11.5" y1="4.5" x2="12.6" y2="3.4" />
                </g>
              </svg>
              <svg className="cx-theme-moon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M11 2.5a5.5 5.5 0 1 0 2.5 4.7 4 4 0 0 1-2.5-4.7z" fill="currentColor" />
              </svg>
              <span className="cx-theme-auto-badge">A</span>
            </span>
          </span>
        </button>

        <button className="cx-omni-launch" onClick={() => rw().codexOpenOmni?.()} aria-label="Open omnibar" title="Omnibar">
          ⌘
        </button>
      </div>
    </header>
  );
}
