// ai-quests — network layer (migrated faithfully from ai-quests.jsx). Two async
// functions: generateQuest() POSTs to /api/chat for a structured 5-8-step quest,
// generateFeedback() requests warm prose feedback on the user's answers. Both use
// the same /api/chat shape as oracle/passage-guide, so every configured AI engine
// (Anthropic, xAI, Ollama) works without change.
import {
  getTweaks,
  extractJson,
  newQuestId,
} from "./helpers.js";
import type { Quest, QuestStep, Answers } from "./helpers.js";

interface ChatResponse {
  text?: string;
  error?: string;
}

// ── Quest generation ───────────────────────────────────────────────────────────
export async function generateQuest(theme: string): Promise<Quest> {
  const t = getTweaks();
  const system = `You are CODEX QUEST DESIGNER. Generate a multi-step guided scripture quest on the user's theme. Return ONLY JSON with this exact shape:
{
  "title": "...",
  "blurb": "1-2 sentence overview",
  "estimate_minutes": 15,
  "steps": [
    {
      "n": 1,
      "passage": "Genesis 12:1-9",
      "passage_ref": "gen.12.1-9",
      "intro": "Brief framing (1-2 sentences) of why this passage matters here.",
      "question": "A thoughtful, open question that invites the user to respond from the text.",
      "guidance": "A hint the user can reveal — points without giving the answer."
    }
  ],
  "synthesis_prompt": "After all steps, ask the user to write a 1-paragraph reflection tying the thread together."
}
Rules: 5-8 steps. Scripture-faithful. Engaging questions, not catechism. Each step must reference a real Bible passage. Output only JSON, no preamble.`;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: t.provider,
      model: t.model,
      system,
      messages: [{ role: "user", content: String(theme || "").trim() }],
      max_tokens: 2500,
    }),
  });
  const d = (await r.json()) as ChatResponse;
  if (!d || !d.text) {
    throw new Error(d && d.error ? d.error : "No response from AI engine.");
  }

  const parsed = extractJson(d.text);
  const stepsRaw = parsed ? parsed["steps"] : undefined;
  if (!parsed || !Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    throw new Error("AI did not return a valid quest. Try a different theme.");
  }

  // Normalize
  const quest: Quest = {
    id: newQuestId(),
    theme: String(theme || "").trim(),
    created: Date.now(),
    title: String(parsed["title"] ?? ""),
    blurb: String(parsed["blurb"] ?? ""),
    estimate_minutes: Number(parsed["estimate_minutes"] ?? 15),
    synthesis_prompt: parsed["synthesis_prompt"]
      ? String(parsed["synthesis_prompt"])
      : undefined,
    steps: stepsRaw.map((s: unknown, i: number): QuestStep => {
      const st =
        s !== null && typeof s === "object" && !Array.isArray(s)
          ? (s as Record<string, unknown>)
          : {};
      return {
        n: i + 1,
        passage: String(st["passage"] ?? ""),
        passage_ref: String(st["passage_ref"] ?? ""),
        intro: String(st["intro"] ?? ""),
        question: String(st["question"] ?? ""),
        guidance: String(st["guidance"] ?? ""),
      };
    }),
  };
  return quest;
}

// ── Feedback generation ────────────────────────────────────────────────────────
export async function generateFeedback(quest: Quest, answers: Answers): Promise<string> {
  const t = getTweaks();
  const compiled = quest.steps
    .map((s) => {
      const a = answers[s.n] ?? "";
      return `Step ${s.n} — ${s.passage}\nQ: ${s.question}\nA: ${a || "(no answer)"}`;
    })
    .join("\n\n");

  const system =
    "You are a thoughtful, kind, scripture-rich teacher. Read the user's answers across this scripture quest and give honest, warm, specific feedback. Highlight any genuine insights they showed. Where they missed something important, gently point at the text. Close with ONE concrete follow-up reading suggestion (book + chapter). 200-300 words. Plain prose — no headings, no bullets.";
  const userMsg = `Quest theme: ${quest.theme}\nQuest title: ${quest.title}\n\nUser's reflections:\n\n${compiled}`;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: t.provider,
      model: t.model,
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 900,
    }),
  });
  const d = (await r.json()) as ChatResponse;
  if (!d || !d.text) {
    throw new Error(d && d.error ? d.error : "No feedback returned.");
  }
  return d.text.trim();
}
