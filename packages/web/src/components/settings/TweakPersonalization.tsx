// settings — clear personalization (migrated from tweaks-panel.jsx). Clears the
// learned taste profile + Oracle conversation context; marks/notes/cache are
// untouched.
import React from "react";
import { TweakButton } from "./controls.js";
import { sw } from "./settings-window.js";

export function TweakPersonalization(): React.ReactElement {
  const [done, setDone] = React.useState(false);
  const onClear = (): void => {
    if (!window.confirm("Clear the learned taste profile and the Oracle conversation context?\n\nMarks, notes, and cached scripture are untouched.")) return;
    try {
      sw().CODEX_ENGAGE?.clearProfile?.();
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("codex:oracle-reset"));
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Personalization cleared", kind: "ok" } }));
    } catch {
      /* ignore */
    }
    setDone(true);
  };
  return (
    <div className="twk-row">
      <p className="twkx-hint">CODEX learns from your likes, Oracle questions, and highlights to tailor Reels.</p>
      <TweakButton label="Clear profile & Oracle context" secondary onClick={onClear} />
      {done && <span className="twk-val">Personalization cleared</span>}
    </div>
  );
}
