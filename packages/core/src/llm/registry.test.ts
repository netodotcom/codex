import { describe, it, expect } from "vitest";
import { resolveConfig, registerProvider, getPreset } from "./registry.js";

describe("resolveConfig", () => {
  it("resolves a remote openai-compatible provider with cross-mapped model", () => {
    const cfg = resolveConfig("grok", { apiKey: "xai-K", model: "claude-haiku-4-5-20251001" });
    expect(cfg).toMatchObject({ adapter: "openai", engine: "grok", baseUrl: "https://api.x.ai/v1/chat/completions", apiKey: "xai-K", model: "grok-3-mini" });
  });

  it("resolves anthropic with its native adapter + browser-direct", () => {
    const cfg = resolveConfig("anthropic", { apiKey: "sk-ant", model: "claude-opus-4-7" });
    expect(cfg).toMatchObject({ adapter: "anthropic", engine: "anthropic", model: "claude-opus-4-7", browserDirect: true });
  });

  it("resolves Ollama to its local endpoint with no key, accepting any model", () => {
    const cfg = resolveConfig("ollama", { model: "qwen2.5:7b" });
    expect(cfg).toMatchObject({ adapter: "openai", engine: "ollama", baseUrl: "http://localhost:11434/v1/chat/completions", model: "qwen2.5:7b" });
    expect(cfg.apiKey).toBeUndefined();
  });

  it("resolves a generic local target from a caller-supplied baseUrl", () => {
    const cfg = resolveConfig("local", { baseUrl: "http://192.168.1.5:1234/v1/chat/completions", model: "my-finetune" });
    expect(cfg).toMatchObject({ adapter: "openai", engine: "local", baseUrl: "http://192.168.1.5:1234/v1/chat/completions", model: "my-finetune" });
  });

  it("treats an unknown provider id as a custom openai-compatible endpoint", () => {
    const cfg = resolveConfig("my-server", { baseUrl: "http://host/v1/chat/completions", model: "m" });
    expect(cfg).toMatchObject({ adapter: "openai", engine: "my-server", baseUrl: "http://host/v1/chat/completions", model: "m" });
  });
});

describe("registerProvider", () => {
  it("adds a new provider preset that resolveConfig can use", () => {
    registerProvider("together", { adapter: "openai", engine: "together", modelKey: "local", baseUrl: "https://api.together.xyz/v1/chat/completions" });
    expect(getPreset("together")?.baseUrl).toBe("https://api.together.xyz/v1/chat/completions");
    const cfg = resolveConfig("together", { apiKey: "k", model: "meta-llama/Llama-3.3-70B" });
    expect(cfg).toMatchObject({ adapter: "openai", engine: "together", model: "meta-llama/Llama-3.3-70B" });
  });
});
