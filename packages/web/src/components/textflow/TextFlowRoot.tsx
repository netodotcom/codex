// textflow — TextFlowRoot: the stateful root that manages all open text windows
// and exposes window.codexOpenText while mounted.
// Faithful port from textflow.jsx. The window global is set in useEffect (same
// timing as the legacy) and deleted on unmount (same cleanup as the legacy delete).
import React from "react";
import { TextWindow } from "./TextWindow.js";
import { textflowParse } from "./helpers.js";
import { tfw } from "./textflow-window.js";
import type { SefariaSpec } from "./textflow-window.js";

const { useState, useEffect } = React;

export function TextFlowRoot(): React.ReactElement {
  const [wins, setWins] = useState<SefariaSpec[]>([]);

  useEffect(() => {
    tfw().codexOpenText = (spec: unknown): boolean => {
      const parsed = textflowParse(spec);
      if (!parsed) {
        try {
          window.dispatchEvent(
            new CustomEvent("codex:toast", {
              detail: {
                msg: `Can't resolve "${String(spec)}" to a readable text`,
                kind: "warn",
              },
            }),
          );
        } catch {
          // never break other code
        }
        return false;
      }
      if (parsed.kind === "bible") {
        const jump = tfw().codexJumpToRef;
        if (jump) jump(parsed.ref);
        return true;
      }
      // parsed.kind === "sefaria" at this point
      const sw: SefariaSpec = parsed;
      setWins((prev) =>
        prev.some((w) => w.tref === sw.tref) ? prev : [...prev, sw],
      );
      return true;
    };
    return () => {
      // Mirrors: delete window.codexOpenText — same cleanup as legacy.
      const w = tfw() as Record<string, unknown>;
      delete w["codexOpenText"];
    };
  }, []);

  const close = (win: SefariaSpec): void =>
    setWins((prev) => prev.filter((w) => w.tref !== win.tref));

  return (
    <>
      {wins.map((w) => (
        <TextWindow key={w.tref} win={w} onClose={close} />
      ))}
    </>
  );
}
