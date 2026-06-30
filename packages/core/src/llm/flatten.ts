// llm — content flattening (faithful port of direct-api.js flattenSystem /
// flattenContent). Anthropic carries system + message content as strings OR
// arrays of text blocks; the OpenAI-shape and Gemini adapters need a single
// string, so we flatten on the way out.
import type { SystemPrompt, MessageContent } from "./types.js";

export function flattenSystem(sys: SystemPrompt | undefined | null): string {
  if (!sys) return "";
  if (typeof sys === "string") return sys;
  if (Array.isArray(sys)) {
    return sys
      .map((s) => (typeof s === "string" ? s : (s && s.text) || ""))
      .join("\n\n")
      .trim();
  }
  if (typeof sys === "object" && sys.text) return sys.text;
  return "";
}

export function flattenContent(c: MessageContent | undefined | null): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : (x && x.text) || "")).join("\n");
  if (c && typeof c === "object" && c.text) return c.text;
  return "";
}
