// artifacts — inline rendering (migrated VERBATIM from artifacts.jsx). The
// scripture chip with its lazy hover/focus verse preview, plus the [j]/[d] tag,
// ref, and **bold**/*italic*/`code` inline parser. Raw model HTML is NEVER
// injected — only text nodes and the typed directives ever reach the DOM.
import React from "react";
import { aw, versesOf } from "./artifacts-window.js";
import { artSplitOnRefs, type RefData } from "./refs.js";
import { artJump, artPrimaryTranslation } from "./actions.js";

const { useState, useEffect, useMemo, useRef } = React;

type PreviewLine = { n: number | undefined; text: string };
type PreviewState = PreviewLine[] | "err" | null;
interface ChipTimers {
  open?: ReturnType<typeof setTimeout>;
  close?: ReturnType<typeof setTimeout>;
}

// ── Scripture chip with lazy hover/focus preview ──────────────────────────
export function ArtRef({ refData }: { refData: RefData }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null); // null | [{n,text}] | "err"
  const hostRef = useRef<HTMLButtonElement | null>(null);
  const timers = useRef<ChipTimers>({});
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !hostRef.current) return;
    const r = hostRef.current.getBoundingClientRect();
    const popW = 280, popH = 150, pad = 8;
    const left = Math.min(window.innerWidth - popW - pad, Math.max(pad, r.left + r.width / 2 - popW / 2));
    let top = r.bottom + 6;
    if (top + popH > window.innerHeight - pad) top = Math.max(pad, r.top - popH - 6);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open || preview) return;
    let dead = false;
    void (async () => {
      try {
        const { bookId, chapter, verse, endVerse } = refData;
        const trans = artPrimaryTranslation();
        const data = await aw().BIBLE!.loadChapter(bookId, chapter, trans);
        const verses = versesOf(data);
        let lines: PreviewLine[] = [];
        if (verse == null) {
          lines = verses.slice(0, 3).map((v) => ({ n: v.n || v.verse, text: v.text || (v[trans] as string | undefined) || "" }));
        } else {
          const end = Math.min(endVerse || verse, verse + 3);
          for (let n = verse; n <= end; n++) {
            const v = verses.find((x) => (x.n || x.verse) === n);
            if (v) lines.push({ n, text: v.text || (v[trans] as string | undefined) || "" });
          }
        }
        if (!dead) setPreview(lines.length ? lines : "err");
      } catch {
        if (!dead) setPreview("err");
      }
    })();
    return () => {
      dead = true;
    };
  }, [open, preview, refData]);

  const show = (): void => {
    clearTimeout(timers.current.close);
    timers.current.open = setTimeout(() => setOpen(true), 220);
  };
  const hide = (): void => {
    clearTimeout(timers.current.open);
    timers.current.close = setTimeout(() => setOpen(false), 160);
  };
  useEffect(
    () => () => {
      clearTimeout(timers.current.open);
      clearTimeout(timers.current.close);
    },
    [],
  );

  return (
    <button
      type="button"
      ref={hostRef}
      className="cx-art-ref"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => artJump(refData)}
      title={`Open the reader at ${refData.label}`}
    >
      {refData.label}
      {open
        ? aw().ReactDOM!.createPortal(
            <span
              className="cx-art-ref-pop"
              role="tooltip"
              onMouseEnter={() => clearTimeout(timers.current.close)}
              onMouseLeave={hide}
              style={{ top: pos.top + "px", left: pos.left + "px" }}
            >
              <span className="cx-art-ref-pop-h">{refData.label}</span>
              <span className="cx-art-ref-pop-b">
                {preview === null
                  ? "loading…"
                  : preview === "err"
                    ? "(no preview)"
                    : preview.map((v) => (
                        <span key={v.n}>
                          <sup>{v.n}</sup>
                          {v.text}{" "}
                        </span>
                      ))}
              </span>
            </span>,
            document.body,
          )
        : null}
    </button>
  );
}

// ── Inline rendering — [j]/[d] tags, refs, bold/italic/code ───────────────
export function artInlineMd(text: string, out: React.ReactNode[], nextKey: () => string): void {
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*[^*\s]|[^*\s])\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={nextKey()}>{text.slice(last, m.index)}</React.Fragment>);
    if (m[2] != null) out.push(<strong key={nextKey()}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<code key={nextKey()} className="cx-art-code-i">{m[3]}</code>);
    else if (m[4] != null) out.push(<em key={nextKey()}>{m[4]}</em>);
    last = m.index + (m[0] ?? "").length;
  }
  if (last < text.length) out.push(<React.Fragment key={nextKey()}>{text.slice(last)}</React.Fragment>);
}

export function artRenderInline(text: string): React.ReactNode[] | null {
  if (!text) return null;
  const tagRe = /\[(j|d)\]([\s\S]*?)\[\/\1\]/g;
  const blocks: Array<{ kind: "red" | "divine" | null; text: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > last) blocks.push({ kind: null, text: text.slice(last, m.index) });
    blocks.push({ kind: m[1] === "j" ? "red" : "divine", text: m[2] ?? "" });
    last = m.index + (m[0] ?? "").length;
  }
  if (last < text.length) blocks.push({ kind: null, text: text.slice(last) });
  const out: React.ReactNode[] = [];
  let key = 0;
  const nextKey = (): string => "i" + key++;
  for (const b of blocks) {
    if (b.kind) {
      out.push(
        <span key={nextKey()} className={b.kind === "red" ? "cx-red" : "cx-divine"}>
          {b.text}
        </span>,
      );
      continue;
    }
    for (const seg of artSplitOnRefs(b.text)) {
      if (seg.type === "ref") out.push(<ArtRef key={nextKey()} refData={seg.ref} />);
      else artInlineMd(seg.text, out, nextKey);
    }
  }
  return out;
}
