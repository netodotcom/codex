// reader — gematria margin glyph (migrated from components.jsx). Shows the
// primary gematria value of a verse, with a coloured glow for the significant
// values. Computed via the runtime engine (schizoCompute).
import React from "react";
import { schizoCompute, SCHIZO_SIGNIFICANT } from "./schizo.js";

export function SchizoMargin({ text }: { text: string }): React.ReactElement | null {
  const info = schizoCompute(text);
  if (!info || !info.primaryVal) return null;
  const glow = SCHIZO_SIGNIFICANT[info.primaryVal] || "";
  const tip = Object.entries(info.all)
    .filter(([k, v]) => k !== "lang" && typeof v === "number")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  return (
    <span className={`cx-schizo-gem ${glow ? `is-glow is-${glow}` : ""}`} title={tip}>
      {info.primaryVal}
    </span>
  );
}
