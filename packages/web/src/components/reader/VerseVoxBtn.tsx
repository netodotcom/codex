// reader — inline TTS button (migrated from components.jsx). One-tap playback of
// a single verse via the Web Speech API; reuses the active utterance so a second
// click stops it. The full Vox panel still owns voice selection / queueing.
import React from "react";

const { useState, useEffect } = React;

export function VerseVoxBtn({ text }: { text: string }): React.ReactElement | null {
  const [on, setOn] = useState(false);
  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
    [],
  );
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const speak = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const synth = window.speechSynthesis;
    if (on) {
      synth.cancel();
      setOn(false);
      return;
    }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text || "").trim());
      u.onend = () => setOn(false);
      u.onerror = () => setOn(false);
      synth.speak(u);
      setOn(true);
    } catch {
      setOn(false);
    }
  };
  return (
    <button
      type="button"
      className={`cx-vox-inline ${on ? "is-on" : ""}`}
      onClick={speak}
      title={on ? "Stop reading" : "Read aloud"}
      aria-label={on ? "Stop reading verse" : "Read verse aloud"}
    >
      {on ? "◼" : "▷"}
    </button>
  );
}
