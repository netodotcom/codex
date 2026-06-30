// llm — unified multi-provider + local LLM client (@codex/core/llm).
//
// One typed, testable module that integrates remote providers (Anthropic, xAI,
// Groq, Gemini, OpenAI, OpenRouter) and ANY local/self-hosted model through a
// generic OpenAI-compatible adapter (Ollama, LM Studio, llama.cpp, vLLM, …).
// Consolidates the duplicated plumbing from direct-api.js + server.js.
export * from "./types.js";
export { flattenSystem, flattenContent } from "./flatten.js";
export { MODEL_CATALOG, resolveModel, isValidModelFor, ANTHROPIC_DEFAULT_MODEL, XAI_DEFAULT_MODEL, GROQ_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL } from "./models.js";
export { openaiAdapter } from "./adapters/openai.js";
export { anthropicAdapter, ANTHROPIC_URL, ANTHROPIC_VERSION } from "./adapters/anthropic.js";
export { geminiAdapter, GEMINI_URL_BASE } from "./adapters/gemini.js";
export { ADAPTERS, PROVIDER_PRESETS, getPreset, registerProvider, resolveConfig, type ProviderPreset, type ResolveOpts } from "./registry.js";
export { createLlmClient, type LlmClient, type FetchFn, type FetchLike } from "./client.js";
