Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region packages/core/src/llm/types.ts
var LlmError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
		this.name = "LlmError";
	}
};
var DEFAULT_MAX_TOKENS = 1024;
//#endregion
//#region packages/core/src/llm/flatten.ts
function flattenSystem(sys) {
	if (!sys) return "";
	if (typeof sys === "string") return sys;
	if (Array.isArray(sys)) return sys.map((s) => typeof s === "string" ? s : s && s.text || "").join("\n\n").trim();
	if (typeof sys === "object" && sys.text) return sys.text;
	return "";
}
function flattenContent(c) {
	if (typeof c === "string") return c;
	if (Array.isArray(c)) return c.map((x) => typeof x === "string" ? x : x && x.text || "").join("\n");
	if (c && typeof c === "object" && c.text) return c.text;
	return "";
}
//#endregion
//#region packages/core/src/llm/models.ts
var ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";
var XAI_DEFAULT_MODEL = "grok-3";
var GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
var GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";
var ANTHROPIC_ALLOWED = /* @__PURE__ */ new Set([
	"claude-haiku-4-5-20251001",
	"claude-sonnet-4-6",
	"claude-opus-4-7"
]);
var GROQ_ALLOWED = /* @__PURE__ */ new Set([
	"llama-3.3-70b-versatile",
	"llama-3.1-8b-instant",
	"mixtral-8x7b-32768",
	"deepseek-r1-distill-llama-70b",
	"qwen-2.5-32b"
]);
var GEMINI_ALLOWED = /* @__PURE__ */ new Set([
	"gemini-2.0-flash",
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.0-flash-thinking-exp"
]);
var XAI_MODEL_MAP = {
	"claude-haiku-4-5-20251001": "grok-3-mini",
	"claude-sonnet-4-6": "grok-3",
	"claude-opus-4-7": "grok-4"
};
var GROQ_MODEL_MAP = {
	"claude-haiku-4-5-20251001": "llama-3.1-8b-instant",
	"claude-sonnet-4-6": "llama-3.3-70b-versatile",
	"claude-opus-4-7": "deepseek-r1-distill-llama-70b",
	"grok-3-mini": "llama-3.1-8b-instant",
	"grok-3": "llama-3.3-70b-versatile",
	"grok-4": "deepseek-r1-distill-llama-70b"
};
var GEMINI_MODEL_MAP = {
	"claude-haiku-4-5-20251001": "gemini-2.0-flash",
	"claude-sonnet-4-6": "gemini-2.5-flash",
	"claude-opus-4-7": "gemini-2.5-pro",
	"grok-3-mini": "gemini-2.0-flash",
	"grok-3": "gemini-2.5-flash",
	"grok-4": "gemini-2.5-pro"
};
var MODEL_CATALOG = {
	anthropic: [
		{
			id: "claude-haiku-4-5-20251001",
			label: "Claude Haiku 4.5",
			tier: "fast"
		},
		{
			id: "claude-sonnet-4-6",
			label: "Claude Sonnet 4.6",
			tier: "balanced"
		},
		{
			id: "claude-opus-4-7",
			label: "Claude Opus 4.7",
			tier: "deepest"
		}
	],
	grok: [
		{
			id: "grok-3-mini",
			label: "Grok 3 mini",
			tier: "fast"
		},
		{
			id: "grok-3",
			label: "Grok 3",
			tier: "balanced"
		},
		{
			id: "grok-4",
			label: "Grok 4",
			tier: "deepest"
		}
	],
	groq: [
		{
			id: "llama-3.1-8b-instant",
			label: "Llama 3.1 8B",
			tier: "fast"
		},
		{
			id: "llama-3.3-70b-versatile",
			label: "Llama 3.3 70B",
			tier: "balanced"
		},
		{
			id: "deepseek-r1-distill-llama-70b",
			label: "DeepSeek R1 70B",
			tier: "reasoning"
		},
		{
			id: "qwen-2.5-32b",
			label: "Qwen 2.5 32B",
			tier: "balanced"
		},
		{
			id: "mixtral-8x7b-32768",
			label: "Mixtral 8x7B",
			tier: "long context"
		}
	],
	gemini: [
		{
			id: "gemini-2.0-flash",
			label: "Gemini 2.0 Flash",
			tier: "fast"
		},
		{
			id: "gemini-2.5-flash",
			label: "Gemini 2.5 Flash",
			tier: "balanced"
		},
		{
			id: "gemini-2.5-pro",
			label: "Gemini 2.5 Pro",
			tier: "deepest"
		}
	],
	ollama: []
};
function isValidModelFor(provider, model) {
	if (!model) return false;
	if (provider === "ollama" || provider === "openai" || provider === "openrouter" || provider === "local") return true;
	if (provider === "anthropic") return ANTHROPIC_ALLOWED.has(model);
	if (provider === "grok") return /^grok/.test(model);
	if (provider === "groq") return GROQ_ALLOWED.has(model);
	if (provider === "gemini") return GEMINI_ALLOWED.has(model);
	return false;
}
function resolveModel(provider, requested, localDefault = "") {
	switch (provider) {
		case "anthropic": return requested && ANTHROPIC_ALLOWED.has(requested) ? requested : ANTHROPIC_DEFAULT_MODEL;
		case "grok": return requested && XAI_MODEL_MAP[requested] || (requested && /^grok/.test(requested) ? requested : "grok-3");
		case "groq": return requested && GROQ_ALLOWED.has(requested) ? requested : requested && GROQ_MODEL_MAP[requested] || "llama-3.3-70b-versatile";
		case "gemini": return requested && GEMINI_ALLOWED.has(requested) ? requested : requested && GEMINI_MODEL_MAP[requested] || "gemini-2.0-flash";
		case "ollama": return requested || localDefault || "llama3.2";
		default: return requested || localDefault || "";
	}
}
//#endregion
//#region packages/core/src/llm/adapters/openai.ts
function errorMessage$2(json, status) {
	const e = json?.error;
	const msg = (e && typeof e === "object" ? e.message || JSON.stringify(e) : e) || `HTTP ${status}`;
	return typeof msg === "string" ? msg : JSON.stringify(msg);
}
var openaiAdapter = {
	id: "openai",
	buildRequest(req, cfg) {
		const sys = flattenSystem(req.system);
		const messages = [];
		if (sys) messages.push({
			role: "system",
			content: sys
		});
		for (const m of req.messages || []) messages.push({
			role: m.role,
			content: flattenContent(m.content)
		});
		const headers = {
			"Content-Type": "application/json",
			...cfg.extraHeaders || {}
		};
		if (cfg.apiKey) headers["Authorization"] = "Bearer " + cfg.apiKey;
		const payload = {
			model: cfg.model,
			max_tokens: req.maxTokens ?? 1024,
			messages,
			stream: false
		};
		if (cfg.temperature != null) payload["temperature"] = cfg.temperature;
		return {
			url: cfg.baseUrl ?? "",
			method: "POST",
			headers,
			body: JSON.stringify(payload)
		};
	},
	parseResponse(status, json, cfg) {
		if (status < 200 || status >= 300) throw new LlmError(status, errorMessage$2(json, status));
		const data = json || {};
		const text = data.choices?.[0]?.message?.content || "";
		const u = data.usage || {};
		return {
			text,
			model: data.model || cfg.model,
			usage: {
				input_tokens: u.prompt_tokens || 0,
				output_tokens: u.completion_tokens || 0
			},
			engine: cfg.engine
		};
	},
	buildModelsRequest(cfg) {
		const base = (cfg.baseUrl ?? "").replace(/\/chat\/completions$/, "");
		const headers = {
			"Content-Type": "application/json",
			...cfg.extraHeaders || {}
		};
		if (cfg.apiKey) headers["Authorization"] = "Bearer " + cfg.apiKey;
		return {
			url: base + "/models",
			method: "GET",
			headers
		};
	},
	parseModels(json) {
		return ((json || {}).data || []).filter((m) => m.id).map((m) => ({
			id: m.id,
			label: m.id
		}));
	}
};
//#endregion
//#region packages/core/src/llm/adapters/anthropic.ts
var ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
var ANTHROPIC_VERSION = "2023-06-01";
function errorMessage$1(json, status) {
	const e = json?.error;
	const msg = (e && typeof e === "object" ? e.message : e) || `HTTP ${status}`;
	return typeof msg === "string" ? msg : JSON.stringify(msg);
}
var anthropicAdapter = {
	id: "anthropic",
	buildRequest(req, cfg) {
		const body = {
			model: cfg.model,
			max_tokens: req.maxTokens ?? 1024,
			messages: req.messages || []
		};
		if (req.system) body["system"] = req.system;
		const headers = {
			"Content-Type": "application/json",
			"x-api-key": cfg.apiKey ?? "",
			"anthropic-version": cfg.anthropicVersion || "2023-06-01",
			...cfg.extraHeaders || {}
		};
		if (cfg.browserDirect) headers["anthropic-dangerous-direct-browser-access"] = "true";
		return {
			url: cfg.baseUrl || "https://api.anthropic.com/v1/messages",
			method: "POST",
			headers,
			body: JSON.stringify(body)
		};
	},
	parseResponse(status, json, cfg) {
		if (status < 200 || status >= 300) throw new LlmError(status, errorMessage$1(json, status));
		const data = json || {};
		const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text || "").join("");
		const u = data.usage || {};
		return {
			text,
			model: data.model || cfg.model,
			usage: {
				input_tokens: u.input_tokens || 0,
				output_tokens: u.output_tokens || 0
			},
			engine: cfg.engine
		};
	}
};
//#endregion
//#region packages/core/src/llm/adapters/gemini.ts
var GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
function errorMessage(json, status) {
	const e = json?.error;
	const msg = (e && typeof e === "object" ? e.message || e : e) || `HTTP ${status}`;
	return typeof msg === "string" ? msg : JSON.stringify(msg);
}
var geminiAdapter = {
	id: "gemini",
	buildRequest(req, cfg) {
		const sys = flattenSystem(req.system);
		const body = {
			contents: (req.messages || []).map((m) => ({
				role: m.role === "assistant" ? "model" : "user",
				parts: [{ text: flattenContent(m.content) }]
			})),
			generationConfig: {
				maxOutputTokens: req.maxTokens ?? 1024,
				temperature: cfg.temperature ?? .7
			}
		};
		if (sys) body["systemInstruction"] = { parts: [{ text: sys }] };
		return {
			url: `${cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta/models"}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey ?? "")}`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...cfg.extraHeaders || {}
			},
			body: JSON.stringify(body)
		};
	},
	parseResponse(status, json, cfg) {
		if (status < 200 || status >= 300) throw new LlmError(status, errorMessage(json, status));
		const data = json || {};
		const text = ((data.candidates?.[0] || {}).content?.parts || []).map((p) => p.text || "").join("");
		const um = data.usageMetadata || {};
		return {
			text,
			model: cfg.model,
			usage: {
				input_tokens: um.promptTokenCount || 0,
				output_tokens: um.candidatesTokenCount || 0
			},
			engine: cfg.engine
		};
	}
};
//#endregion
//#region packages/core/src/llm/registry.ts
var ADAPTERS = {
	openai: openaiAdapter,
	anthropic: anthropicAdapter,
	gemini: geminiAdapter
};
var OPENAI = (engine, baseUrl, extra = {}) => ({
	adapter: "openai",
	engine,
	modelKey: engine,
	baseUrl,
	...extra
});
var PROVIDER_PRESETS = {
	anthropic: {
		adapter: "anthropic",
		engine: "anthropic",
		modelKey: "anthropic",
		browserDirect: true
	},
	gemini: {
		adapter: "gemini",
		engine: "gemini",
		modelKey: "gemini"
	},
	grok: OPENAI("grok", "https://api.x.ai/v1/chat/completions", { modelKey: "grok" }),
	xai: OPENAI("grok", "https://api.x.ai/v1/chat/completions", { modelKey: "grok" }),
	groq: OPENAI("groq", "https://api.groq.com/openai/v1/chat/completions", { modelKey: "groq" }),
	openai: OPENAI("openai", "https://api.openai.com/v1/chat/completions", {
		modelKey: "openai",
		defaultModel: "gpt-4o-mini"
	}),
	openrouter: OPENAI("openrouter", "https://openrouter.ai/api/v1/chat/completions", { modelKey: "openrouter" }),
	ollama: OPENAI("ollama", "http://localhost:11434/v1/chat/completions", {
		modelKey: "ollama",
		localDefaultBaseUrl: "http://localhost:11434/v1/chat/completions"
	}),
	lmstudio: OPENAI("local", "http://localhost:1234/v1/chat/completions", {
		modelKey: "local",
		localDefaultBaseUrl: "http://localhost:1234/v1/chat/completions"
	}),
	llamacpp: OPENAI("local", "http://localhost:8080/v1/chat/completions", {
		modelKey: "local",
		localDefaultBaseUrl: "http://localhost:8080/v1/chat/completions"
	}),
	vllm: OPENAI("local", "http://localhost:8000/v1/chat/completions", {
		modelKey: "local",
		localDefaultBaseUrl: "http://localhost:8000/v1/chat/completions"
	}),
	local: {
		adapter: "openai",
		engine: "local",
		modelKey: "local"
	}
};
function getPreset(provider) {
	return PROVIDER_PRESETS[provider];
}
function registerProvider(id, preset) {
	PROVIDER_PRESETS[id] = preset;
}
function resolveConfig(provider, opts = {}) {
	const preset = PROVIDER_PRESETS[provider] || {
		adapter: "openai",
		engine: provider,
		modelKey: provider
	};
	const model = resolveModel(preset.modelKey, opts.model, opts.localDefaultModel ?? preset.defaultModel ?? "");
	return {
		adapter: preset.adapter,
		engine: preset.engine,
		model,
		apiKey: opts.apiKey,
		baseUrl: opts.baseUrl ?? preset.baseUrl ?? preset.localDefaultBaseUrl,
		browserDirect: opts.browserDirect ?? preset.browserDirect,
		extraHeaders: opts.extraHeaders,
		temperature: opts.temperature
	};
}
//#endregion
//#region packages/core/src/llm/client.ts
function createLlmClient(opts) {
	const run = async (cfgReq) => {
		try {
			return await opts.fetch(cfgReq.url, {
				method: cfgReq.method,
				headers: cfgReq.headers,
				body: cfgReq.body
			});
		} catch (e) {
			throw new LlmError(503, String(e.message || e));
		}
	};
	const chat = async (req, cfg) => {
		const adapter = ADAPTERS[cfg.adapter];
		const res = await run(adapter.buildRequest(req, cfg));
		let json;
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
			const res = await run(adapter.buildModelsRequest(cfg));
			if (res.status < 200 || res.status >= 300) return [];
			try {
				return adapter.parseModels(await res.json());
			} catch {
				return [];
			}
		}
	};
}
//#endregion
exports.ADAPTERS = ADAPTERS;
exports.ANTHROPIC_DEFAULT_MODEL = ANTHROPIC_DEFAULT_MODEL;
exports.ANTHROPIC_URL = ANTHROPIC_URL;
exports.ANTHROPIC_VERSION = ANTHROPIC_VERSION;
exports.DEFAULT_MAX_TOKENS = DEFAULT_MAX_TOKENS;
exports.GEMINI_DEFAULT_MODEL = GEMINI_DEFAULT_MODEL;
exports.GEMINI_URL_BASE = GEMINI_URL_BASE;
exports.GROQ_DEFAULT_MODEL = GROQ_DEFAULT_MODEL;
exports.LlmError = LlmError;
exports.MODEL_CATALOG = MODEL_CATALOG;
exports.PROVIDER_PRESETS = PROVIDER_PRESETS;
exports.XAI_DEFAULT_MODEL = XAI_DEFAULT_MODEL;
exports.anthropicAdapter = anthropicAdapter;
exports.createLlmClient = createLlmClient;
exports.flattenContent = flattenContent;
exports.flattenSystem = flattenSystem;
exports.geminiAdapter = geminiAdapter;
exports.getPreset = getPreset;
exports.isValidModelFor = isValidModelFor;
exports.openaiAdapter = openaiAdapter;
exports.registerProvider = registerProvider;
exports.resolveConfig = resolveConfig;
exports.resolveModel = resolveModel;
