// panels — GnosisPanel (Backlog 4.1). Migrated from panels.jsx (l.1556). The
// esoteric "resonance field": collapsible bands + an overlay engage toggle.
import React, { useState } from "react";
import { PaneHead, PanelStatus, RegenBtn, PanelMarkBtn } from "./chrome.js";
import { LinkifyRefs } from "./LinkifyRefs.js";
import { savePanelEntryToNotes } from "./notes.js";
import { pad } from "./util.js";
import { tx } from "./tx.js";
import type { PanelProps } from "./types.js";

interface NormieWindow {
  CODEX_NormieToggle?: React.ComponentType<{ text: string; scope: string }>;
}

export type GnosisPanelProps = PanelProps & {
  gnosisOn: boolean;
  onToggleGnosis: (on: boolean) => void;
};

export function GnosisPanel({
  panelData,
  status,
  meta,
  passage,
  gnosisOn,
  onToggleGnosis,
  onRegenerate,
}: GnosisPanelProps): React.ReactElement {
  const [openBands, setOpenBands] = useState<Set<number>>(() => new Set());
  const toggleBand = (i: number): void =>
    setOpenBands((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const readings = panelData && Array.isArray(panelData.gnosis) ? panelData.gnosis : [];
  const NormieToggle = (window as unknown as NormieWindow).CODEX_NormieToggle;

  return (
    <div className="cx-pane is-gnosis">
      <PaneHead
        title={tx("panel.gnosis.head", "GNOSIS · INTERPRETIVE OVERLAY")}
        sub={`Esoteric readings · ${passage.book} ${passage.chapter}`}
        meta={meta}
        action={panelData ? <RegenBtn onClick={onRegenerate} /> : null}
      />

      <div className="cx-gnosis-toggle">
        <div>
          <b>OVERLAY {gnosisOn ? "ENGAGED" : "DORMANT"}</b>
          <span>Adds Greek source-text inline, mystic glosses, and pleromic readings.</span>
        </div>
        <button className={`cx-gnosis-btn ${gnosisOn ? "is-on" : ""}`} onClick={() => onToggleGnosis(!gnosisOn)}>
          <span className="cx-gnosis-btn-dot" />
          {gnosisOn ? "DISENGAGE" : "ENGAGE"}
        </button>
      </div>

      {!panelData ? (
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="gnosis" />
      ) : readings.length === 0 ? (
        <div className="cx-gnosis-field is-empty">
          <span className="cx-gnosis-field-empty-glyph" aria-hidden>
            ⟁
          </span>
          <p>No esoteric readings on record for this passage.</p>
        </div>
      ) : (
        <div className="cx-gnosis-field" role="list" aria-label="Resonance field — esoteric readings">
          {readings.map((g, i) => {
            const open = openBands.has(i);
            const n = readings.length;
            const t = n > 1 ? i / (n - 1) : 0;
            const title = g.title || `READING · ${pad(i + 1)}`;
            return (
              <div key={i} role="listitem" className={`cx-gnosis-band ${open ? "is-open" : ""}`} style={{ ["--gn-t"]: t } as React.CSSProperties}>
                <button type="button" className="cx-gnosis-band-h" aria-expanded={open} onClick={() => toggleBand(i)}>
                  <span className="cx-gnosis-band-glow" aria-hidden />
                  <span className="cx-gnosis-band-sigil" aria-hidden>
                    {g.sigil || "⟁"}
                  </span>
                  <span className="cx-gnosis-band-title">{title}</span>
                  <span className="cx-gnosis-band-cue" aria-hidden>
                    {open ? "▾" : "▸"}
                  </span>
                </button>
                {open ? (
                  <div className="cx-gnosis-band-body">
                    {g.body ? (
                      <p>
                        <LinkifyRefs text={g.body} />
                      </p>
                    ) : (
                      <p className="cx-gnosis-band-mute">— no text transmitted for this reading —</p>
                    )}
                    {g.body && NormieToggle ? <NormieToggle text={g.body} scope="gnosis-card" /> : null}
                    <footer className="cx-gnosis-foot">
                      <PanelMarkBtn
                        onClick={() => savePanelEntryToNotes({ kind: "Gnosis", heading: title, body: g.body || "", tag: g.sigil, passage })}
                      />
                    </footer>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="cx-gnosis-warn">
        ⚠ INTERPRETIVE LAYER — engages mystic + perennial readings alongside the canonical text. Disengage to return to orthodox
        Christian commentary only.
      </div>
    </div>
  );
}
