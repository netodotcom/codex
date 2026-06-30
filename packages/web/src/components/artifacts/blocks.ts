// artifacts — block parsing (migrated VERBATIM from artifacts.jsx). Splits model
// text into fences, headings, lists, quotes, tables, hrs and paragraphs. Pure
// and ground-truth tested; exposed as CODEX_ARTIFACTS.parseBlocks.

export type Block =
  | { type: "fence"; lang: string; code: string }
  | { type: "h"; level: number; text: string }
  | { type: "hr" }
  | { type: "quote"; text: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "p"; text: string };

type ListBlock = { type: "list"; ordered: boolean; items: string[] };

export function artParseBlocks(text: unknown): Block[] {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] | null = null;
  let list: ListBlock | null = null;
  const flush = (): void => {
    if (list) { blocks.push(list); list = null; }
    if (para) { blocks.push({ type: "p", text: para.join(" ") }); para = null; }
  };
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/\s+$/, "");
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^```([\w:-]*)\s*$/))) {
      flush();
      const lang = (m[1] || "").toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) { buf.push(lines[i] ?? ""); i++; }
      i++; // closing fence (or EOF)
      blocks.push({ type: "fence", lang, code: buf.join("\n") });
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); blocks.push({ type: "h", level: (m[1] ?? "").length, text: m[2] ?? "" }); i++; continue; }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); blocks.push({ type: "hr" }); i++; continue; }
    if (/^\s*>\s?/.test(line)) { flush(); blocks.push({ type: "quote", text: line.replace(/^\s*>\s?/, "") }); i++; continue; }
    // table: a |…| line whose NEXT line is the |---|---| separator
    const sep = lines[i + 1];
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && sep !== undefined && /^\s*\|?[\s:|-]+\|?\s*$/.test(sep) && /-/.test(sep)) {
      flush();
      const splitRow = (s: string): string[] => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i] ?? "")) { rows.push(splitRow(lines[i] ?? "")); i++; }
      blocks.push({ type: "table", head, rows });
      continue;
    }
    if ((m = line.match(/^\s*(?:[*\-•]|\d+[.)])\s+(.*)$/))) {
      if (para) { blocks.push({ type: "p", text: para.join(" ") }); para = null; }
      const ordered = /^\s*\d+[.)]/.test(line);
      if (!list || list.ordered !== ordered) { if (list) blocks.push(list); list = { type: "list", ordered, items: [] }; }
      list.items.push(m[1] ?? "");
      i++; continue;
    }
    if (list) { blocks.push(list); list = null; }
    para = para || [];
    para.push(line);
    i++;
  }
  flush();
  return blocks;
}
