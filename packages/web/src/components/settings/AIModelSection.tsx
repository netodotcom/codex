// settings — AI provider + model + key + honest TEST (migrated from
// tweaks-panel.jsx). Picks a provider, lists its models (from the live registry
// or the static catalog), takes a key where needed, and pings /api/chat to
// report real latency or the real error.
import React from "react";
import { sw, type ProviderReg, type ModelEntry } from "./settings-window.js";

export function AIModelSection({
  provider,
  model,
  availableProviders,
  onChange,
}: {
  provider: string;
  model: string;
  availableProviders?: Record<string, ProviderReg>;
  onChange: (next: { provider: string; model: string }) => void;
}): React.ReactElement {
  const [keyInput, setKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [keyBusy, setKeyBusy] = React.useState(false);
  const [keyMsg, setKeyMsg] = React.useState("");
  const [testMsg, setTestMsg] = React.useState("");
  const [testBusy, setTestBusy] = React.useState(false);

  const PROVIDERS = [
    { id: "anthropic", label: "Anthropic", sub: "Claude" },
    { id: "xai", label: "xAI", sub: "Grok" },
    { id: "groq", label: "Groq", sub: "free" },
    { id: "gemini", label: "Gemini", sub: "Google" },
    { id: "ollama", label: "Local", sub: "Ollama" },
  ];

  const reg = availableProviders || {};
  const curReg = reg[provider] || { available: false, models: [] };
  const catalogKey = provider === "xai" ? "grok" : provider;
  const catalog = (typeof window !== "undefined" && sw().CODEX_MODELS && sw().CODEX_MODELS?.[catalogKey]) || [];
  const models: ModelEntry[] = curReg.models && curReg.models.length ? curReg.models : catalog;
  const needsKey = (provider === "anthropic" || provider === "xai" || provider === "groq" || provider === "gemini") && !curReg.available;

  const pickProvider = (p: string): void => {
    const r = reg[p];
    const ck = p === "xai" ? "grok" : p;
    const cat = (typeof window !== "undefined" && sw().CODEX_MODELS && sw().CODEX_MODELS?.[ck]) || [];
    const first = (r && r.models && r.models[0] && r.models[0].id) || (cat[0] && cat[0].id) || "";
    onChange({ provider: p, model: first });
  };

  const tooltipFor = (p: string): string => {
    const r = reg[p];
    if (r && r.available) return `Use ${p}`;
    if (p === "ollama") return "Local: no Ollama detected (start the daemon)";
    if (p === "xai") return "xAI: no key configured";
    if (p === "groq") return "Groq: no key configured — get a free key at console.groq.com";
    if (p === "gemini") return "Gemini: no key configured — get a free key at aistudio.google.com/apikey";
    if (p === "anthropic") return "Anthropic: no key configured";
    return "";
  };

  const submitKey = async (): Promise<void> => {
    const key = keyInput.trim();
    if (!key) return;
    setKeyBusy(true);
    setKeyMsg("");
    try {
      const r = await fetch("/api/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, provider }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setKeyMsg("✓ saved");
      setKeyInput("");
      try {
        window.dispatchEvent(new CustomEvent("codex:engine-change"));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setKeyMsg(String((e as Error).message || e));
    } finally {
      setKeyBusy(false);
    }
  };

  const runTest = async (): Promise<void> => {
    setTestBusy(true);
    setTestMsg("");
    const t0 = performance.now();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; usage?: { input_tokens?: number; output_tokens?: number } };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const ms = Math.round(performance.now() - t0);
      const u = d.usage || {};
      const toks = (u.input_tokens || 0) + (u.output_tokens || 0);
      setTestMsg(`✓ ${ms}ms${toks ? ` · ${toks} tok` : ""}`);
    } catch (e) {
      setTestMsg("✗ " + String((e as Error).message || e).slice(0, 80));
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="cx-tp-provider">
      <div className="cx-tp-provider-seg" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map((p) => {
          const r = reg[p.id] || { available: false };
          const on = provider === p.id;
          const off = !r.available;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`cx-tp-provider-btn ${on ? "is-on" : ""} ${off ? "is-off" : ""}`}
              title={tooltipFor(p.id)}
              onClick={() => pickProvider(p.id)}
            >
              <b>{p.label}</b>
              <i>
                {p.sub}
                {off ? " · off" : ""}
              </i>
            </button>
          );
        })}
      </div>

      <div className="cx-tp-model-row">
        <label className="cx-tp-model-lbl">Model</label>
        <select className="cx-tp-model-sel" value={model || ""} onChange={(e) => onChange({ provider, model: e.target.value })} disabled={!models.length}>
          {!models.length && <option value="">— none available —</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.tier ? `  · ${m.tier}` : ""}
            </option>
          ))}
        </select>
      </div>

      {needsKey && (
        <div className="cx-tp-key">
          <label className="cx-tp-key-lbl">
            {provider === "xai" ? "xAI API key (xai-…)" : provider === "groq" ? "Groq API key (gsk_…)" : provider === "gemini" ? "Gemini API key (AIza… / aistudio.google.com)" : "Anthropic API key (sk-ant-…)"}
            {keyMsg ? <em className={`cx-tp-key-msg ${keyMsg.startsWith("✓") ? "is-ok" : "is-err"}`}>{keyMsg}</em> : null}
          </label>
          <div className="cx-tp-key-row twkx-keyrow">
            <input
              className="cx-tp-key-input"
              type={showKey ? "text" : "password"}
              value={keyInput}
              placeholder={provider === "xai" ? "xai-…" : provider === "groq" ? "gsk_…" : provider === "gemini" ? "AIza…" : "sk-ant-…"}
              onChange={(e) => setKeyInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="twkx-eye" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? "Hide key" : "Reveal key"} title={showKey ? "Hide key" : "Reveal key"}>
              {showKey ? "◐" : "◌"}
            </button>
            <button className="cx-tp-key-btn" onClick={submitKey} disabled={keyBusy || !keyInput.trim()}>
              {keyBusy ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="cx-tp-test-row">
        <button className="cx-tp-test-btn" onClick={runTest} disabled={testBusy || !model || needsKey} title="Send a tiny ping to verify connectivity — reports real latency or the real error">
          {testBusy ? "Testing…" : "Test"}
        </button>
        {testMsg ? <span className={`cx-tp-test-msg ${testMsg.startsWith("✓") ? "is-ok" : "is-err"}`}>{testMsg}</span> : null}
      </div>
    </div>
  );
}
