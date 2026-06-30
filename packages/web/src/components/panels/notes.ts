// panels — save a panel entry to the user's notes (Backlog 4.1). Ported from
// panels.jsx. buildNoteText is pure; savePanelEntryToNotes is the IO boundary
// (localStorage + tweak/notes window events).

export interface PanelEntry {
  kind: string;
  ref?: string;
  heading?: string;
  body?: string;
  tag?: string;
  passage?: { book?: string; chapter?: number };
}

export function buildNoteText(e: PanelEntry): { refStr: string; text: string } {
  const refStr = e.passage?.book && e.passage?.chapter ? `${e.passage.book} ${e.passage.chapter} · ${e.kind}` : e.kind;
  const lines: string[] = [];
  if (e.heading) lines.push(e.heading + (e.tag ? ` (${e.tag})` : ""));
  if (e.ref) lines.push(`— ${e.ref}`);
  if (e.body) lines.push("", e.body);
  const text = `[${refStr}] ${lines.join("\n")}`.trim();
  return { refStr, text };
}

export function savePanelEntryToNotes(e: PanelEntry): void {
  const { refStr, text } = buildNoteText(e);
  try {
    const list = JSON.parse(localStorage.getItem("codex.notes.v1") || "[]") as unknown[];
    list.unshift({ id: `n_${Date.now()}`, ref: refStr, text, ts: Date.now(), source: e.kind });
    localStorage.setItem("codex.notes.v1", JSON.stringify(list));
    const tw = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as Record<string, unknown>;
    if (!tw["notesEnabled"]) {
      tw["notesEnabled"] = true;
      localStorage.setItem("codex.tweaks.v1", JSON.stringify(tw));
      window.dispatchEvent(new CustomEvent("tweakchange", { detail: { notesEnabled: true } }));
    }
    localStorage.setItem("codex.notes.visible", "1");
    window.dispatchEvent(new CustomEvent("codex:notes:show", { detail: {} }));
  } catch (err) {
    console.warn("Save panel-entry to notes failed:", err);
  }
}
