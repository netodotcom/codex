// panels — TalmudPanel (Backlog 4.1). Migrated from panels.jsx (l.514). Renders
// Talmudic parallels with per-card + expand-all collapse, ref linkification and
// save-to-notes.
import React, { useState } from "react";
import { PaneHead, PanelStatus, RegenBtn, Collapsible, PanelMarkBtn } from "./chrome.js";
import { LinkifyRefs } from "./LinkifyRefs.js";
import { savePanelEntryToNotes } from "./notes.js";
import { pad } from "./util.js";
import { tx } from "./tx.js";
import type { PanelProps } from "./types.js";

export function TalmudPanel({ panelData, status, meta, passage, onRegenerate }: PanelProps): React.ReactElement {
  const [allOpen, setAllOpen] = useState(true);
  if (!panelData) {
    return (
      <div className="cx-pane">
        <PaneHead title={tx("panel.talmud.head", "TALMUDIC PARALLELS")} sub={`${passage.book} ${passage.chapter}`} />
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="talmud" />
      </div>
    );
  }
  return (
    <div className="cx-pane">
      <PaneHead
        title={tx("panel.talmud.head", "TALMUDIC PARALLELS")}
        sub={`${passage.book} ${passage.chapter} · ${tx("panel.parallels", "{n} parallels").replace("{n}", String(panelData.talmud.length))}`}
        meta={meta}
        action={
          <span className="cx-pane-actions">
            <button
              className="cx-pane-toggle"
              onClick={() => setAllOpen((o) => !o)}
              title={allOpen ? tx("panel.collapseAll", "Collapse all parallels") : tx("panel.expandAll", "Expand all parallels")}
              aria-label={allOpen ? "Collapse all" : "Expand all"}
            >
              {allOpen ? "⊟" : "⊞"}
            </button>
            <RegenBtn onClick={onRegenerate} />
          </span>
        }
      />
      <div className="cx-talmud-list">
        {panelData.talmud.map((t, i) => (
          <Collapsible
            key={`${allOpen}-${i}`}
            defaultOpen={allOpen}
            title={
              <span className="cx-talmud-h-inner">
                <span className="cx-talmud-idx">תלמוד · {pad(i + 1)}</span>
                <span className="cx-talmud-heading">{t.heading}</span>
              </span>
            }
            sub={t.ref}
          >
            <article className="cx-talmud-card">
              <p>
                <LinkifyRefs text={t.body} />
              </p>
              <footer>
                <span className="cx-tag">{t.tag}</span>
                <PanelMarkBtn
                  onClick={() =>
                    savePanelEntryToNotes({ kind: "Talmud", ref: t.ref, heading: t.heading, body: t.body, tag: t.tag, passage })
                  }
                />
              </footer>
            </article>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
