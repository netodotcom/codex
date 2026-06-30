// llm — Google Gemini generateContent adapter (faithful port of direct-api.js
// callGemini). Native, NOT OpenAI-shape: the key rides as a ?key= query param,
// the system prompt lives in systemInstruction, and the "assistant" role maps to
// "model". The response text is the concatenation of the candidate's parts.
import { DEFAULT_MAX_TOKENS, LlmError, type ChatRequest, type ChatResponse, type HttpRequest, type LlmAdapter, type ResolvedConfig } from "../types.js";
import { flattenSystem, flattenContent } from "../flatten.js";

export const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string } | string;
}

function errorMessage(json: unknown, status: number): string {
  const j = json as { error?: { message?: string } | string } | null;
  const e = j?.error;
  const msg = (e && typeof e === "object" ? e.message || e : e) || `HTTP ${status}`;
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

export const geminiAdapter: LlmAdapter = {
  id: "gemini",

  buildRequest(req: ChatRequest, cfg: ResolvedConfig): HttpRequest {
    const sys = flattenSystem(req.system);
    const contents = (req.messages || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: flattenContent(m.content) }],
    }));
    const body: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS, temperature: cfg.temperature ?? 0.7 },
    };
    if (sys) body["systemInstruction"] = { parts: [{ text: sys }] };
    const base = cfg.baseUrl || GEMINI_URL_BASE;
    const url = `${base}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey ?? "")}`;
    return { url, method: "POST", headers: { "Content-Type": "application/json", ...(cfg.extraHeaders || {}) }, body: JSON.stringify(body) };
  },

  parseResponse(status: number, json: unknown, cfg: ResolvedConfig): ChatResponse {
    if (status < 200 || status >= 300) throw new LlmError(status, errorMessage(json, status));
    const data = (json || {}) as GeminiResponse;
    const cand = data.candidates?.[0] || {};
    const parts = cand.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("");
    const um = data.usageMetadata || {};
    return {
      text,
      model: cfg.model,
      usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 },
      engine: cfg.engine,
    };
  },
};
