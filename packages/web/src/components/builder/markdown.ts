// builder — reference formatting + Markdown export + the print-time MD→HTML
// renderer (migrated verbatim from builder.jsx). bookName reads window.CODEX_DATA
// for the friendly book name; everything else is pure given that lookup.
import type { Study } from "./store.js";
import { bw } from "./builder-window.js";

// ── Book lookup for verse formatting ────────────────────────────────
export function bookName(bookId: string): string {
  try {
    const data = bw().CODEX_DATA;
    const books = (data && data.books) || [];
    const b = books.find((x) => x.id === bookId);
    return b ? (b.name as string) : bookId;
  } catch {
    return bookId;
  }
}
export function formatRef(ref: unknown): string {
  if (!ref || typeof ref !== "string") return (ref || "") as string;
  const parts = ref.split(".");
  const bid = parts[0];
  const ch = parts[1];
  const v = parts[2];
  if (!bid || !ch) return ref;
  return `${bookName(bid)} ${ch}${v ? ":" + v : ""}`;
}

// ── Markdown export ─────────────────────────────────────────────────
export function studyToMarkdown(study: Study | null | undefined): string {
  if (!study) return "";
  const lines: string[] = [`# ${study.title || "Untitled study"}`, ""];
  for (const sec of study.sections) {
    lines.push(`## ${sec.heading || ""}`, "");
    for (const it of sec.items) {
      if (it.type === "verse") {
        lines.push(`> **${formatRef(it.ref)}** ${it.translation ? `*(${String(it.translation).toUpperCase()})*` : ""}`);
        lines.push(`> ${String(it.text || "").trim()}`, "");
      } else if (it.type === "note") {
        lines.push(String(it.body || "").trim(), "");
      } else if (it.type === "panel") {
        lines.push(`**${it.kind || "Panel"}${it.source ? " — " + formatRef(it.source) : ""}:** ${String(it.body || "").trim()}`, "");
      } else if (it.type === "crossref") {
        lines.push(`- ↗ **${formatRef(it.ref)}**${it.note ? " — " + it.note : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Light MD → HTML for print (paragraphs, headings, blockquotes, lists) ──
export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] ?? c));
}
export function mdInline(s: unknown): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

// Pure MD→HTML converter (extracted from the legacy syncPrintable loop so it is
// testable). Returns the same `out.join("\n")` the legacy assigned to innerHTML.
export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false,
    inQuote = false;
  for (const ln of lines) {
    if (/^# /.test(ln)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      out.push(`<h1>${escapeHtml(ln.slice(2))}</h1>`);
    } else if (/^## /.test(ln)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      out.push(`<h2>${escapeHtml(ln.slice(3))}</h2>`);
    } else if (/^> /.test(ln)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (!inQuote) {
        out.push("<blockquote>");
        inQuote = true;
      }
      out.push(`<div>${mdInline(ln.slice(2))}</div>`);
    } else if (/^- /.test(ln)) {
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${mdInline(ln.slice(2))}</li>`);
    } else if (ln.trim() === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      out.push("");
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      out.push(`<p>${mdInline(ln)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  if (inQuote) out.push("</blockquote>");
  return out.join("\n");
}
