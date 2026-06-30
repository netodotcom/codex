// reader — scripture-face toggle (migrated from components.jsx). Sits next to
// the size pill in the reader header. Reads the current face from the body class
// (set by App via `font-${scriptureFont}`) and writes back through the same
// tweak persistence channel users see in Settings.
import React from "react";

const { useState, useEffect } = React;

type Face = "serif" | "mono";

interface FaceWindow {
  parent: { postMessage(msg: unknown, target: string): void };
}

export function FaceToggle(): React.ReactElement {
  const [face, setFace] = useState<Face>(() => {
    const m = document.querySelector(".cx-app")?.className.match(/font-(serif|mono)/);
    return (m?.[1] as Face) ?? "serif";
  });
  useEffect(() => {
    const onTweak = (e: Event): void => {
      const detail = (e as CustomEvent<{ scriptureFont?: string }>).detail;
      if (detail && typeof detail.scriptureFont === "string") setFace(detail.scriptureFont as Face);
    };
    window.addEventListener("tweakchange", onTweak);
    return () => window.removeEventListener("tweakchange", onTweak);
  }, []);
  const flip = (): void => {
    const next: Face = face === "serif" ? "mono" : "serif";
    setFace(next);
    try {
      const raw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as Record<string, unknown>;
      raw["scriptureFont"] = next;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(raw));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: { scriptureFont: next } }));
    try {
      (window as unknown as FaceWindow).parent.postMessage({ type: "__edit_mode_set_keys", edits: { scriptureFont: next } }, "*");
    } catch {
      /* ignore */
    }
    const app = document.querySelector(".cx-app");
    if (app) {
      app.classList.remove("font-serif", "font-mono");
      app.classList.add(`font-${next}`);
    }
  };
  return (
    <button
      type="button"
      className={`cx-face-toggle is-${face}`}
      onClick={flip}
      title={`Scripture face · ${face} · click to switch`}
      aria-label={`Scripture face: ${face}`}
    >
      <span className="cx-face-glyph">{face === "serif" ? "Aa" : "Aa"}</span>
      <span className="cx-face-lbl">{face}</span>
    </button>
  );
}
