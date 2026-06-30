// oracle2 — tool parsing + system constants (migrated faithfully from oracle2.jsx).
// oracle2ParseToolCall is pure and tested in helpers.test.ts. oracle2ToolDirective
// reads window.CODEX_KERNEL via the typed boundary ow().
import { ow } from "./oracle2-window.js";
import { ORACLE2_TOOL_STEPS } from "./data.js";

export const ORACLE2_SYSTEM = `You are THE ORACLE — the scholarly companion inside CODEX, a Bible-study instrument.
Voice: precise, warm, unhurried. A careful scholar, never a preacher.
HONESTY RULES (load-bearing — they survive every redesign):
- CITE chapter and verse (e.g. John 1:14) for every claim that has one. Refs written plainly become clickable chips the reader uses to CHECK YOUR WORK.
- NEVER fabricate a quotation. If unsure of exact wording, paraphrase and cite. Never invent folio numbers, surahs, or sources.
- When traditions disagree, SAY SO and name the positions — label genuinely disputed readings CONTESTED. Never present one side as settled.
- Hebrew/Greek: give the word in its own script + transliteration + gloss.
- Keep answers tight: 2-5 short paragraphs unless the question demands more. No filler, no emoji.
- You are not scripture and you say so when the line could blur.
You also help with CODEX itself (settings, panels, features) — never refuse an app question; prefer DOING it with a tool or offering a codex:buttons action over describing menu paths.`;

export interface Invocation {
  id: string;
  glyph: string;
  label: string;
  prompt: (ref: string) => string;
}

export const ORACLE2_INVOCATIONS: Invocation[] = [
  {
    id: "illuminate",
    glyph: "✦",
    label: "ILLUMINATE",
    prompt: (ref) => `Illuminate ${ref}: the plain meaning in its immediate context, in your tight scholarly voice.`,
  },
  {
    id: "context",
    glyph: "◔",
    label: "CONTEXT",
    prompt: (ref) =>
      `Give the historical and cultural context a first-century (or original-era) hearer would bring to ${ref}.`,
  },
  {
    id: "tongue",
    glyph: "א",
    label: "TONGUE",
    prompt: (ref) =>
      `Take me beneath the translation of ${ref}: the key Hebrew or Greek words, their script, transliteration, range of meaning, and what the English flattens.`,
  },
  {
    id: "threads",
    glyph: "❂",
    label: "THREADS",
    prompt: (ref) =>
      `The strongest cross-references for ${ref} — where else the canon speaks to this, and what each thread adds. Cite each, and if the web is rich, consider a codex:flow or codex:verse-grid.`,
  },
  {
    id: "contra",
    glyph: "⚖",
    label: "CONTRA",
    prompt: (ref) =>
      `Steelman the readings AGAINST the obvious interpretation of ${ref}. The strongest scholarly objections and minority positions, fairly stated, CONTESTED labels where due.`,
  },
];

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export function oracle2ParseToolCall(text: string | null | undefined): ToolCall | null {
  if (!text) return null;
  const s = String(text)
    .trim()
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  // A tool call is the WHOLE reply, not JSON buried in prose.
  if (a > 8) return null;
  try {
    const raw: unknown = JSON.parse(s.slice(a, b + 1));
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      if (typeof o["tool"] === "string" && o["tool"].trim()) {
        const tool = o["tool"].trim();
        const rawArgs = o["args"];
        const args =
          rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
        return { tool, args };
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function oracle2ToolDirective(): string {
  let specs: Array<{ name: string; description?: string }> = [];
  try {
    const K = ow().CODEX_KERNEL;
    if (K && typeof K.toolSpecs === "function") specs = K.toolSpecs();
    else if (K && typeof K.tools === "function") specs = K.tools().map((n) => ({ name: n, description: "" }));
  } catch {
    // ignore
  }
  if (!specs.length) return "";
  const lines = specs.map((s) => `  · ${s.name}${s.description ? ` — ${s.description}` : ""}`);
  return (
    `\n\nIN-APP TOOLS (executed locally by CODEX — you choose, the app runs):\n${lines.join("\n")}\n\n` +
    `To call a tool, reply with ONLY one JSON object — no prose, no fences:\n{"tool":"<name>","args":{...}}\n` +
    `The result returns as a user message "RESULT of <name>: …". Chain at most ${ORACLE2_TOOL_STEPS} calls per question, ` +
    `then you MUST answer in prose (rich output rules above). Never guess what a tool would return — call it. ` +
    `If no tool is needed, just answer.`
  );
}
