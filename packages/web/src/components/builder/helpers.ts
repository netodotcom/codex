// builder — side-effecting helpers used by the panel: file download, the guarded
// engagement depth-action emit, and the utf8-safe share-URL builder (migrated
// verbatim from builder.jsx).
import type { Study } from "./store.js";
import { bw } from "./builder-window.js";

export function download(filename: string, text: string, mime?: string): void {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

// Guarded depth-action emit — no-op if the engine's action type is unknown or
// anything is missing, so nothing throws in Lite mode / absent globals.
export function emitDepth(type: string, ref: string, weight: number): void {
  try {
    const eng = bw().CODEX_ENGAGEMENT;
    const known = eng && eng.DEPTH_ACTIONS && eng.DEPTH_ACTIONS[type];
    if (!known) return;
    window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type, ref, weight } }));
  } catch {
    /* ignore */
  }
}

export function shareUrlFor(study: Study): string {
  // utf8-safe base64
  const json = JSON.stringify({
    title: study.title,
    sections: study.sections.map((s) => ({ heading: s.heading, items: s.items })),
  });
  const enc = btoa(unescape(encodeURIComponent(json)));
  const u = new URL(window.location.href);
  u.search = "?study=" + enc;
  u.hash = "";
  return u.toString();
}
