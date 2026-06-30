// panels — DisarmPanel (Backlog 4.1). Migrated from panels.jsx (l.576). The
// "opposition instrument": documented weaponizations of a verse paired with the
// scholarly rebuttal. Collapsed claim⇄rebuttal one-liners that expand to a duel.
import React, { useState } from "react";
import { PaneHead, PanelStatus, RegenBtn, PanelMarkBtn, type CacheMeta, type PanelStatusState } from "./chrome.js";
import { LinkifyRefs } from "./LinkifyRefs.js";
import { savePanelEntryToNotes } from "./notes.js";
import { tx } from "./tx.js";
import type { Passage } from "./types.js";

export interface DisarmEntry {
  verse?: string;
  weaponization?: string;
  rebuttal?: string;
  quote?: string;
  source?: string;
  era?: string;
}

export interface DisarmData {
  entries: DisarmEntry[];
}

interface JumpWindow {
  codexJumpToRef?: (ref: string) => void;
}

export interface DisarmPanelProps {
  panelData: DisarmData | null;
  status: PanelStatusState;
  meta?: CacheMeta | null;
  passage: Passage;
  currentVerse?: number;
  onRegenerate: () => void;
}

export function DisarmPanel({ panelData, status, meta, passage, onRegenerate }: DisarmPanelProps): React.ReactElement {
  const title = tx("panel.disarm.head", "DISARM · WEAPONIZED READINGS");
  const emptyText = tx("panel.disarm.empty", "No weaponizations on record for this verse.");
  const [openPairs, setOpenPairs] = useState<Set<number>>(() => new Set());
  const togglePair = (i: number): void =>
    setOpenPairs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const jumpVerse = (v?: string): void => {
    const jump = (window as unknown as JumpWindow).codexJumpToRef;
    if (!v || !jump) return;
    const ref = String(v).includes(":") ? `${passage.book} ${v}` : `${passage.book} ${passage.chapter}:${v}`;
    jump(ref);
  };

  if (!panelData) {
    return (
      <div className="cx-pane">
        <PaneHead title={title} sub={`${passage.book} ${passage.chapter}`} />
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="disarm" />
      </div>
    );
  }
  const entries = Array.isArray(panelData.entries) ? panelData.entries : [];
  return (
    <div className="cx-pane">
      <PaneHead
        title={title}
        sub={`${passage.book} ${passage.chapter} · ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
        meta={meta}
        action={
          <span className="cx-pane-actions">
            <RegenBtn onClick={onRegenerate} />
          </span>
        }
      />
      <div className="cx-disarm-banner" role="note">
        ⚔ SCHOLARLY SURVEY · DOCUMENTED MISUSE + TEXTUAL REBUTTAL · NOT AN ENDORSEMENT
      </div>
      {entries.length === 0 ? (
        <div className="cx-disarm-empty">
          <span className="cx-disarm-empty-glyph" aria-hidden>
            ⚔
          </span>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="cx-disarm-field" role="list" aria-label="Opposition instrument — weaponizations vs rebuttals">
          {entries.map((e, i) => {
            const open = openPairs.has(i);
            const claim = e.weaponization || "Unlabeled claim";
            const rebut = e.rebuttal || "";
            return (
              <article key={i} role="listitem" className={`cx-disarm-pair ${open ? "is-open" : ""}`}>
                <div className="cx-disarm-pair-top">
                  {e.verse ? (
                    <button type="button" className="cx-disarm-vchip" title={`Jump to ${passage.book} ${e.verse}`} onClick={() => jumpVerse(e.verse)}>
                      {e.verse}
                    </button>
                  ) : (
                    <span className="cx-disarm-vchip is-static" aria-hidden>
                      —
                    </span>
                  )}
                  <button type="button" className="cx-disarm-pair-toggle" aria-expanded={open} onClick={() => togglePair(i)}>
                    <span className="cx-disarm-mini is-claim">{claim}</span>
                    <span className="cx-disarm-vs" aria-hidden>
                      ⇄
                    </span>
                    <span className="cx-disarm-mini is-rebut">{rebut || "no rebuttal on record"}</span>
                    <span className="cx-disarm-cue" aria-hidden>
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                </div>
                {open ? (
                  <div className="cx-disarm-duel">
                    <section className="cx-disarm-side is-weapon">
                      <span className="cx-disarm-side-lbl">WEAPONIZATION</span>
                      <h4 className="cx-disarm-claim">{claim}</h4>
                      {e.quote ? (
                        <blockquote className="cx-disarm-quote">
                          <span className="cx-disarm-quote-bar" aria-hidden />
                          <span className="cx-disarm-quote-text">{e.quote}</span>
                        </blockquote>
                      ) : null}
                      {e.source ? <div className="cx-disarm-source">{e.source}</div> : null}
                      {e.era ? <div className="cx-disarm-era">{e.era}</div> : null}
                    </section>
                    <span className="cx-disarm-thread" aria-hidden>
                      <i className="cx-disarm-thread-node is-a" />
                      <i className="cx-disarm-thread-node is-b" />
                    </span>
                    <section className="cx-disarm-side is-rebut">
                      <span className="cx-disarm-side-lbl">REBUTTAL · SCHOLARLY</span>
                      {rebut ? (
                        <p className="cx-disarm-rebut-body">
                          <LinkifyRefs text={rebut} />
                        </p>
                      ) : (
                        <p className="cx-disarm-rebut-body is-mute">No rebuttal transmitted for this entry.</p>
                      )}
                      <footer className="cx-disarm-foot">
                        <PanelMarkBtn
                          onClick={() =>
                            savePanelEntryToNotes({
                              kind: "Disarm",
                              ref: e.source,
                              heading: claim,
                              body: `${e.quote ? `“${e.quote}” — ${e.source || "unknown"}\n\n` : ""}REBUTTAL: ${rebut}`,
                              passage,
                            })
                          }
                        />
                      </footer>
                    </section>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
