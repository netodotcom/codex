// reader — verse gutter actions (migrated from components.jsx). One quiet
// hairline in the reserved right gutter: left-click toggles the highlight,
// right-click opens the full verse menu. The optional vox button precedes it.
import React from "react";
import { VerseVoxBtn } from "./VerseVoxBtn.js";

export function VerseActions({
  onMark,
  onMenu,
  isMarked,
  voxText,
}: {
  onMark: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
  isMarked: boolean;
  voxText?: string;
}): React.ReactElement {
  return (
    <>
      {voxText ? <VerseVoxBtn text={voxText} /> : null}
      <button
        type="button"
        className={`cx-vmark-btn ${isMarked ? "is-on" : ""}`}
        onClick={onMark}
        onContextMenu={onMenu}
        title={isMarked ? "Click to remove highlight · right-click for menu" : "Click to highlight · right-click for menu"}
        aria-label={isMarked ? "Remove highlight" : "Highlight verse"}
      >
        {isMarked ? "★" : "☆"}
      </button>
    </>
  );
}
