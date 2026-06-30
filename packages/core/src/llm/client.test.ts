import { describe, it, expect } from "vitest";
import { createLlmClient, type FetchFn, type FetchLike } from "./client.js";
import { LlmError } from "./types.js";
import { resolveConfig } from "./registry.js";

interface Call {
  url: string;
  init: { method: string; headers: Record<string, string>; body?: string };
}

function fakeFetch(responses: Array<{ status: number; json: () => unknown } | { throws: unknown } | { jsonThrows: true; status: number }>): { fetch: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const fetch: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const r = responses[i++] ?? responses[responses.length - 1]!;
    if ("throws" in r) throw r.throws;
    if ("jsonThrows" in r) {
      return { status: r.status, json: () => Promise.reject(new Error("not json")) } as FetchLike;
    }
    return { status: r.status, json: () => Promise.resolve(r.json()) } as FetchLike;
  };
  return { fetch, calls };
}

describe("createLlmClient.chatWith", () => {
  it("runs a Groq chat end-to-end and returns the unified response", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, json: () => ({ choices: [{ message: { content: "hello" } }], model: "llama-3.3-70b-versatile", usage: { prompt_tokens: 3, completion_tokens: 7 } }) }]);
    const client = createLlmClient({ fetch });
    const res = await client.chatWith("groq", { messages: [{ role: "user", content: "hi" }] }, { apiKey: "gsk_x", model: "llama-3.3-70b-versatile" });
    expect(res).toEqual({ text: "hello", model: "llama-3.3-70b-versatile", usage: { input_tokens: 3, output_tokens: 7 }, engine: "groq" });
    // correct endpoint + auth + body were sent
    expect(calls[0]!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(calls[0]!.init.headers["Authorization"]).toBe("Bearer gsk_x");
    expect(JSON.parse(calls[0]!.init.body!).stream).toBe(false);
  });

  it("hits a local Ollama daemon with no key", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, json: () => ({ choices: [{ message: { content: "ahoy" } }], model: "llama3.2" }) }]);
    const client = createLlmClient({ fetch });
    const res = await client.chatWith("ollama", { messages: [{ role: "user", content: "hi" }] }, { model: "llama3.2" });
    expect(res.text).toBe("ahoy");
    expect(res.engine).toBe("ollama");
    expect(calls[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(calls[0]!.init.headers["Authorization"]).toBeUndefined();
  });

  it("surfaces a provider error as LlmError with the status", async () => {
    const { fetch } = fakeFetch([{ status: 429, json: () => ({ error: { message: "rate limited" } }) }]);
    const client = createLlmClient({ fetch });
    await expect(client.chatWith("groq", { messages: [{ role: "user", content: "hi" }] }, { apiKey: "k" })).rejects.toMatchObject({ status: 429, message: "rate limited" });
  });

  it("maps a non-JSON body to a 502 LlmError", async () => {
    const { fetch } = fakeFetch([{ jsonThrows: true, status: 200 }]);
    const client = createLlmClient({ fetch });
    await expect(client.chatWith("groq", { messages: [{ role: "user", content: "hi" }] }, { apiKey: "k" })).rejects.toBeInstanceOf(LlmError);
  });

  it("maps a network failure to a 503 LlmError", async () => {
    const { fetch } = fakeFetch([{ throws: new Error("ECONNREFUSED") }]);
    const client = createLlmClient({ fetch });
    await expect(client.chatWith("ollama", { messages: [{ role: "user", content: "hi" }] }, {})).rejects.toMatchObject({ status: 503 });
  });
});

describe("createLlmClient.listModels", () => {
  it("discovers models from a local OpenAI-compatible /models endpoint", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, json: () => ({ data: [{ id: "llama3.2" }, { id: "qwen2.5" }] }) }]);
    const client = createLlmClient({ fetch });
    const models = await client.listModels(resolveConfig("ollama", {}));
    expect(models).toEqual([
      { id: "llama3.2", label: "llama3.2" },
      { id: "qwen2.5", label: "qwen2.5" },
    ]);
    expect(calls[0]!.url).toBe("http://localhost:11434/v1/models");
  });
});
