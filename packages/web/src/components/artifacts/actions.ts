// artifacts — action routing + app-door helpers (migrated VERBATIM from
// artifacts.jsx). Buttons and refs route through the app's own public doors
// (codexJumpToRef / codexGoto, codexDesk(Panels), codex:os-open, the
// codex.tweaks.v1 settings store). Reads of runtime globals go through aw().
import { aw } from "./artifacts-window.js";

export function artPrimaryTranslation(): string {
  try {
    const n = aw().CODEX_NOW;
    if (n && n.translation) return n.translation;
  } catch {
    /* ignore */
  }
  try {
    const t = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as Record<string, unknown>;
    if (t.primaryTranslation) return String(t.primaryTranslation);
  } catch {
    /* ignore */
  }
  return "kjv";
}

export interface JumpRef {
  bookId?: string;
  chapter?: number;
  verse?: number | null;
  label?: string;
}

// The universal law: every verse click opens the reader on that verse.
export function artJump(refData: JumpRef | string | null | undefined): void {
  try {
    if (refData && typeof refData === "object" && refData.bookId && typeof aw().codexGoto === "function") {
      aw().codexGoto?.(refData.bookId, refData.chapter || 1, refData.verse || 1);
      return;
    }
    if (typeof aw().codexJumpToRef === "function") {
      const label = (refData && typeof refData === "object" ? refData.label : refData) || refData || "";
      aw().codexJumpToRef?.(String(label));
    }
  } catch {
    /* ignore */
  }
}

export function artParseJSON(s: unknown): unknown {
  const t = String(s || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  try {
    const intel = aw().CODEX_INTEL;
    if (intel && intel.intelParseJSON) return intel.intelParseJSON(t);
  } catch {
    /* ignore */
  }
  return undefined;
}

export function artSetTweak(key: string, value: unknown): unknown {
  let stored: Record<string, unknown> = {};
  try {
    stored = (JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as Record<string, unknown>) || {};
  } catch {
    /* ignore */
  }
  const prev = stored[key];
  stored[key] = value;
  try {
    localStorage.setItem("codex.tweaks.v1", JSON.stringify(stored));
  } catch {
    /* ignore */
  }
  const edits: Record<string, unknown> = {};
  edits[key] = value;
  try {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("codex:toast", { detail: { msg: `⚙ set ${key} ${JSON.stringify(value)}`, kind: "ok" } }),
    );
  } catch {
    /* ignore */
  }
  return prev;
}

export const ART_DESK_IDS = ["reader", "library", "oracle", "marks"];

export function artOpenPanel(id: unknown): boolean {
  const pid = String(id || "").trim();
  if (!pid) return false;
  try {
    const desk = aw().codexDesk;
    if (ART_DESK_IDS.includes(pid) && desk && desk.on && desk.on()) {
      desk.open?.(pid);
      return true;
    }
    const panels = aw().codexDeskPanels;
    if (panels && panels.open) {
      panels.open(pid);
      return true;
    }
    window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: pid } }));
    return true;
  } catch {
    return false;
  }
}

export interface ArtAction {
  kind?: string;
  ref?: string;
  book?: string;
  chapter?: number;
  verse?: number;
  id?: string;
  console?: string;
  value?: unknown;
  key?: string;
}

export function artRunAction(action: unknown): void {
  if (!action || typeof action !== "object") return;
  const a = action as ArtAction;
  const kind = String(a.kind || "").toLowerCase();
  try {
    if (kind === "goto") {
      if (a.ref) {
        if (aw().codexJumpToRef) aw().codexJumpToRef?.(String(a.ref));
      } else if (a.book && aw().CODEX_KERNEL && aw().CODEX_KERNEL?.parseRef) {
        const p = aw().CODEX_KERNEL?.parseRef?.(`${a.book} ${a.chapter || 1}:${a.verse || 1}`);
        if (p && aw().codexGoto) aw().codexGoto?.(p.bookId, p.chapter, p.v1 || 1);
      }
      return;
    }
    if (kind === "panel") {
      artOpenPanel(a.id);
      return;
    }
    if (kind === "console") {
      const c = String(a.console || a.id || "").toLowerCase();
      const ref = String(a.ref || aw().CODEX_NOW?.ref || "");
      if (c && ref) window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: c, ref } }));
      return;
    }
    if (kind === "setting") {
      if (a.key !== undefined) artSetTweak(String(a.key), a.value);
      return;
    }
  } catch {
    /* ignore */
  }
}
