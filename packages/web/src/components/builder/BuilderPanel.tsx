// builder — the STUDIES panel (migrated from builder.jsx). A clipboard-meets-
// outline tool for sermon prep: named sections of verses/notes/panel-excerpts/
// cross-refs, drag-reorder, file/URL import, and Markdown/PDF/JSON/share export.
import React from "react";
import { loadStore, saveStore, makeEmptyStudy, uid, importStudyObject, type Study, type StudyItem, type StudyStore } from "./store.js";
import { formatRef, studyToMarkdown } from "./markdown.js";
import { download, emitDepth, shareUrlFor } from "./helpers.js";
import { bw } from "./builder-window.js";

const { useState, useEffect, useCallback, useRef } = React;

export interface PanelCtx {
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

type DragState = { kind: "section"; sid: string } | { kind: "item"; sid: string; idx: number } | null;

export function BuilderPanel(ctx: PanelCtx): React.ReactElement {
  const [store, setStore] = useState<StudyStore>(() => loadStore());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  // Listen for external changes (event-driven appends).
  useEffect(() => {
    const h = (): void => setStore(loadStore());
    window.addEventListener("codex:studies-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("codex:studies-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const update = useCallback((mutator: (next: StudyStore) => void): void => {
    setStore((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as StudyStore;
      mutator(next);
      saveStore(next);
      return next;
    });
  }, []);

  const active = store.studies.find((s) => s.id === store.activeStudyId) || null;

  // ── Study CRUD ──
  const newStudy = (): void =>
    update((s) => {
      const st = makeEmptyStudy(`Study ${s.studies.length + 1}`);
      s.studies.push(st);
      s.activeStudyId = st.id;
    });
  const switchTo = (id: string): void =>
    update((s) => {
      s.activeStudyId = id;
    });
  const deleteStudy = (id: string): void => {
    if (!confirm("Delete this study? This can't be undone.")) return;
    update((s) => {
      s.studies = s.studies.filter((x) => x.id !== id);
      if (s.activeStudyId === id) {
        const first = s.studies[0];
        s.activeStudyId = first ? first.id : null;
      }
    });
  };
  const renameStudy = (id: string, title: string): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === id);
      if (st) {
        st.title = title;
        st.modified = Date.now();
      }
    });

  // ── Section / item ops ──
  const addSection = (): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      const n = st.sections.length + 1;
      const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n - 1] || String(n);
      st.sections.push({ id: uid("section"), heading: `${roman}. `, items: [] });
      st.modified = Date.now();
    });
  const removeSection = (sid: string): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      st.sections = st.sections.filter((x) => x.id !== sid);
      st.modified = Date.now();
    });
  const renameSection = (sid: string, heading: string): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) {
        sec.heading = heading;
        if (st) st.modified = Date.now();
      }
    });
  const addNote = (sid: string): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) {
        sec.items.push({ type: "note", body: "New note — click to edit", _id: uid("item") });
        if (st) st.modified = Date.now();
      }
    });
  const addVerseFromContext = (sid: string): void => {
    if (!ctx || !ctx.bookId || !ctx.chapter) {
      try {
        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "No active verse — tap a verse in the reader first.", kind: "warn" } }));
      } catch {
        /* ignore */
      }
      return;
    }
    const v = ctx.verse || 1;
    let text = "";
    const translation = ctx.translation || "kjv";
    try {
      const bible = bw().BIBLE;
      if (bible && typeof bible.getCachedChapter === "function") {
        const ch = bible.getCachedChapter(ctx.bookId, ctx.chapter, translation);
        if (ch && Array.isArray(ch.verses)) {
          const vv = ch.verses.find((x) => x.n === v);
          if (vv) text = (((vv as Record<string, unknown>)[translation] as string) || vv.text || "").trim();
        }
      }
    } catch {
      /* ignore */
    }
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) {
        sec.items.push({ type: "verse", ref: `${ctx.bookId}.${ctx.chapter}.${v}`, text, translation, _id: uid("item") });
        if (st) st.modified = Date.now();
      }
    });
  };
  const removeItem = (sid: string, idx: number): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      if (sec) {
        sec.items.splice(idx, 1);
        if (st) st.modified = Date.now();
      }
    });
  const editItem = (sid: string, idx: number, patch: Partial<StudyItem>): void =>
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      const sec = st && st.sections.find((x) => x.id === sid);
      const it = sec && sec.items[idx];
      if (sec && it) {
        Object.assign(it, patch);
        if (st) st.modified = Date.now();
      }
    });

  // ── Drag and drop reordering ──
  const dragRef = useRef<DragState>(null);
  const onSectionDragStart = (sid: string) => (e: React.DragEvent): void => {
    dragRef.current = { kind: "section", sid };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", sid);
    } catch {
      /* ignore */
    }
  };
  const onSectionDrop = (targetSid: string) => (e: React.DragEvent): void => {
    e.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.kind !== "section" || drag.sid === targetSid) return;
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      const from = st.sections.findIndex((x) => x.id === drag.sid);
      const to = st.sections.findIndex((x) => x.id === targetSid);
      if (from < 0 || to < 0) return;
      const [m] = st.sections.splice(from, 1);
      st.sections.splice(to, 0, m as Study["sections"][number]);
      st.modified = Date.now();
    });
  };
  const onItemDragStart = (sid: string, idx: number) => (e: React.DragEvent): void => {
    e.stopPropagation();
    dragRef.current = { kind: "item", sid, idx };
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", `${sid}:${idx}`);
    } catch {
      /* ignore */
    }
  };
  const onItemDrop = (targetSid: string, targetIdx: number) => (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.kind !== "item") return;
    update((s) => {
      const st = s.studies.find((x) => x.id === s.activeStudyId);
      if (!st) return;
      const fromSec = st.sections.find((x) => x.id === drag.sid);
      const toSec = st.sections.find((x) => x.id === targetSid);
      if (!fromSec || !toSec) return;
      const [m] = fromSec.items.splice(drag.idx, 1);
      if (!m) return;
      const idx = Math.min(targetIdx, toSec.items.length);
      toSec.items.splice(idx, 0, m);
      st.modified = Date.now();
    });
  };
  const allowDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // ── File drop import ──
  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;
    const over = (e: DragEvent): void => {
      e.preventDefault();
      el.classList.add("cx-builder-dropactive");
    };
    const leave = (): void => el.classList.remove("cx-builder-dropactive");
    const drop = async (e: DragEvent): Promise<void> => {
      e.preventDefault();
      leave();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text);
        if (importStudyObject(obj)) setStore(loadStore());
        else {
          try {
            window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "That file isn't a CODEX study", kind: "warn" } }));
          } catch {
            /* ignore */
          }
        }
      } catch {
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Couldn't parse that file", kind: "err" } }));
        } catch {
          /* ignore */
        }
      }
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }, []);

  // ── Exports ──
  const exportMd = (): void => {
    if (active) {
      download(`${(active.title || "study").replace(/[^\w\-]+/g, "_")}.md`, studyToMarkdown(active), "text/markdown");
      emitDepth("study-built", active.id, 5);
    }
  };
  const exportJson = (): void => {
    if (active) {
      download(`${(active.title || "study").replace(/[^\w\-]+/g, "_")}.codex-study`, JSON.stringify(active, null, 2), "application/json");
      emitDepth("study-built", active.id, 5);
    }
  };
  const exportPdf = (): void => {
    if (!active) return;
    emitDepth("study-built", active.id, 5);
    document.body.classList.add("cx-builder-printing");
    const cleanup = (): void => document.body.classList.remove("cx-builder-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => window.print(), 50);
  };
  const copyMd = async (): Promise<void> => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(studyToMarkdown(active));
      try {
        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Copied as Markdown", kind: "ok" } }));
      } catch {
        /* ignore */
      }
    } catch {
      try {
        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Clipboard not available", kind: "err" } }));
      } catch {
        /* ignore */
      }
    }
  };
  const share = async (): Promise<void> => {
    if (!active) return;
    const url = shareUrlFor(active);
    const nav = navigator as Navigator & { share?: (data: { title?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: active.title, url });
        return;
      } catch {
        /* ignore */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      try {
        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Share URL copied to clipboard", kind: "ok" } }));
      } catch {
        /* ignore */
      }
    } catch {
      prompt("Share URL:", url);
    }
  };

  // ── Render ──
  return (
    <div className="cx-builder">
      <header className="cx-builder-hdr">
        <div className="cx-builder-titlerow">
          <span className="cx-builder-glyph">❡</span>
          <b>STUDIES</b>
          <button className="cx-builder-btn" onClick={newStudy} title="New study">
            + New
          </button>
          <button className="cx-builder-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()} title="Import a .codex-study file">
            ⇡ Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".codex-study,application/json,.json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (!f) return;
              try {
                const obj = JSON.parse(await f.text());
                if (importStudyObject(obj)) {
                  setStore(loadStore());
                  try {
                    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Study imported", kind: "ok" } }));
                  } catch {
                    /* ignore */
                  }
                } else {
                  try {
                    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "That file isn't a CODEX study", kind: "warn" } }));
                  } catch {
                    /* ignore */
                  }
                }
              } catch {
                try {
                  window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Couldn't parse that file", kind: "err" } }));
                } catch {
                  /* ignore */
                }
              }
            }}
          />
        </div>
        <div className="cx-builder-studylist">
          {store.studies.length === 0 ? (
            <div className="cx-builder-empty">
              No studies yet. Tap <b>+ New</b> to start.
            </div>
          ) : (
            store.studies.map((s) => (
              <div key={s.id} className={`cx-builder-studyrow ${s.id === store.activeStudyId ? "is-active" : ""}`}>
                <button className="cx-builder-studybtn" onClick={() => switchTo(s.id)} title={`Switched to ${s.title}`}>
                  <span className="cx-builder-studytitle">{s.title}</span>
                  <span className="cx-builder-studymeta">
                    {s.sections.length} sec · {s.sections.reduce((n, x) => n + x.items.length, 0)} items
                  </span>
                </button>
                <button className="cx-builder-del" onClick={() => deleteStudy(s.id)} title="Delete study">
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </header>

      <div className="cx-builder-active" ref={dropZoneRef}>
        {!active ? (
          <div className="cx-builder-empty">
            Drop a <code>.codex-study</code> file here, or create a new study above.
          </div>
        ) : (
          <>
            <input className="cx-builder-title-input" value={active.title} onChange={(e) => renameStudy(active.id, e.target.value)} placeholder="Study title" />

            {active.sections.map((sec) => (
              <section
                key={sec.id}
                className="cx-builder-section"
                draggable
                onDragStart={onSectionDragStart(sec.id)}
                onDragOver={allowDrop}
                onDrop={onSectionDrop(sec.id)}
              >
                <div className="cx-builder-sechead">
                  <span className="cx-builder-grip" title="Drag to reorder section">
                    ⋮⋮
                  </span>
                  <input className="cx-builder-heading-input" value={sec.heading} onChange={(e) => renameSection(sec.id, e.target.value)} placeholder="Section heading" />
                  <button className="cx-builder-del" onClick={() => removeSection(sec.id)} title="Remove section">
                    ×
                  </button>
                </div>

                <ul className="cx-builder-items">
                  {sec.items.length === 0 ? (
                    <li className="cx-builder-empty cx-builder-itemempty" onDragOver={allowDrop} onDrop={onItemDrop(sec.id, 0)}>
                      Empty — drop items here, or use the buttons below.
                    </li>
                  ) : (
                    sec.items.map((it, idx) => (
                      <li
                        key={it._id || idx}
                        className={`cx-builder-item cx-builder-item--${it.type}`}
                        draggable
                        onDragStart={onItemDragStart(sec.id, idx)}
                        onDragOver={allowDrop}
                        onDrop={onItemDrop(sec.id, idx)}
                      >
                        <span className="cx-builder-grip" title="Drag to reorder">
                          ⋮⋮
                        </span>
                        <div className="cx-builder-itembody">
                          {it.type === "verse" && (
                            <>
                              <span className="cx-builder-refbadge">{formatRef(it.ref)}</span>
                              {it.translation ? <span className="cx-builder-trbadge">{String(it.translation).toUpperCase()}</span> : null}
                              <div className="cx-builder-verse-text">{it.text || <em>(no text)</em>}</div>
                            </>
                          )}
                          {it.type === "note" && (
                            <textarea
                              className="cx-builder-note"
                              value={it.body || ""}
                              onChange={(e) => editItem(sec.id, idx, { body: e.target.value })}
                              placeholder="Note…"
                              rows={Math.min(8, Math.max(2, String(it.body || "").split("\n").length))}
                            />
                          )}
                          {it.type === "panel" && (
                            <>
                              <span className="cx-builder-kindbadge">{it.kind || "Panel"}</span>
                              {it.source ? <span className="cx-builder-srcbadge">{formatRef(it.source)}</span> : null}
                              <div className="cx-builder-panel-text">{it.body}</div>
                            </>
                          )}
                          {it.type === "crossref" && (
                            <>
                              <span className="cx-builder-refbadge">↗ {formatRef(it.ref)}</span>
                              <input
                                className="cx-builder-xrefnote"
                                value={it.note || ""}
                                onChange={(e) => editItem(sec.id, idx, { note: e.target.value })}
                                placeholder="(note)"
                              />
                            </>
                          )}
                        </div>
                        <button className="cx-builder-del" onClick={() => removeItem(sec.id, idx)} title="Remove item">
                          ×
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="cx-builder-sectools">
                  <button className="cx-builder-btn" onClick={() => addNote(sec.id)}>
                    + Note
                  </button>
                  <button className="cx-builder-btn" onClick={() => addVerseFromContext(sec.id)} title="Add the current verse from the reader">
                    + Verse from current
                  </button>
                </div>
              </section>
            ))}

            <div className="cx-builder-addsec">
              <button className="cx-builder-btn" onClick={addSection}>
                + Section
              </button>
            </div>

            <footer className="cx-builder-foot">
              <div className="cx-builder-exportrow">
                <button className="cx-builder-btn" onClick={exportMd} title="Download Markdown">
                  ⇣ Markdown
                </button>
                <button className="cx-builder-btn" onClick={exportPdf} title="Print to PDF">
                  ⇣ PDF
                </button>
                <button className="cx-builder-btn" onClick={copyMd} title="Copy as Markdown">
                  ⧉ Copy
                </button>
                <button className="cx-builder-btn" onClick={share} title="Share URL">
                  ↗ Share
                </button>
                <button className="cx-builder-btn" onClick={exportJson} title="Export .codex-study">
                  ⇣ .codex-study
                </button>
              </div>
              <div className="cx-builder-hint">
                Add verses via the verse menu’s <b>Add to Study</b>, or drop a <code>.codex-study</code> file onto this panel to import.
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
