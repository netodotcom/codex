// reader — side quests button (migrated from components.jsx). Opens a portaled
// dropdown listing gamified study plans registered at runtime via
// window.CODEX_QUESTS. Empty by default with an explainer.
import React from "react";
import { rw } from "./reader-window.js";

const { useState, useEffect, useRef } = React;

export function SideQuestsButton(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const quests = rw().CODEX_QUESTS || [];
  const ReactDOM = rw().ReactDOM;

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const menuW = Math.min(360, window.innerWidth - 24);
    let left = r.left;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    setPos({ top: r.bottom + 8, left });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = (
    <div className="cx-sq-menu" role="dialog" ref={menuRef} style={{ top: pos.top + "px", left: pos.left + "px" }}>
      <header className="cx-sq-h">
        <span className="cx-sq-tag">SIDE · QUESTS</span>
      </header>
      {quests.length === 0 ? (
        <div className="cx-sq-empty">
          <p className="cx-sq-empty-h">No quests installed yet.</p>
          <p className="cx-sq-empty-sub">
            Side quests are guided, gamified study plans — short tours of a book, a doctrine, a translation comparison. They steer you
            through the app step-by-step, like a missionary chaplain walking you through scripture.
          </p>
          <p className="cx-sq-empty-foot">Bring a quest prompt and I'll install it here.</p>
        </div>
      ) : (
        <ul className="cx-sq-list">
          {quests.map((q) => (
            <li key={q.id} className="cx-sq-item">
              <button
                className="cx-sq-card"
                onClick={() => {
                  setOpen(false);
                  q.run?.();
                }}
              >
                <span className="cx-sq-card-glyph">{q.glyph || "✦"}</span>
                <div className="cx-sq-card-body">
                  <b>{q.title}</b>
                  {q.blurb ? <i>{q.blurb}</i> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <span className="cx-sq" ref={ref}>
      <button
        className={`cx-sq-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Side quests · gamified study plans"
        aria-label="Side quests"
        aria-expanded={open}
      >
        <span className="cx-sq-glyph">⚔</span>
        <span className="cx-sq-lbl">QUESTS</span>
      </button>
      {open && ReactDOM?.createPortal ? ReactDOM.createPortal(menu, document.body) : null}
    </span>
  );
}
