// llm — Anthropic Messages API adapter (faithful port of direct-api.js
// callAnthropic). Native shape: system stays separate, message content is
// passed through (Anthropic accepts string or block arrays), the text is the
// concatenation of the type:"text" content blocks. The browser-direct header is
// the CORS opt-in for the static-hosting path.
import { DEFAULT_MAX_TOKENS, LlmError, type ChatRequest, type ChatResponse, type HttpRequest, type LlmAdapter, type ResolvedConfig } from "../types.js";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string } | string;
}

function errorMessage(json: unknown, status: number): string {
  const j = json as { error?: { message?: string } | string } | null;
  const e = j?.error;
  const msg = (e && typeof e === "object" ? e.message : e) || `HTTP ${status}`;
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

export const anthropicAdapter: LlmAdapter = {
  id: "anthropic",

  buildRequest(req: ChatRequest, cfg: ResolvedConfig): HttpRequest {
    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: req.messages || [],
    };
    if (req.system) body["system"] = req.system;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey ?? "",
      "anthropic-version": cfg.anthropicVersion || ANTHROPIC_VERSION,
      ...(cfg.extraHeaders || {}),
    };
    if (cfg.browserDirect) headers["anthropic-dangerous-direct-browser-access"] = "true";
    return { url: cfg.baseUrl || ANTHROPIC_URL, method: "POST", headers, body: JSON.stringify(body) };
  },

  parseResponse(status: number, json: unknown, cfg: ResolvedConfig): ChatResponse {
    if (status < 200 || status >= 300) throw new LlmError(status, errorMessage(json, status));
    const data = (json || {}) as AnthropicResponse;
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");
    const u = data.usage || {};
    return {
      text,
      model: data.model || cfg.model,
      usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 },
      engine: cfg.engine,
    };
  },
};
