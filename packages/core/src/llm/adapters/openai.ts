// llm — generic OpenAI-compatible adapter. ONE wire format ( POST
// {baseUrl} {model, max_tokens, messages, stream:false} → choices[0].message )
// covers xAI/Grok, Groq, Ollama (/v1), OpenAI, OpenRouter, LM Studio, llama.cpp,
// vLLM, LocalAI, DeepSeek, Mistral, Together — any server that speaks
// /v1/chat/completions. The Authorization header is added only when a key is
// present (local daemons need none). Faithful to direct-api.js callGrok/callGroq/
// callOllama, which were identical bar URL/auth/label.
import { DEFAULT_MAX_TOKENS, LlmError, type ChatRequest, type ChatResponse, type HttpRequest, type LlmAdapter, type ModelInfo, type ResolvedConfig } from "../types.js";
import { flattenSystem, flattenContent } from "../flatten.js";

interface OpenAiChoice {
  message?: { content?: string };
}
interface OpenAiResponse {
  choices?: OpenAiChoice[];
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
}

function errorMessage(json: unknown, status: number): string {
  const j = json as { error?: { message?: string } | string } | null;
  const e = j?.error;
  const msg = (e && typeof e === "object" ? e.message || JSON.stringify(e) : e) || `HTTP ${status}`;
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

export const openaiAdapter: LlmAdapter = {
  id: "openai",

  buildRequest(req: ChatRequest, cfg: ResolvedConfig): HttpRequest {
    const sys = flattenSystem(req.system);
    const messages: Array<{ role: string; content: string }> = [];
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of req.messages || []) messages.push({ role: m.role, content: flattenContent(m.content) });
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(cfg.extraHeaders || {}) };
    if (cfg.apiKey) headers["Authorization"] = "Bearer " + cfg.apiKey;
    const payload: Record<string, unknown> = { model: cfg.model, max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS, messages, stream: false };
    // Only sent when the caller asks for it: the server set temperature 0.7,
    // the browser shim sent none (provider default). Both preserved.
    if (cfg.temperature != null) payload["temperature"] = cfg.temperature;
    return { url: cfg.baseUrl ?? "", method: "POST", headers, body: JSON.stringify(payload) };
  },

  parseResponse(status: number, json: unknown, cfg: ResolvedConfig): ChatResponse {
    if (status < 200 || status >= 300) throw new LlmError(status, errorMessage(json, status));
    const data = (json || {}) as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content || "";
    const u = data.usage || {};
    return {
      text,
      model: data.model || cfg.model,
      usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 },
      engine: cfg.engine,
    };
  },

  // OpenAI /v1/models and most compatibles (incl. Ollama's /v1/models) list here.
  buildModelsRequest(cfg: ResolvedConfig): HttpRequest {
    const base = (cfg.baseUrl ?? "").replace(/\/chat\/completions$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(cfg.extraHeaders || {}) };
    if (cfg.apiKey) headers["Authorization"] = "Bearer " + cfg.apiKey;
    return { url: base + "/models", method: "GET", headers };
  },

  parseModels(json: unknown): ModelInfo[] {
    const data = (json || {}) as { data?: Array<{ id?: string }> };
    return (data.data || []).filter((m) => m.id).map((m) => ({ id: m.id as string, label: m.id as string }));
  },
};
