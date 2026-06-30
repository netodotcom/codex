// reader — red-letter scripture renderer (migrated from components.jsx). Maps
// the pure parts from scripture.ts to JSX: red clauses get .cx-red, plain text
// stays inline. renderRedLetter is the back-compat alias old call sites used.
import React from "react";
import { buildScriptureParts } from "./scripture.js";

export function renderScripture(rawText: string, redQuotes: string[] | null | undefined, wholeVerse: boolean): React.ReactNode {
  return buildScriptureParts(rawText, redQuotes, wholeVerse).map((p, i) =>
    p.kind === "red" ? (
      <span key={i} className="cx-red">
        {p.t}
      </span>
    ) : (
      <React.Fragment key={i}>{p.t}</React.Fragment>
    ),
  );
}

// Back-compat alias — old call sites can keep working unchanged.
export function renderRedLetter(text: string, redQuotes: string[] | null | undefined, wholeVerse: boolean): React.ReactNode {
  return renderScripture(text, redQuotes, wholeVerse);
}
