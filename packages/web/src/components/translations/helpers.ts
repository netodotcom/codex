// translations — pure helpers (migrated verbatim from translations.jsx).
// txOfflineState is the single source of truth for the three offline states;
// txToast dispatches the app-level toast event.
import type { TxTranslation, TxStats, TxDl } from "./translations-window.js";
import type { OfflineKind } from "./data.js";

export interface OfflineState {
  kind: OfflineKind;
  downloading: boolean;
  ratio: number;
}

export function txToast(msg: string, kind = "info"): void {
  try { window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } })); } catch {}
}

// Offline truth for one translation: "full" | "part" | "net" (+ live dl).
export function txOfflineState(
  t: Pick<TxTranslation, "source" | "name">,
  stats: TxStats | null | undefined,
  dl: TxDl | null | undefined,
): OfflineState {
  const downloading = !!(dl && !dl.complete && !dl.aborted);
  if (downloading) {
    const total = dl!.total ?? 0;
    const done = dl!.done ?? 0;
    const ratio = total > 0 ? done / total : 0;
    return { kind: "part", downloading: true, ratio };
  }
  if (t.source === "bundle" || stats?.fully) return { kind: "full", downloading: false, ratio: 1 };
  const ratio = stats && stats.total ? (stats.cached ?? 0) / stats.total : 0;
  if (ratio > 0) return { kind: "part", downloading: false, ratio };
  return { kind: "net", downloading: false, ratio: 0 };
}
