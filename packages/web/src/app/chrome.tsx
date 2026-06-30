// app — shell chrome (migrated from app.jsx). The language picker, the desk
// window frame (wm.js-compatible), the near-invisible desk trace (time · theme ·
// ⌘K), and the desktop footer bar.
import React from "react";
import { Tick } from "../components/reader/chrome.js";
import { pad } from "../components/reader/solar.js";
import { AutoCacheTick } from "./toast.js";
import { aw, tt } from "./app-window.js";

export function LangPicker({ value, onChange }: { value: string; onChange: (id: string) => void }): React.ReactElement {
  const langs = aw().CODEX_LANGS || [{ id: "en", label: "English", glyph: "EN" }];
  return (
    <div className="cx-langs">
      {langs.map((l) => (
        <button key={l.id} className={`cx-lang ${value === l.id ? "is-on" : ""}`} onClick={() => onChange(l.id)} title={l.label} aria-pressed={value === l.id}>
          <span className="cx-lang-glyph">{l.glyph}</span>
          <span className="cx-lang-name">{l.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DeskWin({
  id,
  glyph,
  title,
  ctx,
  onClose,
  onFocusMode,
  focusOn,
  bodyClass,
  headerExtra,
  children,
}: {
  id: string;
  glyph: string;
  title: string;
  ctx?: string;
  onClose: () => void;
  onFocusMode?: () => void;
  focusOn?: boolean;
  bodyClass?: string;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="cx-win-backdrop cx-desk-bd" data-wm-id={`win:${id}`} data-wm-glyph={glyph} data-desk={id}>
      <div className="cx-win cx-desk-win" role="region" aria-label={title}>
        <header className="cx-win-h">
          <span className="cx-win-h-glyph" aria-hidden="true">
            {glyph}
          </span>
          <span className="cx-win-h-title">{title}</span>
          <span className="cx-win-h-ctx">{ctx || ""}</span>
          {headerExtra || null}
          {onFocusMode ? (
            <button
              className="cx-win-focus"
              onClick={onFocusMode}
              aria-pressed={!!focusOn}
              aria-label={focusOn ? "Exit focus mode" : "Focus — hide everything but the reader"}
              title={focusOn ? "Exit focus (Esc)" : "Focus — hide everything else (F)"}
            >
              ⛶
            </button>
          ) : null}
          <button className="cx-win-x" onClick={onClose} aria-label={`Close ${title}`} title="Close">
            ×
          </button>
        </header>
        <div className={`cx-win-body ${bodyClass || ""}`}>{children}</div>
      </div>
    </div>
  );
}

export function DeskTrace({ now, dark, autoTheme, onToggleTheme }: { now: Date; dark: boolean; autoTheme: boolean; onToggleTheme: () => void }): React.ReactElement {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="cx-trace" role="toolbar" aria-label="System">
      <span className="cx-trace-time" title={now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}>
        {hh}:{mm}
      </span>
      <button className="cx-trace-btn" onClick={onToggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={(autoTheme ? "Auto theme · " : "") + (dark ? "Lights on" : "Lights off")}>
        {dark ? "◐" : "◑"}
      </button>
      <button className="cx-trace-btn" onClick={() => aw().codexOpenOmni?.()} aria-label="Open omnibar" title="Ask anything · ⌘K">
        ⌘
      </button>
    </div>
  );
}

export function FooterBar({
  gnosisOn,
  onToggleGnosis,
  compareCount,
  distractionFree,
  onToggleDistractionFree,
  onShowShortcuts,
  onOpenReels,
  isOnline = true,
}: {
  currentVerse?: number;
  passage?: unknown;
  gnosisOn: boolean;
  onToggleGnosis: (v: boolean) => void;
  compareCount: number;
  distractionFree: boolean;
  onToggleDistractionFree: () => void;
  onShowShortcuts?: () => void;
  onOpenReels?: () => void;
  isOnline?: boolean;
}): React.ReactElement {
  return (
    <footer className="cx-footer">
      <div className="cx-footer-l">
        <div className="cx-footer-cluster">
          <button className={`cx-df-toggle ${distractionFree ? "is-on" : ""}`} onClick={onToggleDistractionFree} title={distractionFree ? "Show panels" : "Calm mode (hide both rails)"} aria-pressed={distractionFree}>
            {distractionFree ? "⊞" : "⊟"}
          </button>
          <button className="cx-df-toggle" onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")} title="Settings" aria-label="Settings" data-tweaks-trigger>
            ⚙
          </button>
          {onOpenReels ? (
            <button className="cx-df-toggle cx-reels-launch" onClick={onOpenReels} title="Reels — endless scripture feed" aria-label="Open Reels">
              ❖
            </button>
          ) : null}
        </div>
        {compareCount > 0 ? (
          <Tick className="cx-hide-mobile">
            {tt("footer.compare")}&nbsp;<b>{pad(compareCount)}</b>
          </Tick>
        ) : null}
        <Tick className="cx-hide-mobile">
          {tt("footer.cache")}&nbsp;<b>{tt("footer.cache.value")}</b>
        </Tick>
        <AutoCacheTick />
      </div>
      <div className="cx-footer-c">
        <button className={`cx-gnosis-master ${gnosisOn ? "is-on" : ""}`} onClick={() => onToggleGnosis(!gnosisOn)}>
          <span className="cx-gnosis-master-ring" />
          <span className="cx-gnosis-master-lbl">⟁ {gnosisOn ? tt("footer.gnosis.engaged") : tt("footer.gnosis.dormant")}</span>
        </button>
      </div>
      <div className="cx-footer-r">
        {!isOnline ? (
          <span className="cx-offline-pill" title="No network — cached chapters/panels still work">
            OFFLINE — cached only
          </span>
        ) : null}
        {onShowShortcuts ? (
          <button className="cx-kbd-chip" onClick={onShowShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            ?
          </button>
        ) : null}
      </div>
    </footer>
  );
}
