import { describe, it, expect } from "vitest";
import { openaiAdapter } from "./adapters/openai.js";
import { anthropicAdapter } from "./adapters/anthropic.js";
import { geminiAdapter } from "./adapters/gemini.js";
import { LlmError, type ChatRequest, type ResolvedConfig } from "./types.js";

const req: ChatRequest = { system: "SYS", messages: [{ role: "user", content: "Hi" }], maxTokens: 256 };

describe("openaiAdapter (covers grok/groq/ollama/openai/openrouter/local)", () => {
  const cfg: ResolvedConfig = { adapter: "openai", engine: "grok", baseUrl: "https://api.x.ai/v1/chat/completions", apiKey: "xai-KEY", model: "grok-3-mini" };

  it("builds the OpenAI-shape request with a leading system message + Bearer auth", () => {
    const r = openaiAdapter.buildRequest(req, cfg);
    expect(r.url).toBe("https://api.x.ai/v1/chat/completions");
    expect(r.method).toBe("POST");
    expect(r.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer xai-KEY" });
    expect(JSON.parse(r.body!)).toEqual({
      model: "grok-3-mini",
      max_tokens: 256,
      messages: [
        { role: "system", content: "SYS" },
        { role: "user", content: "Hi" },
      ],
      stream: false,
    });
  });

  it("omits Authorization when there is no key (local daemons)", () => {
    const local: ResolvedConfig = { adapter: "openai", engine: "ollama", baseUrl: "http://localhost:11434/v1/chat/completions", model: "llama3.2" };
    const r = openaiAdapter.buildRequest(req, local);
    expect(r.headers["Authorization"]).toBeUndefined();
    expect(JSON.parse(r.body!).model).toBe("llama3.2");
  });

  it("parses a success response and remaps usage", () => {
    const res = openaiAdapter.parseResponse(200, { choices: [{ message: { content: "yo" } }], model: "grok-3-mini", usage: { prompt_tokens: 10, completion_tokens: 5 } }, cfg);
    expect(res).toEqual({ text: "yo", model: "grok-3-mini", usage: { input_tokens: 10, output_tokens: 5 }, engine: "grok" });
  });

  it("throws LlmError with the provider message on non-2xx", () => {
    try {
      openaiAdapter.parseResponse(401, { error: { message: "bad key" } }, cfg);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmError);
      expect((e as LlmError).status).toBe(401);
      expect((e as LlmError).message).toBe("bad key");
    }
  });

  it("builds a /models discovery request", () => {
    const r = openaiAdapter.buildModelsRequest!(cfg);
    expect(r.url).toBe("https://api.x.ai/v1/models");
    expect(r.method).toBe("GET");
    expect(openaiAdapter.parseModels!({ data: [{ id: "grok-3" }, { id: "grok-4" }] })).toEqual([
      { id: "grok-3", label: "grok-3" },
      { id: "grok-4", label: "grok-4" },
    ]);
  });
});

describe("anthropicAdapter", () => {
  const cfg: ResolvedConfig = { adapter: "anthropic", engine: "anthropic", apiKey: "sk-ant-KEY", model: "claude-haiku-4-5-20251001", browserDirect: true };

  it("builds the native Messages request (system separate, browser-direct header)", () => {
    const r = anthropicAdapter.buildRequest(req, cfg);
    expect(r.url).toBe("https://api.anthropic.com/v1/messages");
    expect(r.headers).toEqual({
      "Content-Type": "application/json",
      "x-api-key": "sk-ant-KEY",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    expect(JSON.parse(r.body!)).toEqual({ model: "claude-haiku-4-5-20251001", max_tokens: 256, messages: [{ role: "user", content: "Hi" }], system: "SYS" });
  });

  it("concatenates only the text content blocks", () => {
    const res = anthropicAdapter.parseResponse(
      200,
      { content: [{ type: "text", text: "A" }, { type: "thinking", text: "x" }, { type: "text", text: "B" }], model: "claude-haiku-4-5-20251001", usage: { input_tokens: 7, output_tokens: 3 } },
      cfg,
    );
    expect(res).toEqual({ text: "AB", model: "claude-haiku-4-5-20251001", usage: { input_tokens: 7, output_tokens: 3 }, engine: "anthropic" });
  });
});

describe("geminiAdapter", () => {
  const cfg: ResolvedConfig = { adapter: "gemini", engine: "gemini", apiKey: "AIzaKEY", model: "gemini-2.0-flash" };

  it("builds generateContent with key in the query + assistant→model role", () => {
    const r = geminiAdapter.buildRequest({ system: "SYS", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Yo" }], maxTokens: 256 }, cfg);
    expect(r.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaKEY");
    expect(JSON.parse(r.body!)).toEqual({
      contents: [
        { role: "user", parts: [{ text: "Hi" }] },
        { role: "model", parts: [{ text: "Yo" }] },
      ],
      generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
      systemInstruction: { parts: [{ text: "SYS" }] },
    });
  });

  it("parses candidates + usageMetadata", () => {
    const res = geminiAdapter.parseResponse(200, { candidates: [{ content: { parts: [{ text: "Hi" }, { text: " there" }] } }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 } }, cfg);
    expect(res).toEqual({ text: "Hi there", model: "gemini-2.0-flash", usage: { input_tokens: 9, output_tokens: 4 }, engine: "gemini" });
  });
});
