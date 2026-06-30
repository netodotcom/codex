// help — on-demand AI translation of an article (migrated verbatim from
// help.jsx). Two parallel POSTs to /api/chat (body + title) with a precise
// translator system prompt that preserves markdown. Output is cached by the
// caller via tr-cache.
import { LANG_NAME, type Article } from "./data.js";

export interface TranslateResult {
  body: string;
  title: string;
}

interface ChatResponse {
  text?: string;
  error?: string;
}

export async function translateArticle(article: Article, langCode: string): Promise<TranslateResult> {
  const langName = LANG_NAME[langCode] || langCode;
  const system =
    `You are a precise translator. Translate the user's markdown content to ${langName}. ` +
    `PRESERVE all markdown formatting exactly (headings, bold, italic, links, code, lists). ` +
    `Translate prose only. Do not add commentary. Output only the translated markdown.`;
  const titleSystem =
    `You are a precise translator. Translate the user's short title to ${langName}. ` +
    `Output only the translated title text, no quotes, no commentary.`;

  const post = (sys: string, content: string | undefined, max: number): Promise<string> => fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      system: sys,
      messages: [{ role: "user", content }],
      max_tokens: max,
    }),
  }).then(async (r) => {
    const data = await r.json() as ChatResponse;
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return (data.text || "").trim();
  });

  const [body, title] = await Promise.all([
    post(system, article.body, 2000),
    post(titleSystem, article.title, 120),
  ]);
  return { body, title };
}
