// marks-plugin — MarksX panel component (migrated verbatim from
// marks-plugin.jsx v10 — THE MARKS). DOM output, event listeners, and control
// flow are byte-for-intent identical to the legacy IIFE. Behaviour preserved:
//   · pinned marks float to the top under a ⌖ PINNED divider
//   · each mark: colour bar · ref label · first-words note · age
//   · ⌖ pin/unpin and × forget — inline, one gesture deep
//   · live: re-reads on every codex:marks-changed and storage event
//   · ✦ MARK button marks/unmarks the current CODEX_NOW position
import React from "react";
import {
  marksLoad,
  marksPins,
  marksSave,
  marksSavePins,
  marksAgo,
  hueColor,
} from "./helpers.js";
import type { MarkEntry } from "./helpers.js";
import { mw } from "./marks-window.js";

const { useState, useEffect } = React;

interface MarkRow extends MarkEntry {
  key: string;
  label: string;
  pinned: boolean;
}

export function MarksX(): React.ReactElement {
  const [map, setMap] = useState<Record<string, MarkEntry>>(marksLoad);
  const [pins, setPins] = useState<Set<string>>(marksPins);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const reload = (): void => {
      setMap(marksLoad());
      setPins(marksPins());
    };
    window.addEventListener("codex:marks-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("codex:marks-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const books = mw().CODEX_DATA?.books ?? [];

  const labelOf = (key: string): string => {
    const parts = key.split(".");
    const bookId = parts[0] ?? "";
    const ch = parts[1] ?? "";
    const v = parts[2] ?? "";
    const b = books.find((x) => x.id === bookId);
    return `${(b && b.name) || bookId} ${ch}:${v}`;
  };

  const rows: MarkRow[] = Object.entries(map)
    .map(([key, m]) => ({ key, label: labelOf(key), ...m, pinned: pins.has(key) }))
    .filter(
      (r) =>
        !filter ||
        r.label.toLowerCase().includes(filter.toLowerCase()) ||
        (r.note || "").toLowerCase().includes(filter.toLowerCase()),
    )
    .sort(
      (a, b) =>
        ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) ||
        ((b.ts || 0) - (a.ts || 0)),
    );

  const pinnedRows = rows.filter((r) => r.pinned);
  const restRows = rows.filter((r) => !r.pinned);

  const jump = (r: MarkRow): void => {
    mw().codexJumpToRef?.(r.label);
  };

  const togglePin = (r: MarkRow): void => {
    const next = new Set(pins);
    if (next.has(r.key)) next.delete(r.key);
    else next.add(r.key);
    setPins(next);
    marksSavePins(next);
  };

  const forget = (r: MarkRow): void => {
    const next: Record<string, MarkEntry> = { ...map };
    delete next[r.key];
    setMap(next);
    marksSave(next);
    if (pins.has(r.key)) {
      const np = new Set(pins);
      np.delete(r.key);
      setPins(np);
      marksSavePins(np);
    }
  };

  const renderRow = (r: MarkRow): React.ReactElement => (
    <div key={r.key} className="cxm-row" role="listitem">
      <span
        className="cxm-bar"
        style={{ background: hueColor(r.color) }}
        aria-hidden={true}
      />
      <button className="cxm-go" onClick={() => jump(r)} title={`Read ${r.label}`}>
        <b>{r.label}</b>
        {r.note ? <span>{r.note}</span> : null}
      </button>
      <span className="cxm-age">{marksAgo(r.ts)}</span>
      <button
        className={`cxm-pin ${r.pinned ? "is-on" : ""}`}
        onClick={() => togglePin(r)}
        aria-pressed={r.pinned}
        title={r.pinned ? "Unpin" : "Pin to the top"}
      >
        ⌖
      </button>
      <button
        className="cxm-x"
        onClick={() => forget(r)}
        aria-label={`Forget ${r.label}`}
        title="Forget this mark"
      >
        ×
      </button>
    </div>
  );

  return (
    <div className="cxm">
      <div className="cxm-head">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${rows.length} mark${rows.length === 1 ? "" : "s"}…`}
          aria-label="Filter marks"
          spellCheck={false}
        />
        <button
          className="cxm-add"
          title="Mark the current verse"
          onClick={() => {
            const n = mw().CODEX_NOW;
            if (!n || !n.bookId) return;
            const key = `${n.bookId}.${n.chapter}.${n.verse || 1}`;
            const next = { ...marksLoad() };
            if (next[key]) delete next[key];
            else
              next[key] = {
                color: mw().CODEX_DATA?.tweaks?.highlightColor || "amber",
                ts: Date.now(),
                note: "",
              };
            setMap(next);
            marksSave(next);
          }}
        >
          ✦ MARK {mw().CODEX_NOW?.ref || "HERE"}
        </button>
      </div>
      <div className="cxm-scroll" role="list" aria-label="Your marks">
        {pinnedRows.length ? <h3 className="cxm-h">⌖ PINNED</h3> : null}
        {pinnedRows.map(renderRow)}
        {pinnedRows.length && restRows.length ? (
          <h3 className="cxm-h">EVERYTHING</h3>
        ) : null}
        {restRows.map(renderRow)}
        {!rows.length ? (
          <div className="cxm-empty">
            <span aria-hidden={true}>✦</span>
            <p>
              No marks yet. Tap a verse number in the reader, or ✦ MARK above —
              your trail through the text starts here.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
