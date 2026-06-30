// reader — side-by-side verse (migrated from components.jsx). Same affordances
// as VerseRow but laid out as a grid of translation columns; the row container
// owns the long-press / context menu.
import React from "react";
import { renderScripture } from "./render-scripture.js";
import { SchizoMargin } from "./SchizoMargin.js";
import { VerseActions } from "./VerseActions.js";
import { useLongPress } from "./useLongPress.js";
import type { Passage, Translation, Verse } from "./types.js";

export interface VerseSideRowProps {
  v: Verse;
  colsMeta: Translation[];
  isHl: boolean;
  markColor?: string | null;
  redLetter: boolean;
  verseText: (v: Verse, tId: string) => string;
  onSelectVerse: (n: number) => void;
  onToggleHighlight?: (n: number) => void;
  onOpenVerseMenu?: (v: Verse, rect: DOMRect) => void;
  schizo?: boolean;
  passage?: Passage;
}

export function VerseSideRow({
  v,
  colsMeta,
  isHl,
  markColor,
  redLetter,
  verseText,
  onSelectVerse,
  onToggleHighlight,
  onOpenVerseMenu,
  schizo,
}: VerseSideRowProps): React.ReactElement {
  const longPress = useLongPress((rect) => onOpenVerseMenu?.(v, rect));
  const onCtx = (e: React.MouseEvent): void => {
    e.preventDefault();
    onOpenVerseMenu?.(v, e.currentTarget.getBoundingClientRect());
  };
  const first = colsMeta[0];
  return (
    <div
      className={`cx-verse-row ${isHl ? "is-hl" : ""} ${markColor ? "is-marked" : ""}`}
      data-mark={markColor || ""}
      data-vn={v.n}
      onClick={() => onSelectVerse(v.n)}
      onContextMenu={onCtx}
      {...longPress}
      style={{ gridTemplateColumns: `repeat(${colsMeta.length}, minmax(160px,1fr))` }}
    >
      {schizo && first ? <SchizoMargin text={verseText(v, first.id)} /> : null}
      {colsMeta.map((t, i) => {
        const text = verseText(v, t.id);
        const isLatin = t.lang === "LA";
        const red = redLetter ? v.red?.[t.id] : null;
        return (
          <p key={t.id} className={`cx-verse cx-verse-col ${i === 0 ? "is-primary-col" : ""} ${isLatin ? "is-latin" : ""}`}>
            <sup
              className="cx-vnum"
              role="button"
              tabIndex={0}
              title="Tap to highlight"
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
            >
              {v.n}
            </sup>
            <span className="cx-vtext">{renderScripture(text, red, !!(redLetter && v._jesusVerse))}</span>
          </p>
        );
      })}
      <VerseActions
        onMark={(e) => {
          e.stopPropagation();
          onToggleHighlight?.(v.n);
        }}
        onMenu={(e) => {
          e.stopPropagation();
          const row = (e.currentTarget as HTMLElement).closest(".cx-verse-row");
          if (row) onOpenVerseMenu?.(v, row.getBoundingClientRect());
        }}
        isMarked={!!markColor}
        voxText={first ? verseText(v, first.id) : ""}
      />
    </div>
  );
}
