// llm — unified types for the multi-provider + local LLM client.
//
// Consolidates the duplicated provider plumbing that lived in direct-api.js
// (browser shim) and server.js (Node). The request/response shape mirrors the
// app's existing /api/chat contract so both consumers can adopt this module
// without changing their callers. Pure: an adapter turns a unified request into
// an HttpRequest and a provider response back into a unified ChatResponse; the
// only IO (fetch) is injected by the client.

export type Role = "system" | "user" | "assistant" | "model";

export interface ContentBlock {
  type?: string;
  text?: string;
}
/** Anthropic-style content: a string, an array of text blocks, or (defensively,
 *  as the legacy accepted) a single block object. */
export type MessageContent = string | ContentBlock | Array<string | ContentBlock>;

export interface ChatMessage {
  role: Role | string;
  content: MessageContent;
}

/** System prompt: a string, an array of blocks, or a single block object. */
export type SystemPrompt = string | Array<string | ContentBlock> | ContentBlock;

export interface ChatRequest {
  /** Requested model id (may be cross-mapped by the registry per provider). */
  model?: string;
  system?: SystemPrompt;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  usage: Usage;
  /** The routing engine label (anthropic | grok | groq | gemini | ollama | …). */
  engine: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  tier?: string;
}

/** A provider-native HTTP request, ready for the injected fetch. */
export interface HttpRequest {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body?: string;
}

export class LlmError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "LlmError";
  }
}

/** Which adapter handles the wire format. */
export type AdapterId = "openai" | "anthropic" | "gemini";

/** A fully-resolved target: adapter + endpoint + credentials + model. */
export interface ResolvedConfig {
  adapter: AdapterId;
  /** Label surfaced on the response (and used by the app's engine switch). */
  engine: string;
  /** Full endpoint URL for openai-compatible / the base for gemini. */
  baseUrl?: string;
  apiKey?: string;
  model: string;
  /** Anthropic only. */
  anthropicVersion?: string;
  /** Anthropic only — adds the browser-direct header (CORS opt-in). */
  browserDirect?: boolean;
  /** Extra headers (e.g. OpenRouter's HTTP-Referer / X-Title). */
  extraHeaders?: Record<string, string>;
  temperature?: number;
}

export interface LlmAdapter {
  id: AdapterId;
  buildRequest(req: ChatRequest, cfg: ResolvedConfig): HttpRequest;
  /** Throws LlmError on a non-2xx / malformed response. cfg supplies the engine
   *  label and the model fallback (the generic adapter serves many engines). */
  parseResponse(status: number, json: unknown, cfg: ResolvedConfig): ChatResponse;
  /** Optional model discovery (local daemons / openai /v1/models). */
  buildModelsRequest?(cfg: ResolvedConfig): HttpRequest;
  parseModels?(json: unknown): ModelInfo[];
}

export const DEFAULT_MAX_TOKENS = 1024;
