// quest-messiah — QuestRunner component + launch helper (migrated from
// quest-messiah.jsx). DOM output is byte-for-intent identical to the legacy IIFE.
// React.createElement is the JSX factory (vitest.config jsxFactory setting).
import React from "react";
import { CARDS } from "./data.js";
import type { QuestProgress } from "./data.js";
import {
  groupBySection,
  expandRefs,
  emitDepth,
  emitQuestStep,
  loadProgress,
  saveProgress,
} from "./helpers.js";
import { qmw } from "./quest-messiah-window.js";

const { useState, useEffect } = React;

interface RefLinkProps {
  children: React.ReactNode;
  onAfterJump: () => void;
}

function RefLink({ children, onAfterJump }: RefLinkProps): React.ReactElement {
  const ref = String(children).trim();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const jump = qmw().codexJumpToRef;
    if (jump) jump(ref);
    if (typeof onAfterJump === "function") onAfterJump();
  };
  return (
    <a
      className="cx-q-ref"
      href="#"
      onClick={onClick}
      title={`Open ${ref} in the reader (closes tour — re-open from QUESTS to resume)`}
    >
      {ref}
    </a>
  );
}

interface RefListProps {
  refs: string;
  onAfterJump: () => void;
}

function RefList({ refs, onAfterJump }: RefListProps): React.ReactElement {
  const list = expandRefs(refs);
  return (
    <span className="cx-q-reflist">
      {list.flatMap((r, i) =>
        i === 0
          ? [<RefLink key={i} onAfterJump={onAfterJump}>{r}</RefLink>]
          : [
              <span key={`s${i}`} className="cx-q-sep"> · </span>,
              <RefLink key={i} onAfterJump={onAfterJump}>{r}</RefLink>,
            ]
      )}
    </span>
  );
}

interface QuestRunnerProps {
  onClose: () => void;
}

function QuestRunner({ onClose }: QuestRunnerProps): React.ReactElement | null {
  const [progress, setProgress] = useState<QuestProgress>(loadProgress);
  const [idx, setIdx] = useState<number>(progress.lastIdx ?? 0);
  const [debateOpen, setDebateOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(() => new Set<string>());
  // Sidebar visibility — defaults open on desktop, closed as a drawer on
  // mobile/tablet. Tracked alongside live viewport width so the scrim
  // mounts correctly when the user resizes across the 880px breakpoint
  // (otherwise the initial useState snapshot is stale on resize).
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 880);
  const [vw, setVw] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Persist progress whenever idx changes
  useEffect(() => { saveProgress({ ...progress, lastIdx: idx }); }, [idx]);

  const card = CARDS[idx];
  if (!card) return null;

  const groups = groupBySection(CARDS);
  const studiedSet = new Set(progress.studied);
  const isStudied = studiedSet.has(card.id);

  const toggleStudied = () => {
    const next = new Set(studiedSet);
    const willStudy = !next.has(card.id);
    if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
    const np: QuestProgress = { ...progress, studied: [...next], lastIdx: idx };
    setProgress(np); saveProgress(np);
    // Depth-gated: only marking a prophecy studied advances engagement.
    if (willStudy) {
      emitDepth("quest-step", card.ot_reference || card.id, 3, "canon-coverage");
      const done = next.size;
      emitQuestStep(done, done >= CARDS.length ? "complete" : "active");
    }
  };
  const goNext = () => { if (idx < CARDS.length - 1) setIdx(i => i + 1); };
  const goPrev = () => { if (idx > 0) setIdx(i => i - 1); };
  const toggleSection = (s: string) => {
    const next = new Set(collapsed);
    if (next.has(s)) next.delete(s); else next.add(s);
    setCollapsed(next);
  };

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [idx]);

  const studiedCount = progress.studied.length;
  const isFinal = idx === CARDS.length - 1 && isStudied && studiedCount === CARDS.length;

  return (
    <div
      className={`cx-q-overlay ${sidebarOpen ? "is-side-open" : ""}`}
      role="dialog"
      aria-label="Side quest · Messiah in Prophecy"
    >
      {/* Header strip */}
      <header className="cx-q-head">
        <button
          className="cx-q-side-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label={sidebarOpen ? "Hide index" : "Show index"}
          title="Toggle index (≡)"
        >≡</button>
        <span className="cx-q-tag">SIDE QUEST</span>
        <h2 className="cx-q-title-bar">
          <span className="cx-q-title-full">Messiah in Prophecy · 50 Core Prophecies</span>
          <span className="cx-q-title-short">Messiah · 50</span>
        </h2>
        <span className="cx-q-progress">{studiedCount} / {CARDS.length}</span>
        <button
          className="cx-q-close"
          onClick={onClose}
          aria-label="Close tour (Esc)"
          title="Close tour · Esc"
        >✕</button>
      </header>

      {/* Mobile/tablet sidebar scrim — covers main content while drawer is open */}
      {sidebarOpen && vw < 880 ? (
        <div className="cx-q-scrim" onClick={() => setSidebarOpen(false)} />
      ) : null}

      {/* Body grid */}
      <div className="cx-q-body">
        {/* Left sidebar */}
        <nav
          className={`cx-q-sidebar ${sidebarOpen ? "is-open" : ""}`}
          aria-label="Prophecy index"
        >
          {groups.map((g, gi) => (
            <section
              key={gi}
              className={`cx-q-sect ${collapsed.has(g.section) ? "is-collapsed" : ""}`}
            >
              <button
                className="cx-q-sect-h"
                onClick={() => toggleSection(g.section)}
                aria-expanded={!collapsed.has(g.section)}
              >
                <span className="cx-q-sect-arr">{collapsed.has(g.section) ? "▸" : "▾"}</span>
                <span className="cx-q-sect-name">{g.section}</span>
                <span className="cx-q-sect-count">{g.cards.length}</span>
              </button>
              {!collapsed.has(g.section) ? (
                <ul className="cx-q-list">
                  {g.cards.map(c => {
                    const cIdx = CARDS.indexOf(c);
                    const studied = studiedSet.has(c.id);
                    const active = cIdx === idx;
                    return (
                      <li key={c.id}>
                        <button
                          className={`cx-q-item ${active ? "is-active" : ""} ${studied ? "is-studied" : ""}`}
                          onClick={() => {
                            setIdx(cIdx);
                            if (vw < 880) setSidebarOpen(false);
                          }}
                        >
                          <span className="cx-q-item-n">{String(c.number).padStart(2, "0")}</span>
                          <span className="cx-q-item-title">{c.title}</span>
                          <span className="cx-q-item-ref">{c.ot_reference.split(";")[0] ?? ""}</span>
                          {studied ? <span className="cx-q-item-check">✓</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ))}
        </nav>

        {/* Main panel */}
        <main className="cx-q-main">
          {isFinal ? (
            <div className="cx-q-completion">
              <h1>Tour Complete</h1>
              <p>You have now studied all 50 core messianic prophecies with their fulfillments and supporting Talmudic references. You are equipped to engage any discussion on the Messiah with clarity and textual depth.</p>
              <button className="cx-q-return" onClick={onClose}>Return to Library</button>
            </div>
          ) : null}
          <article className="cx-q-card">
            <header className="cx-q-card-h">
              <span className="cx-q-card-num">{String(card.number).padStart(2, "0")}</span>
              <span className="cx-q-card-section">{card.section}</span>
            </header>
            <h1 className="cx-q-card-title">{card.title}</h1>
            <div className="cx-q-card-refs">
              <div className="cx-q-card-ref-row">
                <span className="cx-q-ref-label">OT</span>
                <RefList refs={card.ot_reference} onAfterJump={onClose} />
              </div>
              <div className="cx-q-card-ref-row">
                <span className="cx-q-ref-label">NT</span>
                <RefList refs={card.nt_reference} onAfterJump={onClose} />
              </div>
              {card.talmud_references && card.talmud_references.length ? (
                <div className="cx-q-card-ref-row">
                  <span className="cx-q-ref-label">Talmud</span>
                  <span className="cx-q-talmud">{card.talmud_references.join(" · ")}</span>
                </div>
              ) : null}
            </div>
            <p className="cx-q-card-commentary">{card.commentary}</p>
          </article>

          {/* Debate Ready panel */}
          <section className={`cx-q-debate ${debateOpen ? "is-open" : ""}`}>
            <button className="cx-q-debate-toggle" onClick={() => setDebateOpen(o => !o)}>
              <span className="cx-q-debate-arr">{debateOpen ? "▾" : "▸"}</span>
              Debate Ready
            </button>
            {debateOpen ? (
              <div className="cx-q-debate-body">
                <div className="cx-q-debate-block">
                  <h4>Common objection</h4>
                  <p>{card.common_objection}</p>
                </div>
                <div className="cx-q-debate-block is-comeback">
                  <h4>Comeback</h4>
                  <p>{card.comeback}</p>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>

      {/* Bottom nav */}
      <footer className="cx-q-foot">
        <button className="cx-q-nav cx-q-prev" onClick={goPrev} disabled={idx === 0}>
          {"← Previous"}
        </button>
        <button
          className={`cx-q-nav cx-q-mark ${isStudied ? "is-on" : ""}`}
          onClick={toggleStudied}
        >
          {isStudied ? "✓ Studied · click to unmark" : "Mark as Studied"}
        </button>
        <button
          className="cx-q-nav cx-q-next"
          onClick={goNext}
          disabled={idx === CARDS.length - 1}
        >
          {"Next →"}
        </button>
      </footer>
    </div>
  );
}

export { QuestRunner };

export function launch(): void {
  let host: HTMLElement | null = document.getElementById("cx-quest-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "cx-quest-host";
    document.body.appendChild(host);
  }
  const hostEl = host;
  const root = qmw().ReactDOM!.createRoot(hostEl);
  const close = () => { root.unmount(); hostEl.remove(); };
  root.render(React.createElement(QuestRunner, { onClose: close }));
}
