// wm — shared TypeScript types.

/** Normalized window geometry (position + size in viewport px). */
export interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A geometry rectangle with an optional centre-slot marker (used by the
 * "reader" layout — the flag is not consumed downstream; preserved from
 * legacy). */
export interface LayoutRect extends Geo {
  readonly __center?: true;
}

/** Console/window spec from the SPECS registry. */
export interface WinSpec {
  readonly id: string;
  /** Class name on the backdrop element (without leading dot). */
  readonly backdrop: string;
  /** CSS selector for the card element. */
  readonly card: string;
  /** CSS selector for the drag-handle element. */
  readonly head: string;
  readonly min: readonly [number, number];
}

/** A live entry in the running-windows dock list. */
export interface DockEntry {
  readonly key: string;
  readonly id: string;
  readonly glyph: string;
  readonly iconId: string;
  readonly min: readonly [number, number];
  readonly setGeo: (g: Geo) => void;
  readonly backdrop: HTMLElement;
  readonly card: HTMLElement;
  readonly front: () => void;
  readonly label: string;
}

/** A launchable chip registered in DOCK_REG. */
export interface DockRegEntry {
  readonly id: string;
  readonly glyph: string;
  readonly label: string;
  readonly title: string;
  readonly locked?: true;
  readonly run: (anchor?: HTMLElement) => void;
}

/** A saved study-setup entry persisted in codex.layouts.v1. */
export interface SavedLayout {
  name: string;
  ts: number;
  wins: ReadonlyArray<{ id: string; glyph: string; geo: Geo }>;
}

/** The public arrange API assigned to window.codexArrange. */
export interface CodexArrangeApi {
  layout: (kind: string) => void;
  save: (name: string) => void;
  recall: (name: string) => void;
  list: () => SavedLayout[];
}

// ── Minimal slices for READ globals ──────────────────────────────────────────
// These are set by app.jsx / other engines; wm only reads them.

/** Minimal slice of window.codexDesk. */
export interface CodexDesk {
  on: () => boolean;
  open: (k: string) => void;
  state: () => Record<string, boolean | undefined>;
}

/** Minimal slice of window.codexDeskPanels. */
export interface CodexDeskPanels {
  on: () => boolean;
  list: () => string[];
}

/** Minimal slice of window.codexDisplays. */
export interface CodexDisplays {
  surfaces: string[];
  open: (s: string) => void;
  surfaceForWid: (wid: string) => string | null | undefined;
}

/** Minimal slice of window.CODEX_NOW. */
export interface CodexNow {
  ref?: string;
}
