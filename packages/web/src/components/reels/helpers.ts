// reels — display helpers (faithfully ported from reels.jsx). refLabel and
// navigateToAnchor are the only two helpers that read window globals
// (CODEX_DATA.bookName, codexJumpToRef); all calls are guarded for
// offline/Lite mode.
import { rw } from "./reels-window.js";

export const TYPE_LABELS: Record<string, string> = {
  "art-verse":     "⌖ ART",
  "light-verse":   "✦ LIGHT",
  "symbol":        "◊ SYMBOL",
  "name-of-god":   "ℵ NAME",
  "did-you-know":  "✱ DID YOU KNOW",
  "parable-3":     "❧ PARABLE",
  "prophecy-pair": "⟿ PROPHECY",
  "counting":      "# NUMBER",
  "question":      "? QUESTION",
  "quest-tease":   "⌬ QUEST",
};

export function refLabel(anchor: string | undefined): string {
  if (!anchor) return "";
  const parts = anchor.split(".");
  const bookId = parts[0] ?? "";
  const bookNameFn = rw().CODEX_DATA?.bookName;
  const book = (bookNameFn && bookNameFn(bookId)) || bookId.toUpperCase();
  return parts.length >= 3
    ? `${book} ${parts[1] ?? ""}:${parts[2] ?? ""}`
    : `${book} ${parts[1] ?? ""}`;
}

export function navigateToAnchor(anchor: string | undefined): void {
  if (!anchor) return;
  const jumpToRef = rw().codexJumpToRef;
  if (typeof jumpToRef === "function") {
    const parts = anchor.split(".");
    const bookId = parts[0] ?? "";
    const bookNameFn = rw().CODEX_DATA?.bookName;
    const book = (bookNameFn && bookNameFn(bookId)) || bookId;
    jumpToRef(
      parts.length >= 3
        ? `${book} ${parts[1] ?? ""}:${parts[2] ?? ""}`
        : `${book} ${parts[1] ?? ""}`,
    );
  } else {
    window.dispatchEvent(new CustomEvent("codex:navigate", { detail: { anchor } }));
  }
}
