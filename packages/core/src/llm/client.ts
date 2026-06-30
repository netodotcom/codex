// llm — the client. The ONLY IO (fetch) is injected, so the whole thing is
// testable with a fake fetch and runs in any environment (browser direct-call
// path, the Node server, a worker). chat() resolves the adapter, builds the
// provider request, runs it, and parses the response back to the unified shape.
import { LlmError, type ChatRequest, type ChatResponse, type ModelInfo, type ResolvedConfig } from "./types.js";
import { ADAPTERS, resolveConfig, type ResolveOpts } from "./registry.js";

export interface FetchLike {
  status: number;
  json(): Promise<unknown>;
}
export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<FetchLike>;

export interface LlmClient {
  /** Run a chat completion against a fully-resolved target. */
  chat(req: ChatRequest, cfg: ResolvedConfig): Promise<ChatResponse>;
  /** Resolve `provider` + opts, then run — the one-call convenience door. */
  chatWith(provider: string, req: ChatRequest, opts?: ResolveOpts): Promise<ChatResponse>;
  /** Discover models from a backend that supports it (local daemons / OpenAI). */
  listModels(cfg: ResolvedConfig): Promise<ModelInfo[]>;
}

export function createLlmClient(opts: { fetch: FetchFn }): LlmClient {
  const run = async (cfgReq: { url: string; method: "POST" | "GET"; headers: Record<string, string>; body?: string }): Promise<FetchLike> => {
    try {
      return await opts.fetch(cfgReq.url, { method: cfgReq.method, headers: cfgReq.headers, body: cfgReq.body });
    } catch (e) {
      throw new LlmError(503, String((e as Error).message || e));
    }
  };

  const chat = async (req: ChatRequest, cfg: ResolvedConfig): Promise<ChatResponse> => {
    const adapter = ADAPTERS[cfg.adapter];
    const httpReq = adapter.buildRequest(req, cfg);
    const res = await run(httpReq);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new LlmError(502, `${cfg.engine} returned non-JSON`);
    }
    return adapter.parseResponse(res.status, json, cfg);
  };

  return {
    chat,
    chatWith: (provider, req, resolveOpts) => chat(req, resolveConfig(provider, resolveOpts)),
    async listModels(cfg) {
      const adapter = ADAPTERS[cfg.adapter];
      if (!adapter.buildModelsRequest || !adapter.parseModels) return [];
      const httpReq = adapter.buildModelsRequest(cfg);
      const res = await run(httpReq);
      if (res.status < 200 || res.status >= 300) return [];
      try {
        return adapter.parseModels(await res.json());
      } catch {
        return [];
      }
    },
  };
}
