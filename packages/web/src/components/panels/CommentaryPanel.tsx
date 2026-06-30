// panels — CommentaryPanel (Backlog 4.1). Migrated from panels.jsx (l.693).
// Groups Christian commentary by tradition + a collapsible cross-reference list.
import React from "react";
import { PaneHead, PanelStatus, RegenBtn, Collapsible, PanelMarkBtn } from "./chrome.js";
import { LinkifyRefs } from "./LinkifyRefs.js";
import { savePanelEntryToNotes } from "./notes.js";
import { tx } from "./tx.js";
import type { PanelProps } from "./types.js";

export function CommentaryPanel({
  panelData,
  status,
  meta,
  passage,
  onRegenerate,
  onJumpRef,
}: PanelProps & { onJumpRef?: (ref: string) => void }): React.ReactElement {
  if (!panelData) {
    return (
      <div className="cx-pane">
        <PaneHead title={tx("panel.commentary.head", "CHRISTIAN COMMENTARY")} sub={`${passage.book} ${passage.chapter}`} />
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="commentary" />
      </div>
    );
  }
  const groups = ["Patristic", "Reformation", "Modern", "Devotional"];
  const byGroup = groups
    .map((g) => ({
      group: g,
      items: panelData.commentary.filter((c) => (c.from || "").toLowerCase().startsWith(g.toLowerCase())),
    }))
    .filter((g) => g.items.length);

  return (
    <div className="cx-pane">
      <PaneHead
        title={tx("panel.commentary.head", "CHRISTIAN COMMENTARY")}
        sub="Patristic · Reformation · Modern · Devotional"
        meta={meta}
        action={<RegenBtn onClick={onRegenerate} />}
      />
      <div className="cx-comm-list">
        {byGroup.map(({ group, items }) => (
          <Collapsible key={group} defaultOpen title={<span className="cx-comm-grp">{group.toUpperCase()}</span>} count={items.length}>
            {items.map((c, i) => (
              <article key={i} className="cx-comm-card">
                <span className={`cx-comm-tag is-${group.toLowerCase()}`}>{group}</span>
                <h4>{c.author}</h4>
                <p>
                  <LinkifyRefs text={c.body} />
                </p>
                <footer className="cx-comm-foot">
                  <PanelMarkBtn
                    onClick={() => savePanelEntryToNotes({ kind: `Commentary · ${group}`, heading: c.author, body: c.body, passage })}
                  />
                </footer>
              </article>
            ))}
          </Collapsible>
        ))}
      </div>

      <Collapsible defaultOpen={false} title={<span className="cx-comm-grp">CROSS-REFERENCES</span>} count={panelData.crossRefs.length}>
        <ul className="cx-xref">
          {panelData.crossRefs.map((x, i) => (
            <li
              key={i}
              className={onJumpRef ? "is-clickable" : ""}
              onClick={() => onJumpRef && onJumpRef(x.ref)}
              title={onJumpRef ? `Jump to ${x.ref}` : undefined}
              role={onJumpRef ? "button" : undefined}
            >
              <b>{x.ref}</b>
              <span>{x.note}</span>
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}
