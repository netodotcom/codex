import { describe, it, expect } from "vitest";
import { resolveModel, isValidModelFor, MODEL_CATALOG } from "./models.js";

describe("resolveModel (ground truth from direct-api.js)", () => {
  it("anthropic keeps an allowed id, else defaults", () => {
    expect(resolveModel("anthropic", "claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(resolveModel("anthropic", "nope")).toBe("claude-haiku-4-5-20251001");
  });
  it("grok cross-maps a claude id and keeps grok-* verbatim", () => {
    expect(resolveModel("grok", "claude-haiku-4-5-20251001")).toBe("grok-3-mini");
    expect(resolveModel("grok", "grok-4")).toBe("grok-4");
    expect(resolveModel("grok", "unknown")).toBe("grok-3");
  });
  it("groq keeps allowed, cross-maps claude/grok ids, else defaults", () => {
    expect(resolveModel("groq", "llama-3.1-8b-instant")).toBe("llama-3.1-8b-instant");
    expect(resolveModel("groq", "claude-opus-4-7")).toBe("deepseek-r1-distill-llama-70b");
    expect(resolveModel("groq", "grok-3")).toBe("llama-3.3-70b-versatile");
    expect(resolveModel("groq", "xxx")).toBe("llama-3.3-70b-versatile");
  });
  it("gemini keeps allowed, cross-maps, else defaults", () => {
    expect(resolveModel("gemini", "gemini-2.5-pro")).toBe("gemini-2.5-pro");
    expect(resolveModel("gemini", "claude-sonnet-4-6")).toBe("gemini-2.5-flash");
    expect(resolveModel("gemini", "zzz")).toBe("gemini-2.0-flash");
  });
  it("ollama accepts any id, falling back to a local default then llama3.2", () => {
    expect(resolveModel("ollama", "qwen2.5:7b")).toBe("qwen2.5:7b");
    expect(resolveModel("ollama", undefined, "mistral")).toBe("mistral");
    expect(resolveModel("ollama", undefined)).toBe("llama3.2");
  });
  it("generic local/openai take any id verbatim", () => {
    expect(resolveModel("local", "my-finetune")).toBe("my-finetune");
    expect(resolveModel("openai", "gpt-4o")).toBe("gpt-4o");
    expect(resolveModel("openrouter", "meta-llama/llama-3.1-70b")).toBe("meta-llama/llama-3.1-70b");
  });
});

describe("isValidModelFor", () => {
  it("local/openai-compatible accept anything", () => {
    expect(isValidModelFor("ollama", "anything")).toBe(true);
    expect(isValidModelFor("local", "x")).toBe(true);
    expect(isValidModelFor("openai", "gpt-4o")).toBe(true);
  });
  it("validates the curated remote engines", () => {
    expect(isValidModelFor("anthropic", "claude-opus-4-7")).toBe(true);
    expect(isValidModelFor("anthropic", "gpt-4o")).toBe(false);
    expect(isValidModelFor("grok", "grok-3")).toBe(true);
    expect(isValidModelFor("groq", "qwen-2.5-32b")).toBe(true);
    expect(isValidModelFor("gemini", "gemini-2.5-pro")).toBe(true);
  });
});

describe("MODEL_CATALOG", () => {
  it("exposes the curated catalogs", () => {
    expect(MODEL_CATALOG["anthropic"]?.[0]?.id).toBe("claude-haiku-4-5-20251001");
    expect(MODEL_CATALOG["groq"]?.length).toBe(5);
    expect(MODEL_CATALOG["ollama"]).toEqual([]);
  });
});
