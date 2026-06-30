// reader — inline gnosis card (migrated from components.jsx). A small aside with
// the gnosis entry's sigil/title/body, plus the plain-version toggle.
import React from "react";
import { NormieToggle } from "./NormieToggle.js";

export interface GnosisEntry {
  sigil?: string;
  title?: string;
  body: string;
}

export function GnosisInline({ entry }: { entry: GnosisEntry }): React.ReactElement {
  return (
    <aside className="cx-gnosis-inline" aria-label="Gnosis reading">
      <header>
        <span className="cx-gnosis-inline-sigil">{entry.sigil || "⟁"}</span>
        <span className="cx-gnosis-inline-title">{entry.title}</span>
      </header>
      <p>{entry.body}</p>
      <NormieToggle text={entry.body} scope="gnosis-inline" />
    </aside>
  );
}
