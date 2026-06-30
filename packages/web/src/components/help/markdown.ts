// help — the in-app markdown renderer (migrated verbatim from help.jsx). Adds:
// blockquotes (rendered as pull quotes), fenced code blocks with a copy button,
// auto-numbered <h2> sections via CSS counters, and an XSS guard that strips
// javascript:/data:/vbscript: URIs from markdown links. The output HTML is fed
// into dangerouslySetInnerHTML, so it MUST stay byte-identical to the legacy.

export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function inlineMd(s: string): string {
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return ` C${codes.length - 1} `;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, t: string, u: string) => {
      // Block javascript: and data: URIs — prevent XSS via markdown links
      const lc = u.toLowerCase().replace(/[\s\x00-\x1f]/g, "");
      if (/^(javascript|data|vbscript):/i.test(lc)) return t;
      return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`;
    });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/ C(\d+) /g, (_m, i: string) => `<code>${escapeHtml(codes[+i])}</code>`);
  return s;
}

interface MdList {
  tag: "ul" | "ol";
  items: string[];
}
interface MdFence {
  lang: string;
  lines: string[];
}

export function renderMarkdown(md: string | null | undefined): string {
  const lines = String(md || "").split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];
  let list: MdList | null = null;
  let quote: string[] | null = null;
  let fence: MdFence | null = null;

  const flushPara = (): void => {
    if (para.length) {
      out.push(`<p>${inlineMd(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${list.tag}>`);
      list = null;
    }
  };
  const flushQuote = (): void => {
    if (quote) {
      out.push(`<blockquote class="cx-help-quote">${inlineMd(quote.join(" "))}</blockquote>`);
      quote = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Fenced code block
    const fmatch = line.match(/^```(\w*)\s*$/);
    if (fmatch) {
      if (fence) {
        const code = fence.lines.join("\n");
        out.push(
          `<div class="cx-help-code"><button class="cx-help-code-copy" data-copy="${escapeHtml(code)}" aria-label="Copy code">⎘ copy</button><pre><code>${escapeHtml(code)}</code></pre></div>`
        );
        fence = null;
      } else {
        flushPara(); flushList(); flushQuote();
        fence = { lang: fmatch[1] || "", lines: [] };
      }
      continue;
    }
    if (fence) { fence.lines.push(raw); continue; }

    if (!line.trim()) { flushPara(); flushList(); flushQuote(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      if (!quote) quote = [];
      quote.push(m[1] ?? "");
      continue;
    } else { flushQuote(); }

    if ((m = line.match(/^#{3}\s+(.*)$/))) { flushPara(); flushList(); out.push(`<h3>${inlineMd(m[1] ?? "")}</h3>`); continue; }
    if ((m = line.match(/^##\s+(.*)$/)))   { flushPara(); flushList(); out.push(`<h2>${inlineMd(m[1] ?? "")}</h2>`); continue; }
    if ((m = line.match(/^#\s+(.*)$/)))    { flushPara(); flushList(); out.push(`<h1>${inlineMd(m[1] ?? "")}</h1>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1] ?? ""); continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1] ?? ""); continue;
    }
    para.push(line.trim());
  }
  flushPara(); flushList(); flushQuote();
  if (fence) {
    const code = fence.lines.join("\n");
    out.push(`<div class="cx-help-code"><button class="cx-help-code-copy" data-copy="${escapeHtml(code)}" aria-label="Copy code">⎘ copy</button><pre><code>${escapeHtml(code)}</code></pre></div>`);
  }
  return out.join("\n");
}

// Snippet around the first occurrence of a query, with the match wrapped
// in a styled span so we can underline it (no garish <mark>).
export function makeSnippet(body: string | null | undefined, q: string, max = 140): string {
  const text = String(body || "").replace(/[#*`>\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return text.slice(0, max) + (text.length > max ? "…" : "");
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, max) + (text.length > max ? "…" : "");
  const start = Math.max(0, i - 40);
  const end   = Math.min(text.length, i + q.length + 80);
  const pre   = (start > 0 ? "…" : "") + text.slice(start, i);
  const hit   = text.slice(i, i + q.length);
  const post  = text.slice(i + q.length, end) + (end < text.length ? "…" : "");
  return `${escapeHtml(pre)}<span class="cx-help-hl">${escapeHtml(hit)}</span>${escapeHtml(post)}`;
}
