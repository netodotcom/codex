// settings — small leftover controls (migrated from tweaks-panel.jsx).
// TweakOS7 is retired (the OS·7 desk stopped being optional in v9.2) — kept as
// an inert export so stragglers render nothing. TweakSchizoToggle is an easter
// egg gated by eligibility upstream.
import React from "react";
import { TweakToggle } from "./controls.js";

export function TweakOS7(): null {
  return null;
}

export function TweakSchizoToggle({ eligible, value, onChange }: { eligible?: boolean; value?: boolean; onChange: (v: boolean) => void }): React.ReactElement | null {
  if (!eligible) return null;
  return (
    <div className="cx-schizo-toggle">
      <TweakToggle label="Schizo Mode" value={!!value} onChange={onChange} />
    </div>
  );
}
