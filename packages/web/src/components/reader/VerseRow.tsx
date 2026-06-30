// reader — single-column verse (migrated from components.jsx). Desktop
// right-click + mobile long-press both open the verse menu; the hover gutter
// button toggles a one-tap highlight. Draggable so a verse can be dropped into
// Notes carrying its ref + text.
import React from "react";
import { renderScripture } from "./render-scripture.js";
import { SchizoMargin } from "./SchizoMargin.js";
import { VerseActions } from "./VerseActions.js";
import { useLongPress } from "./useLongPress.js";
import type { Passage, Verse } from "./types.js";

export interface VerseRowProps {
  v: Verse;
  isHl: boolean;
  isLatin: boolean;
  markColor?: string | null;
  text: string;
  redLetter: boolean;
  primary: string;
  onSelectVerse: (n: number) => void;
  onToggleHighlight?: (n: number) => void;
  onOpenVerseMenu?: (v: Verse, rect: DOMRect) => void;
  passage?: Passage;
  schizo?: boolean;
}

export function VerseRow({
  v,
  isHl,
  isLatin,
  markColor,
  text,
  redLetter,
  primary,
  onSelectVerse,
  onToggleHighlight,
  onOpenVerseMenu,
  passage,
  schizo,
}: VerseRowProps): React.ReactElement {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e: React.MouseEvent): void => {
    e.preventDefault();
    onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect());
  };
  const onDragStart = (e: React.DragEvent): void => {
    const ref = passage ? `${passage.book} ${passage.chapter}:${v.n}` : `Verse ${v.n}`;
    const plain = `"${text}"\n— ${ref}`;
    e.dataTransfer.setData("text/plain", plain);
    e.dataTransfer.setData("application/codex-verse", JSON.stringify({ ref, text, n: v.n }));
    e.dataTransfer.effectAllowed = "copy";
    document.body.classList.add("cx-verse-dragging");
  };
  const onDragEnd = (): void => document.body.classList.remove("cx-verse-dragging");
  const red = redLetter ? v.red?.[primary] : null;
  return (
    <p
      className={`cx-verse ${isHl ? "is-hl" : ""} ${isLatin ? "is-latin" : ""} ${markColor ? "is-marked" : ""}`}
      data-mark={markColor || ""}
      data-vn={v.n}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelectVerse(v.n)}
      onContextMenu={onCtx}
      {...longPress}
    >
      {schizo ? <SchizoMargin text={text} /> : null}
      <sup
        className="cx-vnum"
        role="button"
        tabIndex={0}
        title="Tap to highlight (long-press for color)"
        aria-label={`Verse ${v.n}, tap to highlight`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleHighlight?.(v.n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggleHighlight?.(v.n);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const row = (e.currentTarget as HTMLElement).closest(".cx-verse");
          if (row) onOpenVerseMenu?.(v, row.getBoundingClientRect());
        }}
      >
        {v.n}
      </sup>
      <span className="cx-vtext">{renderScripture(text, red, !!(redLetter && v._jesusVerse))}</span>
      <VerseActions
        onMark={(e) => {
          e.stopPropagation();
          onToggleHighlight?.(v.n);
        }}
        onMenu={(e) => {
          e.stopPropagation();
          const row = (e.currentTarget as HTMLElement).closest(".cx-verse");
          if (row) onOpenVerseMenu?.(v, row.getBoundingClientRect());
        }}
        isMarked={!!markColor}
        voxText={text}
      />
    </p>
  );
}
