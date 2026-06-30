// notes — typed window boundary. Notes reads two runtime globals (t, CODEX_ENGAGE,
// ReactDOM) and writes one (Notes). Centralise the typing here; callers use nw()
// and read/write what they need, lazily, at call time.
import type React from "react";

export interface NotesEngageApi {
  trackNote(): void;
}

export interface NotesReactDomApi {
  createPortal(node: React.ReactNode, container: Element): React.ReactPortal;
}

export interface NotesWindow {
  /** CDN i18n helper — falls back to key if absent */
  t?: (k: string) => string;
  /** Engagement tracking API */
  CODEX_ENGAGE?: NotesEngageApi;
  /** CDN ReactDOM — needed for createPortal */
  ReactDOM?: NotesReactDomApi;
  /** Set by index.tsx — the exported Notes component */
  Notes?: unknown;
}

export function nw(): NotesWindow {
  return window as unknown as NotesWindow;
}

/** Local i18n shortcut — falls back to the key itself (mirrors legacy ntx). */
export function ntx(k: string): string {
  const t = nw().t;
  return (t && t(k)) || k;
}
