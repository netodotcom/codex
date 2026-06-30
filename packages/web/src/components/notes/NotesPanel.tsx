// notes — React components migrated faithfully from notes.jsx.
// NotesResizeGrip and Notes are both exported; index.tsx assigns Notes to window.
// The component uses ReactDOM.createPortal via the window boundary (CDN ReactDOM)
// exactly as the legacy did. No logic, class names, or strings have been changed.
import React, { useState, useEffect, useRef } from "react";
import {
  NOTES_KEY,
  NOTES_DRAFT,
  NOTES_POS,
  NOTES_VIS,
  NOTES_LIST_OP,
  loadNotes,
  saveNotes,
  formatTs,
  isPosition,
} from "./helpers.js";
import type { SavedNote, NotePosition } from "./helpers.js";
import { nw, ntx } from "./notes-window.js";

// ── NotesResizeGrip · top-left corner of the notes panel ────────────────────
// Notes is anchored bottom-right; grip drags to resize width + height.
// Persists to codex.notes.size for next session.

interface NotesResizeGripProps {
  wrapRef: { current: HTMLElement | null };
}

function NotesResizeGrip({ wrapRef }: NotesResizeGripProps): React.ReactElement {
  const onDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = wrapRef.current;
    if (!el) return;
    const startRect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    document.body.classList.add("cx-resizing");
    const onMove = (m: MouseEvent): void => {
      // Top-left grip moves cursor up/left → grow. Compute deltas accordingly.
      const dx = startX - m.clientX;   // dragging left grows the panel right→left
      const dy = startY - m.clientY;   // dragging up grows upward
      const nextW = Math.max(240, Math.min(window.innerWidth - 32, startRect.width + dx));
      const nextH = Math.max(160, Math.min(window.innerHeight - 32, startRect.height + dy));
      el.style.width = nextW + "px";
      el.style.height = nextH + "px";
    };
    const onUp = (): void => {
      document.body.classList.remove("cx-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      try {
        const r = el.getBoundingClientRect();
        localStorage.setItem(
          "codex.notes.size",
          JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }),
        );
      } catch {}
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Restore persisted size once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("codex.notes.size");
      const s: unknown = raw ? JSON.parse(raw) : null;
      if (s && typeof s === "object" && !Array.isArray(s)) {
        const so = s as { w?: unknown; h?: unknown };
        const el = wrapRef.current;
        if (el) {
          if (typeof so["w"] === "number") el.style.width = so["w"] + "px";
          if (typeof so["h"] === "number") el.style.height = so["h"] + "px";
        }
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cx-notes-grip" onMouseDown={onDown} title="Drag to resize" aria-label="Resize notes" />
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

interface Passage {
  bookId?: string;
  chapter?: number | string;
  book?: string;
  [key: string]: unknown;
}

export interface NotesProps {
  passage?: Passage;
  currentVerse?: number;
  onJumpTo?: (args: { ref: string }) => void;
  onDisable?: () => void;
}

export function Notes({ passage, currentVerse, onJumpTo, onDisable }: NotesProps): React.ReactElement | null {
  const [visible, setVisible] = useState<boolean>(() => {
    try { return (localStorage.getItem(NOTES_VIS) ?? "1") !== "0"; } catch { return true; }
  });
  const [draft, setDraft] = useState<string>(() => {
    try { return localStorage.getItem(NOTES_DRAFT) || ""; } catch { return ""; }
  });
  const [notes, setNotes] = useState<SavedNote[]>(loadNotes);
  const [listOpen, setListOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(NOTES_LIST_OP) === "1"; } catch { return false; }
  });
  // Transient substring filter — not persisted.
  const [filter, setFilter] = useState<string>("");
  const [fmtOpen, setFmtOpen] = useState<boolean>(false);

  const wrapRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ dragging: boolean }>({ dragging: false });
  const offsetRef = useRef<NotePosition | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Format helpers ──────────────────────────────────────────────────────────
  // Wrap or insert markdown around the textarea selection. Restores
  // selection after so the user can keep typing.
  const wrapSelection = (before: string, after: string = before, placeholder: string = ""): void => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? start;
    const sel = draft.slice(start, end) || placeholder;
    const next = draft.slice(0, start) + before + sel + after + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  };

  const linePrefix = (prefix: string): void => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    // find start of line
    const lineStart = draft.lastIndexOf("\n", start - 1) + 1;
    const next = draft.slice(0, lineStart) + prefix + draft.slice(lineStart);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const fmt = {
    bold:   (): void => wrapSelection("**", "**", "bold"),
    italic: (): void => wrapSelection("*", "*", "italic"),
    code:   (): void => wrapSelection("`", "`", "code"),
    quote:  (): void => linePrefix("> "),
    h1:     (): void => linePrefix("# "),
    h2:     (): void => linePrefix("## "),
    bullet: (): void => linePrefix("- "),
    num:    (): void => linePrefix("1. "),
  };

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportAs = (mime: string, ext: string): void => {
    const blob = new Blob([draft], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.download = `codex-notes-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyAll = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(draft); } catch {}
  };

  // Position the widget. Persist as { right, bottom } so it sticks to the
  // bottom-right corner even when the viewport rotates / resizes.
  useEffect(() => {
    if (!visible) return;
    if (offsetRef.current) return;
    try {
      const raw = localStorage.getItem(NOTES_POS);
      const p: unknown = raw ? JSON.parse(raw) : null;
      // Default: dock under the right rail so notes feels like an extension
      // of the panels rather than a roaming widget. Right = 16, bottom = 40
      // sits the panel just above the footer at the right edge.
      offsetRef.current = isPosition(p) ? p : { right: 16, bottom: 40 };
    } catch { offsetRef.current = { right: 16, bottom: 40 }; }
    applyPosition();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPosition(): void {
    const el = wrapRef.current;
    if (!el || !offsetRef.current) return;
    const o = offsetRef.current;
    // Clamp to viewport so a stale persisted position doesn't push off-screen
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || 260;
    const pad = 8;
    const maxRight = Math.max(pad, window.innerWidth - w - pad);
    const maxBottom = Math.max(pad, window.innerHeight - h - pad);
    o.right = Math.min(maxRight, Math.max(pad, o.right));
    o.bottom = Math.min(maxBottom, Math.max(pad, o.bottom));
    el.style.right = o.right + "px";
    el.style.bottom = o.bottom + "px";
  }

  // ── Drag (mouse + touch via pointer events) ─────────────────────────────────
  const onDragStart = (e: React.PointerEvent): void => {
    if ((e.target as Element | null)?.closest("textarea, button, input, .cx-note-content")) return;
    const el = wrapRef.current;
    if (!el) return;
    if (!offsetRef.current) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const startOff: NotePosition = { ...offsetRef.current };
    dragRef.current.dragging = true;
    document.body.classList.add("cx-note-dragging");
    const move = (m: PointerEvent): void => {
      offsetRef.current = {
        right: startOff.right - (m.clientX - start.x),
        bottom: startOff.bottom - (m.clientY - start.y),
      };
      applyPosition();
    };
    const up = (): void => {
      dragRef.current.dragging = false;
      document.body.classList.remove("cx-note-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try { localStorage.setItem(NOTES_POS, JSON.stringify(offsetRef.current)); } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Persistence ──────────────────────────────────────────────────────────────
  useEffect(() => { try { localStorage.setItem(NOTES_DRAFT, draft); } catch {} }, [draft]);
  useEffect(() => { try { localStorage.setItem(NOTES_VIS, visible ? "1" : "0"); } catch {} }, [visible]);
  useEffect(() => { try { localStorage.setItem(NOTES_LIST_OP, listOpen ? "1" : "0"); } catch {} }, [listOpen]);

  // Listen for "open + pin" from outside (the verse menu's NOTE item).
  // Detail: { ref?: string }. If ref provided, prefix the draft with it
  // so the user is ready to type with the cited verse already attached.
  useEffect(() => {
    const onShow = (e: Event): void => {
      setVisible(true);
      const ce = e as CustomEvent<{ ref?: string }>;
      const ref = ce.detail?.ref;
      if (ref) {
        setDraft(d => {
          const prefix = `[${ref}] `;
          return d.startsWith(prefix) ? d : prefix + d;
        });
      }
    };
    window.addEventListener("codex:notes:show", onShow);
    return () => window.removeEventListener("codex:notes:show", onShow);
  }, []);

  // The `n` shortcut (app.jsx) flips codex.notes.visible in localStorage and
  // dispatches this event. Same-tab localStorage writes don't fire `storage`,
  // so without this listener the shortcut was a silent no-op.
  useEffect(() => {
    const onToggle = (): void => {
      try { setVisible(localStorage.getItem(NOTES_VIS) !== "0"); }
      catch { setVisible(v => !v); }
    };
    window.addEventListener("codex:notes:toggle", onToggle);
    return () => window.removeEventListener("codex:notes:toggle", onToggle);
  }, []);

  // Refresh from localStorage when imports happen
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === NOTES_KEY) setNotes(loadNotes());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const currentRef = passage?.book && passage?.chapter
    ? `${passage.book} ${passage.chapter}:${currentVerse}` : "";

  const saveDraft = (): void => {
    const text = draft.trim();
    if (!text) return;
    const note: SavedNote = {
      id: `n_${Date.now()}`,
      text,
      ref: currentRef,
      ts: Date.now(),
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(next);
    nw().CODEX_ENGAGE?.trackNote();
    setDraft("");
    setListOpen(true);
  };

  const pinRef = (): void => {
    if (!currentRef) return;
    setDraft(d => {
      const prefix = `[${currentRef}] `;
      // Avoid double-prefix
      if (d.startsWith(prefix)) return d;
      return prefix + d;
    });
  };

  const deleteNote = (id: string): void => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };

  const jumpNote = (n: SavedNote): void => {
    if (!n.ref || !onJumpTo) return;
    onJumpTo({ ref: n.ref });
  };

  // No floating handle when hidden. Notes are explicitly summoned via the
  // verse menu "NOTE" item (or the settings toggle) — there's no permanent
  // ✎ icon cluttering the screen any more.
  if (!visible) return null;

  const rd = nw().ReactDOM;
  if (!rd) return null;

  return rd.createPortal(
    <aside ref={wrapRef} className="cx-notes" role="complementary" aria-label="Study notes">
      <header className="cx-notes-h" onPointerDown={onDragStart}>
        <span className="cx-notes-h-tag">✎ {ntx("notes.title") || "NOTES"}</span>
        <span className="cx-notes-h-ref">{currentRef}</span>
        <button
          className="cx-notes-h-min"
          onClick={() => {
            // Hide the widget AND turn the feature off entirely. No floating
            // handle remains. To bring it back: verse menu → NOTE, or
            // Settings → Reading → Enable study notes.
            setVisible(false);
            onDisable?.();
          }}
          aria-label="Close notes"
          title="Close (re-open via verse menu → NOTE, or in Settings)"
        >×</button>
      </header>

      <NotesResizeGrip wrapRef={wrapRef} />

      <div className="cx-notes-body">
        <textarea
          ref={taRef}
          className="cx-notes-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={ntx("notes.placeholder") || "jot a thought… or drag a verse here"}
          rows={4}
          onDragOver={(e) => {
            // Accept drops from the reader (verse drag-out).
            if (
              [...e.dataTransfer.types].includes("application/codex-verse") ||
              [...e.dataTransfer.types].includes("text/plain")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              e.currentTarget.classList.add("is-drop");
            }
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("is-drop")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("is-drop");
            const ta = e.currentTarget;
            const verseRaw = e.dataTransfer.getData("application/codex-verse");
            let block: string | undefined;
            if (verseRaw) {
              try {
                const v = JSON.parse(verseRaw) as { text?: string; ref?: string };
                block = `> ${v.text}\n— ${v.ref}`;
              } catch { block = e.dataTransfer.getData("text/plain"); }
            } else {
              block = e.dataTransfer.getData("text/plain");
            }
            if (!block) return;
            const sep = draft.trim() ? "\n\n" : "";
            const next = draft + sep + block;
            setDraft(next);
            // Restore cursor at the end so the user keeps composing.
            requestAnimationFrame(() => {
              ta.focus();
              ta.setSelectionRange(next.length, next.length);
            });
          }}
        />

        <div className="cx-notes-actions">
          <button
            className="cx-notes-btn cx-notes-pin"
            onClick={pinRef}
            disabled={!currentRef}
            title={ntx("notes.pin.tip") || "Prefix with the current verse reference"}
          >⟦ {currentRef || "—"}</button>
          <span className="cx-notes-fmt-wrap">
            <button
              className={`cx-notes-btn cx-notes-fmt-trigger ${fmtOpen ? "is-open" : ""}`}
              onClick={() => setFmtOpen(o => !o)}
              title="Format & export"
              aria-label="Format and export"
              aria-expanded={fmtOpen}
            >⋯</button>
            {fmtOpen ? (
              <div className="cx-notes-fmt-pop" role="dialog" onMouseLeave={() => setFmtOpen(false)}>
                <div className="cx-notes-fmt-row">
                  <span className="cx-notes-fmt-lbl">FORMAT</span>
                </div>
                <div className="cx-notes-fmt-grid">
                  <button className="cx-notes-fmt-btn" onClick={fmt.bold}   title="Bold (**)">  <b>B</b></button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.italic} title="Italic (*)"> <i>I</i></button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.code}   title="Code">{"</>"}</button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.h1}     title="Heading 1">  H1</button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.h2}     title="Heading 2">  H2</button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.quote}  title="Blockquote"> ❝</button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.bullet} title="Bullet list">•</button>
                  <button className="cx-notes-fmt-btn" onClick={fmt.num}    title="Numbered">   1.</button>
                </div>
                <div className="cx-notes-fmt-row">
                  <span className="cx-notes-fmt-lbl">EXPORT</span>
                </div>
                <div className="cx-notes-fmt-export">
                  <button className="cx-notes-fmt-btn" onClick={() => { void copyAll(); setFmtOpen(false); }}>COPY</button>
                  <button className="cx-notes-fmt-btn" onClick={() => { exportAs("text/markdown", "md"); setFmtOpen(false); }}>.md</button>
                  <button className="cx-notes-fmt-btn" onClick={() => { exportAs("text/plain", "txt"); setFmtOpen(false); }}>.txt</button>
                </div>
              </div>
            ) : null}
          </span>
          <button
            className="cx-notes-btn cx-notes-save"
            onClick={saveDraft}
            disabled={!draft.trim()}
          >{ntx("notes.save") || "SAVE"}</button>
        </div>

        <button
          className="cx-notes-listtoggle"
          onClick={() => setListOpen(o => !o)}
        >
          <span className="cx-notes-listtoggle-arr">{listOpen ? "▾" : "▸"}</span>
          <span>{ntx("notes.saved") || "saved"} · {notes.length}</span>
        </button>

        {listOpen ? (
          <>
            {notes.length > 0 ? (
              <div className="cx-notes-filter">
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder={ntx("notes.filter") || "filter notes…"}
                  aria-label="Filter notes"
                  spellCheck={false}
                />
                {filter ? <button className="cx-search-x" onClick={() => setFilter("")} aria-label="Clear">×</button> : null}
              </div>
            ) : null}
            <ul className="cx-notes-list">
              {notes.length === 0 ? (
                <li className="cx-notes-empty">{ntx("notes.empty") || "— no notes yet —"}</li>
              ) : (() => {
                const q = filter.trim().toLowerCase();
                const filtered = q
                  ? notes.filter(n =>
                      (n.text || "").toLowerCase().includes(q) ||
                      (n.ref  || "").toLowerCase().includes(q))
                  : notes;
                if (filtered.length === 0) {
                  return <li className="cx-notes-empty">— no match —</li>;
                }
                return filtered.map(n => (
                  <li key={n.id} className="cx-notes-item">
                    <div className="cx-notes-item-h">
                      <button
                        className="cx-notes-item-ref"
                        onClick={() => jumpNote(n)}
                        disabled={!n.ref}
                        title={n.ref ? `Jump to ${n.ref}` : ""}
                      >{n.ref || "—"}</button>
                      <span className="cx-notes-item-ts">{formatTs(n.ts)}</span>
                      <button
                        className="cx-notes-item-del"
                        onClick={() => deleteNote(n.id)}
                        aria-label="Delete note"
                        title="Delete"
                      >×</button>
                    </div>
                    <p className="cx-notes-item-body">{n.text}</p>
                  </li>
                ));
              })()}
            </ul>
          </>
        ) : null}
      </div>
    </aside>,
    document.body,
  );
}
