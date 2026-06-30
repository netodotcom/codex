// llm — model catalog + cross-provider resolution (faithful port of the model
// maps in direct-api.js). A model requested for one engine maps to a comparable
// tier on another (claude-haiku → grok-3-mini → llama-3.1-8b → gemini-2.0-flash),
// so switching the active engine keeps the user's intent. Local/OpenAI-compatible
// engines accept any model id verbatim.
import type { ModelInfo } from "./types.js";

export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";
export const XAI_DEFAULT_MODEL = "grok-3";
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";

const ANTHROPIC_ALLOWED = new Set(["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"]);
const GROQ_ALLOWED = new Set(["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "deepseek-r1-distill-llama-70b", "qwen-2.5-32b"]);
const GEMINI_ALLOWED = new Set(["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-thinking-exp"]);

const XAI_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5-20251001": "grok-3-mini",
  "claude-sonnet-4-6": "grok-3",
  "claude-opus-4-7": "grok-4",
};
const GROQ_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5-20251001": "llama-3.1-8b-instant",
  "claude-sonnet-4-6": "llama-3.3-70b-versatile",
  "claude-opus-4-7": "deepseek-r1-distill-llama-70b",
  "grok-3-mini": "llama-3.1-8b-instant",
  "grok-3": "llama-3.3-70b-versatile",
  "grok-4": "deepseek-r1-distill-llama-70b",
};
const GEMINI_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5-20251001": "gemini-2.0-flash",
  "claude-sonnet-4-6": "gemini-2.5-flash",
  "claude-opus-4-7": "gemini-2.5-pro",
  "grok-3-mini": "gemini-2.0-flash",
  "grok-3": "gemini-2.5-flash",
  "grok-4": "gemini-2.5-pro",
};

export const MODEL_CATALOG: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "fast" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "balanced" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "deepest" },
  ],
  grok: [
    { id: "grok-3-mini", label: "Grok 3 mini", tier: "fast" },
    { id: "grok-3", label: "Grok 3", tier: "balanced" },
    { id: "grok-4", label: "Grok 4", tier: "deepest" },
  ],
  groq: [
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", tier: "fast" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tier: "balanced" },
    { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", tier: "reasoning" },
    { id: "qwen-2.5-32b", label: "Qwen 2.5 32B", tier: "balanced" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", tier: "long context" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "fast" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "balanced" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "deepest" },
  ],
  ollama: [], // discovered at runtime from the daemon
};

export function isValidModelFor(provider: string, model: string | undefined): boolean {
  if (!model) return false;
  if (provider === "ollama" || provider === "openai" || provider === "openrouter" || provider === "local") return true;
  if (provider === "anthropic") return ANTHROPIC_ALLOWED.has(model);
  if (provider === "grok") return /^grok/.test(model);
  if (provider === "groq") return GROQ_ALLOWED.has(model);
  if (provider === "gemini") return GEMINI_ALLOWED.has(model);
  return false;
}

// Resolve a requested model for the target provider, cross-mapping where the
// requested id belongs to a different engine. `localDefault` is used for the
// local/openai-compatible engines (which accept any id verbatim).
export function resolveModel(provider: string, requested: string | undefined, localDefault = ""): string {
  switch (provider) {
    case "anthropic":
      return requested && ANTHROPIC_ALLOWED.has(requested) ? requested : ANTHROPIC_DEFAULT_MODEL;
    case "grok":
      return (requested && XAI_MODEL_MAP[requested]) || (requested && /^grok/.test(requested) ? requested : XAI_DEFAULT_MODEL);
    case "groq":
      return requested && GROQ_ALLOWED.has(requested) ? requested : (requested && GROQ_MODEL_MAP[requested]) || GROQ_DEFAULT_MODEL;
    case "gemini":
      return requested && GEMINI_ALLOWED.has(requested) ? requested : (requested && GEMINI_MODEL_MAP[requested]) || GEMINI_DEFAULT_MODEL;
    case "ollama":
      return requested || localDefault || "llama3.2";
    default:
      // openai / openrouter / local / any custom engine — accept verbatim.
      return requested || localDefault || "";
  }
}
