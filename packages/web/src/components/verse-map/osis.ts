// verse-map — OSIS reference helpers (Backlog 4.1, sub-slice 2).
//
// Extracted from verse-map.jsx. The legacy read window.CODEX_DATA.books; here we
// consume @codex/core's book registry (the books default to the core list, but
// are injectable for testing). Faithful fuzzy resolution preserved.

import { books as coreBooks, type Book } from "@codex/core/data";

export function mapResolveBook(osisBook: string, bookList: Book[] = coreBooks): Book | null {
  const want = String(osisBook || "").toLowerCase();
  return (
    bookList.find((b) => (b.id || "").toLowerCase() === want) ||
    bookList.find(
      (b) => (b.id || "").toLowerCase().startsWith(want) || want.startsWith((b.id || "").toLowerCase()),
    ) ||
    null
  );
}

// OSIS-ish ref ("gen.11.31") → display label ("Genesis 11:31").
export function osisDisplay(osis: string, bookList: Book[] = coreBooks): string {
  const head = String(osis || "").split("-")[0] ?? "";
  const parts = head.split(".");
  const b = mapResolveBook(parts[0] ?? "", bookList);
  const name = b ? b.name : (parts[0] || "").toUpperCase();
  if (parts[2]) return `${name} ${parts[1]}:${parts[2]}`;
  return parts[1] ? `${name} ${parts[1]}` : name;
}
