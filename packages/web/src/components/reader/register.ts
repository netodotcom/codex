// reader (soul) — boot-ref + plugin registration (migrated verbatim from the two
// trailing IIFEs of reader.jsx). index.tsx calls these at load, exactly where the
// legacy ran them.
import React from "react";
import { sw } from "./soul-window.js";
import { CodexReaderX } from "./CodexReaderX.js";
import type { CodexReaderXProps } from "./CodexReaderX.js";
import type { NowPos } from "./soul-window.js";

// ── ?surface=reader&ref=… — the browser-tab secondary reader ────────────
// displays.js (read-only law) boots ?surface=reader into a reader-only
// satellite; the reader itself honours the extra &ref= so '⧉ READER IN A
// BROWSER TAB' opens straight onto the page it was spawned from. One jump
// at boot; afterwards the satellite follows the shared display cursor.
export function readerBootRef(): void {
  if (typeof window === "undefined") return;
  let params: URLSearchParams;
  try { params = new URLSearchParams(window.location.search); } catch { return; }
  if (params.get("surface") !== "reader") return;
  const ref = params.get("ref");
  if (!ref) return;
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const w = sw();
    if (w.__CODEX_READY__ === true && typeof w.codexJumpToRef === "function") {
      clearInterval(t);
      try { w.codexJumpToRef(ref); } catch { /* host not ready */ }
    } else if (tries > 120) {
      clearInterval(t);
    }
  }, 250);
}

// ── Registration: the MAIN plugin ───────────────────────────────────────
export function registerReaderPlugin(): void {
  if (typeof window === "undefined") return;
  const reg = (): unknown => {
    const w = sw();
    if (!w.CODEX_PLUGINS_API) return false;
    return w.CODEX_PLUGINS_API.register({
      id: "sys-reader",
      name: "The Reader",
      version: "11.3.0",
      panels: [{
        id: "reader",
        label: "READER",
        glyph: "✦",
        // MONAD windows pass a live ctx — honoured as the seed; the window
        // still follows the shared cursor (pinned readers go through
        // window.codexNewReader → app.jsx DeskWin instead).
        render(ctx: NowPos | undefined) {
          return React.createElement(CodexReaderX as React.FC<CodexReaderXProps>, { surface: "window", initialNow: ctx && ctx.bookId ? ctx : undefined });
        },
      }],
    });
  };
  if (!reg()) document.addEventListener("DOMContentLoaded", reg, { once: true });
}
