// app — the desk (windowed layout) persistence (migrated from app.jsx). Under
// OS·7 on a desktop pointer the app is windows: the reader is the main window;
// library/oracle/marks and the eight builtin panels are independent windows.
// codex.desk.v1 remembers which are open; codex.desk.panels.v1 the builtin
// panel windows.
export const DESK_KEY = "codex.desk.v1";
export const DESK_PANELS_KEY = "codex.desk.panels.v1";

export interface DeskState {
  reader: boolean;
  library: boolean;
  oracle: boolean;
  marks: boolean;
  focus: boolean;
}

export const BUILTIN_WIN: Record<string, { glyph: string; title: string }> = {
  trans: { glyph: "Α/Ω", title: "TRANSLATIONS" },
  talmud: { glyph: "ת", title: "TALMUD" },
  comm: { glyph: "§", title: "COMMENTARY" },
  gem: { glyph: "Σn", title: "GEMATRIA" },
  gnosis: { glyph: "⟁", title: "GNOSIS" },
  disarm: { glyph: "⚔", title: "DISARM" },
  exeg: { glyph: "✎", title: "EXEGESIS" },
  txan: { glyph: "⟷", title: "WORD ANALYSIS" },
};
export const BUILTIN_PANEL_IDS = Object.keys(BUILTIN_WIN);

export function deskLoad(): DeskState {
  try {
    const d = JSON.parse(localStorage.getItem(DESK_KEY) || "null") as Partial<DeskState> | null;
    if (d && typeof d === "object") {
      return { reader: d.reader !== false, library: !!d.library, oracle: !!d.oracle, marks: !!d.marks, focus: !!d.focus };
    }
  } catch {
    /* ignore */
  }
  // First open: the reader, front and center, and nothing else.
  return { reader: true, library: false, oracle: false, marks: false, focus: false };
}

export function deskSave(d: DeskState): void {
  try {
    localStorage.setItem(DESK_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function hasSurfaceParam(): boolean {
  try {
    return !!new URLSearchParams(window.location.search).get("surface");
  } catch {
    return false;
  }
}

export function deskPanelsLoad(): string[] {
  // Satellites (?surface=) show ONE surface — never the panel windows.
  if (hasSurfaceParam()) return [];
  try {
    const arr = JSON.parse(localStorage.getItem(DESK_PANELS_KEY) || "null") as unknown;
    if (Array.isArray(arr)) return arr.filter((id) => BUILTIN_PANEL_IDS.includes(id));
  } catch {
    /* ignore */
  }
  // One-time migration: builtin ids pinned in the old deck become the open windows.
  try {
    const pinned = JSON.parse(localStorage.getItem("codex.panels.pinned.v1") || "null") as unknown;
    if (Array.isArray(pinned)) return pinned.filter((id) => BUILTIN_PANEL_IDS.includes(id));
  } catch {
    /* ignore */
  }
  return [];
}

export function deskPanelsSave(arr: string[]): void {
  if (hasSurfaceParam()) return;
  try {
    localStorage.setItem(DESK_PANELS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function deskCapable(): boolean {
  // v9.2 SHED: the desk IS the desktop app — no classic fallback. One breakpoint.
  try {
    return window.matchMedia("(min-width: 881px) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}
