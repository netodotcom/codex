// CODEX direct-API shim (migrated from direct-api.js) — when running without a
// Node backend (e.g. GitHub Pages), proxy /api/* fetches straight to the chosen
// AI provider using the user's locally-stored key. Keys never leave the browser
// except to the provider itself.
//
// The provider dispatch (the 5 hand-written call* functions + model maps that
// duplicated server.js) is now the shared @codex/core/llm client. What stays
// here is the platform glue: the fetch interceptor, the /api/* routing, key
// storage, engine selection, the Settings-chosen model, the 401 self-heal, and
// the donation-pool token.
import {
  createLlmClient,
  resolveConfig,
  isValidModelFor,
  MODEL_CATALOG,
  LlmError,
  ANTHROPIC_DEFAULT_MODEL,
  XAI_DEFAULT_MODEL,
  GROQ_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  type ChatRequest,
  type ChatMessage,
  type SystemPrompt,
} from "@codex/core/llm";

const KEYS_LS = "codex.api.keys.v1";
const LEGACY_KEY_LS = "codex.anthropic.key.v1";
const BTC_TOKEN_LS = "codex.btc.token.v1";
const OLLAMA_URL_KEY = "codex.ollama.url.v1";
const OLLAMA_MODEL_KEY = "codex.ollama.model.v1";
const OLLAMA_DEFAULT_URL = "http://localhost:11434";

const VALID_ENGINES = new Set(["anthropic", "grok", "groq", "gemini", "ollama"]);
const PROVIDER_DEFAULT: Record<string, string> = {
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  grok: XAI_DEFAULT_MODEL,
  groq: GROQ_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
  ollama: "",
};

interface ApiKeys {
  active: string;
  anthropic: string;
  grok: string;
  groq: string;
  gemini: string;
}
interface ChatPayload {
  provider?: string;
  model?: string;
  system?: SystemPrompt;
  messages?: ChatMessage[];
  max_tokens?: number;
}
interface ResultEnvelope {
  status: number;
  body: Record<string, unknown>;
}

function btcToken(): string {
  try {
    return (localStorage.getItem(BTC_TOKEN_LS) || "").trim();
  } catch {
    return "";
  }
}

function loadOllamaConfig(): { url: string; model: string } {
  let url = OLLAMA_DEFAULT_URL;
  let model = "";
  try {
    url = (localStorage.getItem(OLLAMA_URL_KEY) || OLLAMA_DEFAULT_URL).replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  try {
    model = localStorage.getItem(OLLAMA_MODEL_KEY) || "";
  } catch {
    /* ignore */
  }
  return { url, model };
}

// The user's chosen model (Settings → codex.tweaks.v1 {provider, model}),
// validated for the routing provider, else the provider's default.
function chosenModel(provider: string): string {
  try {
    const t = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as { model?: string };
    if (t.model && isValidModelFor(provider, t.model)) return t.model;
  } catch {
    /* ignore */
  }
  return PROVIDER_DEFAULT[provider] || "";
}
function resolveModelForRequest(provider: string, requested?: string): string {
  return requested && isValidModelFor(provider, requested) ? requested : chosenModel(provider);
}

function loadKeys(): ApiKeys {
  let out: ApiKeys = { active: "anthropic", anthropic: "", grok: "", groq: "", gemini: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS_LS) || "null") as Partial<ApiKeys> | null;
    if (raw && typeof raw === "object") out = { ...out, ...raw };
  } catch {
    /* ignore */
  }
  if (!out.anthropic) {
    try {
      out.anthropic = localStorage.getItem(LEGACY_KEY_LS) || "";
    } catch {
      /* ignore */
    }
  }
  out.anthropic = String(out.anthropic || "").trim();
  out.grok = String(out.grok || "").trim();
  out.groq = String(out.groq || "").trim();
  out.gemini = String(out.gemini || "").trim();
  const hasFor = (a: string): boolean => (a === "ollama" ? true : a === "groq" ? !!out.groq : a === "grok" ? !!out.grok : a === "gemini" ? !!out.gemini : !!out.anthropic);
  if (!VALID_ENGINES.has(out.active) || (out.active !== "ollama" && !hasFor(out.active))) {
    if (out.groq && out.groq.startsWith("gsk_")) out.active = "groq";
    else if (out.grok) out.active = "grok";
    else if (out.gemini) out.active = "gemini";
    else if (out.anthropic) out.active = "anthropic";
  }
  return out;
}
function activeEngine(): string {
  const a = loadKeys().active;
  return VALID_ENGINES.has(a) ? a : "anthropic";
}
function activeKey(): string {
  const k = loadKeys();
  if (k.active === "grok") return k.grok || "";
  if (k.active === "groq") return k.groq || "";
  if (k.active === "gemini") return k.gemini || "";
  if (k.active === "ollama") return "";
  return k.anthropic || "";
}
function hasAnyKey(): boolean {
  const k = loadKeys();
  return !!(k.anthropic || k.grok || k.groq || k.gemini);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Capture the unwrapped fetch BEFORE we install the shim so the core client (and
// the health probe) talk straight to the real network without re-entering the
// wrapper.
const originalFetch: typeof fetch = window.fetch.bind(window);
const llm = createLlmClient({ fetch: originalFetch as unknown as Parameters<typeof createLlmClient>[0]["fetch"] });

// Run one chat against the resolved engine via the shared core client.
async function runChat(engine: string, key: string, req: ChatRequest, model: string): Promise<ResultEnvelope> {
  const baseUrl = engine === "ollama" ? loadOllamaConfig().url + "/v1/chat/completions" : undefined;
  const cfg = resolveConfig(engine, { apiKey: key || undefined, model, baseUrl, browserDirect: true });
  try {
    const res = await llm.chat(req, cfg);
    return { status: 200, body: { text: res.text, model: res.model, usage: res.usage, engine: res.engine } };
  } catch (e) {
    if (e instanceof LlmError) return { status: e.status, body: { error: e.message } };
    return { status: 500, body: { error: "Network error: " + String((e as Error).message || e) } };
  }
}

async function handleHealth(): Promise<Response> {
  const eng = activeEngine();
  const k = loadKeys();
  const oll = loadOllamaConfig();
  const defaultModel = eng === "grok" ? XAI_DEFAULT_MODEL : eng === "groq" ? GROQ_DEFAULT_MODEL : eng === "gemini" ? GEMINI_DEFAULT_MODEL : eng === "ollama" ? oll.model || "" : ANTHROPIC_DEFAULT_MODEL;
  const idLabels = (key: string): Array<{ id: string; label: string }> => (MODEL_CATALOG[key] || []).map((m) => ({ id: m.id, label: m.id }));
  return jsonResponse({
    ok: true,
    hasKey: !!activeKey() || eng === "ollama",
    engine: eng,
    model: defaultModel,
    mode: "direct",
    usage: { input: 0, output: 0, cache_read: 0, cache_create: 0, calls: 0 },
    providers: {
      anthropic: { available: !!k.anthropic, models: [] },
      xai: { available: !!k.grok, models: [] },
      groq: { available: !!k.groq, models: idLabels("groq") },
      gemini: { available: !!k.gemini, models: idLabels("gemini") },
      ollama: { available: false, url: oll.url, models: [] },
    },
  });
}

async function handleKey(init: RequestInit): Promise<Response> {
  try {
    const body = JSON.parse((init.body as string) || "{}") as { key?: string; provider?: string };
    const key = (body.key || "").trim();
    let provider = body.provider;
    if (provider === "xai") provider = "grok";
    if (!provider) {
      if (key.startsWith("xai-")) provider = "grok";
      else if (key.startsWith("gsk_")) provider = "groq";
      else if (key.startsWith("AIza")) provider = "gemini";
      else if (key.startsWith("sk-")) provider = "anthropic";
    }
    if (!key || (provider !== "anthropic" && provider !== "grok" && provider !== "groq" && provider !== "gemini")) {
      return jsonResponse({ error: "Invalid key — expected Anthropic (sk-…), xAI (xai-…), Groq (gsk_…) or Gemini (AIza…) key" }, 400);
    }
    const cur = loadKeys();
    const next = { ...cur };
    if (provider === "grok") {
      next.grok = key;
      next.active = "grok";
    } else if (provider === "groq") {
      next.groq = key;
      next.active = "groq";
    } else if (provider === "gemini") {
      next.gemini = key;
      next.active = "gemini";
    } else {
      next.anthropic = key;
      next.active = "anthropic";
      try {
        localStorage.setItem(LEGACY_KEY_LS, key);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(KEYS_LS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return jsonResponse({ ok: true, hasKey: true, engine: provider });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message || e) }, 500);
  }
}

async function handleChat(init: RequestInit): Promise<Response> {
  let payloadPreview: ChatPayload = {};
  try {
    payloadPreview = JSON.parse((init.body as string) || "{}") as ChatPayload;
  } catch {
    /* ignore */
  }
  let engine = payloadPreview.provider || activeEngine();
  if (engine === "xai") engine = "grok";
  if (!VALID_ENGINES.has(engine)) engine = activeEngine();
  const k = loadKeys();
  const key = engine === "grok" ? k.grok : engine === "groq" ? k.groq : engine === "gemini" ? k.gemini : engine === "ollama" ? "" : k.anthropic;
  if (engine !== "ollama" && !key) {
    if (btcToken()) {
      return jsonResponse({ error: "Donation pool requires the hosted server. Use direct mode with your own key, or open the app from the Node server." }, 503);
    }
    const label = engine === "grok" ? "Grok" : engine === "groq" ? "Groq" : engine === "gemini" ? "Gemini" : "Anthropic";
    return jsonResponse({ error: `No ${label} API key set. Open Settings → API keys and Apply your key.` }, 503);
  }
  let payload: ChatPayload;
  try {
    payload = JSON.parse((init.body as string) || "{}") as ChatPayload;
  } catch {
    return jsonResponse({ error: "Bad JSON in request body" }, 400);
  }

  const req: ChatRequest = { system: payload.system, messages: payload.messages || [], maxTokens: payload.max_tokens || undefined };
  const model = resolveModelForRequest(engine, payload.model);
  let result = await runChat(engine, key, req, model);

  // Self-healing: a provider 401/403 with a still-valid-looking stored key →
  // re-assert a sanitized copy and retry exactly once.
  if (result.status === 401 || result.status === 403) {
    try {
      const raw = (JSON.parse(localStorage.getItem(KEYS_LS) || "null") || {}) as Partial<ApiKeys>;
      const sanitized = { active: raw.active === "grok" ? "grok" : "anthropic", anthropic: String(raw.anthropic || "").trim(), grok: String(raw.grok || "").trim() };
      if (sanitized.active === "anthropic" && !sanitized.anthropic && sanitized.grok) sanitized.active = "grok";
      if (sanitized.active === "grok" && !sanitized.grok && sanitized.anthropic) sanitized.active = "anthropic";
      const changed = JSON.stringify(sanitized) !== JSON.stringify({ active: raw.active, anthropic: raw.anthropic, grok: raw.grok });
      const fresh = sanitized.active === "grok" ? sanitized.grok : sanitized.anthropic;
      if (changed && fresh && fresh !== key) {
        try {
          localStorage.setItem(KEYS_LS, JSON.stringify(sanitized));
        } catch {
          /* ignore */
        }
        try {
          window.dispatchEvent(new CustomEvent("codex:engine-change", { detail: { engine: sanitized.active } }));
        } catch {
          /* ignore */
        }
        const retryModel = resolveModelForRequest(sanitized.active, payload.model);
        result = await runChat(sanitized.active, fresh, req, retryModel);
      }
    } catch {
      /* ignore */
    }
  }
  return jsonResponse(result.body, result.status);
}

let DIRECT_MODE: boolean | null = null;
async function probeMode(): Promise<boolean> {
  try {
    const r = await originalFetch("/api/health", { method: "GET" });
    if (!r.ok) return true;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return true;
    const d = (await r.json()) as { mode?: string } | null;
    return !d || d.mode === "direct";
  } catch {
    return true;
  }
}

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = "";
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.href;
  else if (input && (input as Request).url) url = (input as Request).url;

  const isApi = url.startsWith("/api/") || url.includes(location.host + "/api/");
  if (!isApi) return originalFetch(input, init);

  if (DIRECT_MODE === null) DIRECT_MODE = await probeMode();

  const isChat = url.replace(/^https?:\/\/[^/]+/, "") === "/api/chat";
  const tok = btcToken();
  if (!DIRECT_MODE) {
    if (isChat && tok && !activeKey()) {
      const opts2: RequestInit = { ...(init || {}) };
      const h = new Headers(opts2.headers || {});
      if (!h.has("Authorization")) h.set("Authorization", "Bearer " + tok);
      opts2.headers = h;
      return originalFetch(input, opts2);
    }
    return originalFetch(input, init);
  }

  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const opts = init || (input && typeof input === "object" ? (input as RequestInit) : {});

  if (path === "/api/health") return handleHealth();
  if (path === "/api/key" && (opts.method || "").toUpperCase() === "POST") return handleKey(opts);
  if (path === "/api/chat" && (opts.method || "").toUpperCase() === "POST") return handleChat(opts);

  return jsonResponse({ error: "Endpoint not available in direct mode: " + path }, 404);
};

interface DirectWindow {
  CODEX_DIRECT?: unknown;
  CODEX_MODELS?: unknown;
  CODEX_GET_ENGINE?: () => { provider: string; model: string };
}
const dw = window as unknown as DirectWindow;
dw.CODEX_MODELS = MODEL_CATALOG;
dw.CODEX_GET_ENGINE = function () {
  const p = (() => {
    try {
      return activeEngine();
    } catch {
      return "anthropic";
    }
  })();
  return { provider: p, model: chosenModel(p) };
};
dw.CODEX_DIRECT = {
  loadKeys,
  activeEngine,
  activeKey,
  hasAnyKey,
  probeMode,
  notifyEngineChange(): void {
    try {
      window.dispatchEvent(new CustomEvent("codex:engine-change", { detail: { engine: activeEngine() } }));
    } catch {
      /* ignore */
    }
  },
};
