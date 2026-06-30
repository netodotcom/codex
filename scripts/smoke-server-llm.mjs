// Smoke: the server's consolidated LLM dispatch (via vendor/codex-llm.cjs)
// produces the right provider request — parity with the old post* functions.
// Run: node scripts/smoke-server-llm.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_LLM = require(join(ROOT, "vendor", "codex-llm.cjs"));

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log("  ✓ " + msg);
  else {
    console.log("  ✗ " + msg);
    failures++;
  }
};

// Replicate the server's llmDispatch wiring exactly.
function makeClient(captured) {
  const fetch = async (url, init) => {
    captured.push({ url, init });
    return { status: 200, json: async () => ({ choices: [{ message: { content: "ok" } }], model: "m", usage: { prompt_tokens: 2, completion_tokens: 3 } }) };
  };
  return CODEX_LLM.createLlmClient({ fetch });
}
async function dispatch(client, provider, payload, opts) {
  const cfg = CODEX_LLM.resolveConfig(provider, opts);
  if (opts && opts.model) cfg.model = opts.model;
  const res = await client.chat({ system: payload.system, messages: payload.messages || [], maxTokens: payload.max_tokens }, cfg);
  return res;
}

const run = async () => {
  // xAI — OpenAI endpoint, Bearer auth, temperature 0.7, pinned model, system first.
  {
    const captured = [];
    const client = makeClient(captured);
    const res = await dispatch(client, "xai", { system: "SYS", messages: [{ role: "user", content: "hi" }], max_tokens: 50 }, { apiKey: "xai-K", model: "grok-3", temperature: 0.7 });
    const c = captured[0];
    console.log("xAI:");
    ok(c.url === "https://api.x.ai/v1/chat/completions", "endpoint = api.x.ai/v1/chat/completions");
    ok(c.init.headers["Authorization"] === "Bearer xai-K", "Authorization Bearer");
    const body = JSON.parse(c.init.body);
    ok(body.model === "grok-3", "model pinned to grok-3 (no core remap)");
    ok(body.temperature === 0.7, "temperature 0.7 sent");
    ok(body.messages[0].role === "system" && body.messages[0].content === "SYS", "system message first");
    ok(res.text === "ok" && res.usage.input_tokens === 2 && res.usage.output_tokens === 3, "unified response + usage");
  }
  // Ollama — local endpoint, no key, custom baseUrl honored.
  {
    const captured = [];
    const client = makeClient(captured);
    await dispatch(client, "ollama", { messages: [{ role: "user", content: "hi" }] }, { apiKey: "", model: "llama3.2", baseUrl: "http://localhost:11434/v1/chat/completions" });
    const c = captured[0];
    console.log("Ollama:");
    ok(c.url === "http://localhost:11434/v1/chat/completions", "endpoint = local ollama");
    ok(c.init.headers["Authorization"] === undefined, "no Authorization header (keyless local)");
    ok(JSON.parse(c.init.body).model === "llama3.2", "model llama3.2");
  }
  // Error mapping → LlmError surfaces status + message.
  {
    const fetch = async () => ({ status: 401, json: async () => ({ error: { message: "bad key" } }) });
    const client = CODEX_LLM.createLlmClient({ fetch });
    let caught = null;
    try {
      await client.chat({ messages: [{ role: "user", content: "x" }] }, CODEX_LLM.resolveConfig("groq", { apiKey: "k", model: "llama-3.3-70b-versatile" }));
    } catch (e) {
      caught = e;
    }
    console.log("Error mapping:");
    ok(caught instanceof CODEX_LLM.LlmError && caught.status === 401 && caught.message === "bad key", "LlmError 401 'bad key'");
  }

  console.log(failures === 0 ? "\nSMOKE PASS" : `\nSMOKE FAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
};
run();
