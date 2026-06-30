// llm — provider registry: maps a provider id to an adapter + endpoint + model
// routing. Remote providers and local backends are uniform here — "local" is
// just an openai-compatible preset with a configurable baseUrl, so Ollama, LM
// Studio, llama.cpp, vLLM, LocalAI all flow through the same code path. Add a
// provider by adding a preset (or registering one at runtime).
import type { AdapterId, LlmAdapter, ResolvedConfig } from "./types.js";
import { openaiAdapter } from "./adapters/openai.js";
import { anthropicAdapter } from "./adapters/anthropic.js";
import { geminiAdapter } from "./adapters/gemini.js";
import { resolveModel } from "./models.js";

export const ADAPTERS: Record<AdapterId, LlmAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
};

export interface ProviderPreset {
  adapter: AdapterId;
  /** Response engine label. */
  engine: string;
  /** Routing key for cross-provider model resolution (see models.ts). */
  modelKey: string;
  baseUrl?: string;
  defaultModel?: string;
  browserDirect?: boolean;
  /** A built-in default base URL for a local backend (overridable per call). */
  localDefaultBaseUrl?: string;
}

const OPENAI = (engine: string, baseUrl: string, extra: Partial<ProviderPreset> = {}): ProviderPreset => ({ adapter: "openai", engine, modelKey: engine, baseUrl, ...extra });

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  // ── remote, bespoke wire formats ──
  anthropic: { adapter: "anthropic", engine: "anthropic", modelKey: "anthropic", browserDirect: true },
  gemini: { adapter: "gemini", engine: "gemini", modelKey: "gemini" },
  // ── remote, openai-compatible ──
  grok: OPENAI("grok", "https://api.x.ai/v1/chat/completions", { modelKey: "grok" }),
  xai: OPENAI("grok", "https://api.x.ai/v1/chat/completions", { modelKey: "grok" }), // alias
  groq: OPENAI("groq", "https://api.groq.com/openai/v1/chat/completions", { modelKey: "groq" }),
  openai: OPENAI("openai", "https://api.openai.com/v1/chat/completions", { modelKey: "openai", defaultModel: "gpt-4o-mini" }),
  openrouter: OPENAI("openrouter", "https://openrouter.ai/api/v1/chat/completions", { modelKey: "openrouter" }),
  // ── local / self-hosted, openai-compatible (baseUrl overridable per call) ──
  ollama: OPENAI("ollama", "http://localhost:11434/v1/chat/completions", { modelKey: "ollama", localDefaultBaseUrl: "http://localhost:11434/v1/chat/completions" }),
  lmstudio: OPENAI("local", "http://localhost:1234/v1/chat/completions", { modelKey: "local", localDefaultBaseUrl: "http://localhost:1234/v1/chat/completions" }),
  llamacpp: OPENAI("local", "http://localhost:8080/v1/chat/completions", { modelKey: "local", localDefaultBaseUrl: "http://localhost:8080/v1/chat/completions" }),
  vllm: OPENAI("local", "http://localhost:8000/v1/chat/completions", { modelKey: "local", localDefaultBaseUrl: "http://localhost:8000/v1/chat/completions" }),
  // a generic local target — caller supplies baseUrl.
  local: { adapter: "openai", engine: "local", modelKey: "local" },
};

export function getPreset(provider: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS[provider];
}

export function registerProvider(id: string, preset: ProviderPreset): void {
  PROVIDER_PRESETS[id] = preset;
}

export interface ResolveOpts {
  apiKey?: string;
  model?: string;
  /** Override the endpoint (required for the generic `local` provider). */
  baseUrl?: string;
  /** Local default model for openai-compatible/local backends. */
  localDefaultModel?: string;
  browserDirect?: boolean;
  extraHeaders?: Record<string, string>;
  temperature?: number;
}

// Resolve a provider id + options into a concrete target the client can run.
// An unknown provider id is treated as a custom openai-compatible endpoint.
export function resolveConfig(provider: string, opts: ResolveOpts = {}): ResolvedConfig {
  const preset = PROVIDER_PRESETS[provider] || { adapter: "openai" as AdapterId, engine: provider, modelKey: provider };
  const model = resolveModel(preset.modelKey, opts.model, opts.localDefaultModel ?? preset.defaultModel ?? "");
  const cfg: ResolvedConfig = {
    adapter: preset.adapter,
    engine: preset.engine,
    model,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl ?? preset.baseUrl ?? preset.localDefaultBaseUrl,
    browserDirect: opts.browserDirect ?? preset.browserDirect,
    extraHeaders: opts.extraHeaders,
    temperature: opts.temperature,
  };
  return cfg;
}
