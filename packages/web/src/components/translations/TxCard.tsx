// translations — TxCard (migrated verbatim from translations.jsx). One
// translation card: tap = primary, ⊕ corner / long-press (touch) = compare,
// the state dot = offline control. Logic is a faithful port; no behaviour change.
import React from "react";
import type { TxTranslation, TxStats, TxDl } from "./translations-window.js";
import type { OfflineState } from "./helpers.js";
import { txOfflineState } from "./helpers.js";
import { TX_DOT } from "./data.js";

export interface TxCardProps {
  t: TxTranslation;
  isPrimary: boolean;
  isCompare: boolean;
  isUser: boolean;
  stats: TxStats | undefined;
  dl: TxDl | null | undefined;
  onPick: () => void;
  onCompare: () => void;
  onDot: (off: OfflineState) => void;
  onRemove: () => void;
}

export function TxCard({
  t, isPrimary, isCompare, isUser, stats, dl, onPick, onCompare, onDot, onRemove,
}: TxCardProps): React.ReactElement {
  const off = txOfflineState(t, stats, dl);
  const longRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pct = Math.round(off.ratio * 100);

  const dotTitle = off.downloading
    ? `Downloading · ${pct}% · click to pause`
    : off.kind === "full"
      ? `${t.name} lives on this device · click to remove offline copy`
      : off.kind === "part"
        ? `${t.name} partly cached (${pct}%) · click to download the rest`
        : `${t.name} reads from the network · click to save offline`;

  // Long-press (touch land) = compare gesture; a plain tap stays primary.
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.pointerType === "mouse") return;
    longRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { longRef.current = true; onCompare(); }, 550);
  };
  const onPointerEnd = (): void => clearTimeout(timerRef.current);
  const onClick = (): void => {
    if (longRef.current) { longRef.current = false; return; }
    onPick();
  };

  return (
    <div
      className={`cx-tx-card ${isPrimary ? "is-primary" : ""} ${isCompare ? "is-compare" : ""} ${t.placeholder ? "is-ghost" : ""}`}
      data-tx-id={t.id}
    >
      <button
        type="button"
        className="cx-tx-card-pick"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        aria-pressed={isPrimary}
        disabled={!!t.placeholder}
        title={t.placeholder
          ? `${t.name} — not yet available (registry placeholder)`
          : isPrimary ? `${t.name} — you are reading this` : `Read in ${t.name}`}
      >
        <span className="cx-tx-card-glyph" aria-hidden="true">{t.glyph || t.id.toUpperCase()}</span>
        <span className="cx-tx-card-name">{t.name}</span>
        <span className="cx-tx-card-meta">
          <span className="cx-tx-card-year">{t.year || "—"}</span>
          {t.license ? <i className="cx-tx-lic" title={t.license} aria-hidden="true" /> : null}
        </span>
      </button>
      <button
        type="button"
        className={`cx-tx-dot is-${off.kind} ${off.downloading ? "is-dl" : ""}`}
        onClick={(e) => { e.stopPropagation(); onDot(off); }}
        title={dotTitle}
        aria-label={dotTitle}
      >
        {TX_DOT[off.kind]}
        {off.downloading ? <span className="cx-tx-dot-pct">{pct}%</span> : null}
      </button>
      <button
        type="button"
        className="cx-tx-card-cmp"
        onClick={(e) => { e.stopPropagation(); onCompare(); }}
        aria-pressed={isCompare}
        title={isCompare ? `Remove ${t.name} from compare` : `Compare ${t.name} beneath the primary`}
        aria-label={isCompare ? `Remove ${t.name} from compare` : `Add ${t.name} to compare`}
      >{isCompare ? "⊖" : "⊕"}</button>
      {isUser ? (
        <button
          type="button"
          className="cx-tx-card-rm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title={`Remove ${t.name} from your library`}
          aria-label={`Remove ${t.name} from your library`}
        >×</button>
      ) : null}
    </div>
  );
}
