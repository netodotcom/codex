// app — API keys settings section (migrated from app.jsx). Anthropic / Grok /
// Groq / Gemini / Ollama, with a segmented active-engine selector. Keys persist
// through the IDB-backed store; Ollama is probed for its local model list.
import React from "react";
import { loadApiKeys, saveApiKeys, OLLAMA_URL_LS, OLLAMA_MODEL_LS, OLLAMA_DEFAULT_URL, type ApiKeys } from "./api-keys.js";
import { aw } from "./app-window.js";

const { useState, useEffect, useCallback } = React;

interface OllamaModel {
  id: string;
  label: string;
}
interface OllamaProbe {
  status: "idle" | "probing" | "ok" | "down";
  models: OllamaModel[];
  err: string;
}

export function ApiKeysSection(): React.ReactElement {
  const [keys, setKeys] = useState<ApiKeys>(loadApiKeys);
  const [showA, setShowA] = useState(false);
  const [showG, setShowG] = useState(false);
  const [showQ, setShowQ] = useState(false);
  const [showM, setShowM] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyG, setBusyG] = useState(false);
  const [busyQ, setBusyQ] = useState(false);
  const [busyM, setBusyM] = useState(false);
  const [statusA, setStatusA] = useState("");
  const [statusG, setStatusG] = useState("");
  const [statusQ, setStatusQ] = useState("");
  const [statusM, setStatusM] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState(() => {
    try {
      return localStorage.getItem(OLLAMA_URL_LS) || OLLAMA_DEFAULT_URL;
    } catch {
      return OLLAMA_DEFAULT_URL;
    }
  });
  const [ollamaModel, setOllamaModel] = useState(() => {
    try {
      return localStorage.getItem(OLLAMA_MODEL_LS) || "";
    } catch {
      return "";
    }
  });
  const [ollamaProbe, setOllamaProbe] = useState<OllamaProbe>({ status: "idle", models: [], err: "" });

  const update = (patch: Partial<ApiKeys>): void => {
    const cleaned: Partial<ApiKeys> = { ...patch };
    if (typeof cleaned.anthropic === "string") cleaned.anthropic = cleaned.anthropic.trim();
    if (typeof cleaned.grok === "string") cleaned.grok = cleaned.grok.trim();
    if (typeof cleaned.groq === "string") cleaned.groq = cleaned.groq.trim();
    if (typeof cleaned.gemini === "string") cleaned.gemini = cleaned.gemini.trim();
    const next: ApiKeys = { ...keys, ...cleaned };
    if (patch.active === undefined) {
      if (cleaned.groq && cleaned.groq.startsWith("gsk_")) next.active = "groq";
      else if (cleaned.anthropic && cleaned.anthropic.startsWith("sk-")) next.active = "anthropic";
      else if (cleaned.grok && cleaned.grok.startsWith("xai-")) next.active = "grok";
      else if (cleaned.gemini && cleaned.gemini.startsWith("AIza")) next.active = "gemini";
      if (next.active === "anthropic" && !next.anthropic) {
        if (next.groq) next.active = "groq";
        else if (next.grok) next.active = "grok";
        else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "grok" && !next.grok) {
        if (next.groq) next.active = "groq";
        else if (next.anthropic) next.active = "anthropic";
        else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "groq" && !next.groq) {
        if (next.anthropic) next.active = "anthropic";
        else if (next.grok) next.active = "grok";
        else if (next.gemini) next.active = "gemini";
      }
      if (next.active === "gemini" && !next.gemini) {
        if (next.anthropic) next.active = "anthropic";
        else if (next.groq) next.active = "groq";
        else if (next.grok) next.active = "grok";
      }
    }
    setKeys(next);
    const r = saveApiKeys(next);
    if (patch.anthropic !== undefined) setStatusA(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    if (patch.grok !== undefined) setStatusG(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    if (patch.groq !== undefined) setStatusQ(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    if (patch.gemini !== undefined) setStatusM(r.ok ? "" : "⚠ saved to IDB only (localStorage full)");
    try {
      aw().CODEX_DIRECT?.notifyEngineChange();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onRestore = (e: Event): void => {
      const v = (e as CustomEvent<Partial<ApiKeys>>).detail;
      if (!v || typeof v !== "object") return;
      setKeys((cur) => (cur.anthropic || cur.grok || cur.groq || cur.gemini ? cur : { ...cur, ...v }));
    };
    window.addEventListener("codex:keys:restored", onRestore);
    return () => window.removeEventListener("codex:keys:restored", onRestore);
  }, []);

  const applyAnthropic = async (): Promise<void> => {
    const key = (keys.anthropic || "").trim();
    if (!key.startsWith("sk-")) {
      setStatusA("Key must start with sk-");
      return;
    }
    setBusyA(true);
    setStatusA("");
    try {
      const r = await fetch("/api/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      setStatusA(r.ok ? "✓ applied" : "✓ saved locally");
    } catch {
      setStatusA("✓ saved locally");
    } finally {
      setBusyA(false);
      try {
        aw().CODEX_DIRECT?.notifyEngineChange();
      } catch {
        /* ignore */
      }
    }
  };

  const applyProvider = (provider: "xai" | "groq" | "gemini", prefix: string, key: string, setBusy: (b: boolean) => void, setStatus: (s: string) => void) => async (): Promise<void> => {
    const k = key.trim();
    if (provider === "gemini") {
      if (k.length < 30) {
        setStatus("Key looks too short (need ≥30 chars)");
        return;
      }
    } else if (!k.startsWith(prefix)) {
      setStatus(`Key must start with ${prefix}`);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, provider }) });
      setStatus(r.ok ? "✓ applied" : "✓ saved locally");
    } catch {
      setStatus("✓ saved locally");
    } finally {
      try {
        aw().CODEX_DIRECT?.notifyEngineChange();
      } catch {
        /* ignore */
      }
      setBusy(false);
    }
  };
  const applyGrok = applyProvider("xai", "xai-", keys.grok, setBusyG, setStatusG);
  const applyGroq = applyProvider("groq", "gsk_", keys.groq, setBusyQ, setStatusQ);
  const applyGemini = applyProvider("gemini", "AIza", keys.gemini, setBusyM, setStatusM);

  const probeOllama = useCallback(
    async (url?: string): Promise<void> => {
      const u = (url || ollamaUrl || OLLAMA_DEFAULT_URL).replace(/\/+$/, "");
      setOllamaProbe({ status: "probing", models: [], err: "" });
      try {
        const r = await fetch(u + "/api/tags");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = (await r.json()) as { models?: Array<{ name: string }> };
        const models: OllamaModel[] = (d.models || []).map((m) => ({ id: m.name, label: m.name }));
        setOllamaProbe({ status: "ok", models, err: "" });
        if (!ollamaModel && models[0]) {
          setOllamaModel(models[0].id);
          try {
            localStorage.setItem(OLLAMA_MODEL_LS, models[0].id);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        setOllamaProbe({ status: "down", models: [], err: String((e as Error).message || e) });
      }
    },
    [ollamaUrl, ollamaModel],
  );
  useEffect(() => {
    void probeOllama(ollamaUrl);
  }, []);

  const updateOllamaUrl = (v: string): void => {
    setOllamaUrl(v);
    try {
      localStorage.setItem(OLLAMA_URL_LS, v);
    } catch {
      /* ignore */
    }
  };
  const updateOllamaModel = (v: string): void => {
    setOllamaModel(v);
    try {
      localStorage.setItem(OLLAMA_MODEL_LS, v);
    } catch {
      /* ignore */
    }
  };
  const activateOllama = (): void => update({ active: "ollama" });

  const seg = (id: ApiKeys["active"], glyph: string, name: string, sub: string, disabled: boolean, enabledTitle: string, disabledTitle: string): React.ReactElement => (
    <button role="tab" aria-selected={keys.active === id} className={`cx-api-seg-btn ${keys.active === id ? "is-on" : ""}`} onClick={() => update({ active: id })} disabled={disabled} title={disabled ? disabledTitle : enabledTitle}>
      <span className="cx-api-seg-glyph">{glyph}</span>
      <span>
        <b>{name}</b>
        <i>
          {sub}
          {keys.active === id ? " · active" : ""}
        </i>
      </span>
    </button>
  );

  const field = (
    label: React.ReactNode,
    status: string,
    show: boolean,
    setShow: (f: (s: boolean) => boolean) => void,
    value: string,
    placeholder: string,
    onChange: (v: string) => void,
    apply: () => void,
    busy: boolean,
    hint?: React.ReactNode,
  ): React.ReactElement => (
    <div className="cx-api-field">
      <label className="cx-api-lbl">
        <span>{label}</span>
        {status ? <em className={`cx-api-status ${status.startsWith("✓") ? "is-ok" : "is-err"}`}>{status}</em> : null}
      </label>
      <div className="cx-api-row">
        <input className="cx-api-input" type={show ? "text" : "password"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} spellCheck={false} autoComplete="off" />
        <button className="cx-api-eye" onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"}>{show ? "◐" : "◌"}</button>
        <button className="cx-api-save" onClick={apply} disabled={busy || !value}>{busy ? "···" : "APPLY"}</button>
      </div>
      {hint || null}
    </div>
  );

  return (
    <div className="cx-api">
      <div className="cx-api-seg" role="tablist" aria-label="Active engine">
        {seg("anthropic", "◉", "Anthropic", "Claude", !keys.anthropic, "Use Claude as the Oracle engine", "Add your Anthropic key first")}
        {seg("grok", "⌬", "Grok", "xAI", !keys.grok, "Use Grok as the Oracle engine", "Add your Grok key first")}
        {seg("groq", "⚡", "Groq", "free", !keys.groq, "Use Groq (free fast inference) as the Oracle engine", "Add your Groq key first")}
        {seg("gemini", "✦", "Gemini", "Google", !keys.gemini, "Use Google Gemini as the Oracle engine", "Add your Gemini key first")}
        {seg("ollama", "▣", "Ollama", "local", ollamaProbe.status !== "ok", "Use your local Ollama daemon", "Start Ollama locally to enable")}
      </div>

      {field("Anthropic API key", statusA, showA, setShowA, keys.anthropic, "sk-ant-...", (v) => update({ anthropic: v }), applyAnthropic, busyA)}
      {field("Grok API key", statusG, showG, setShowG, keys.grok, "xai-...", (v) => update({ grok: v }), applyGrok, busyG, <p className="cx-api-hint">All keys stay in your browser. Switch engines via the toggle above — takes effect on the next Oracle reply.</p>)}
      {field(
        <span>Groq API key <em style={{ opacity: 0.65 }}>· free, fast (groq.com)</em></span>,
        statusQ, showQ, setShowQ, keys.groq, "gsk_...", (v) => update({ groq: v }), applyGroq, busyQ,
        <p className="cx-api-hint">Get a free key at <code>console.groq.com</code>. Runs Llama 3.3 70B + DeepSeek R1 on LPU silicon.</p>,
      )}
      {field(
        <span>Gemini API key <em style={{ opacity: 0.65 }}>· free · Google AI Studio · 1M tokens/day</em></span>,
        statusM, showM, setShowM, keys.gemini, "AIza... (or any long alphanumeric Gemini key)", (v) => update({ gemini: v }), applyGemini, busyM,
        <p className="cx-api-hint">Get a free key at <code>aistudio.google.com/apikey</code>. Generous free tier — 1M tokens/day, ~15 req/min. Multimodal-ready.</p>,
      )}

      <div className="cx-api-field">
        <label className="cx-api-lbl">
          <span>Ollama (local, no key) <em style={{ opacity: 0.65 }}>· runs on your machine</em></span>
          {ollamaProbe.status === "ok" && <em className="cx-api-status is-ok">✓ {ollamaProbe.models.length} model{ollamaProbe.models.length === 1 ? "" : "s"} detected</em>}
          {ollamaProbe.status === "down" && <em className="cx-api-status is-err">⚠ not detected — install at ollama.com</em>}
          {ollamaProbe.status === "probing" && <em className="cx-api-status">…probing</em>}
        </label>
        <div className="cx-api-row">
          <input className="cx-api-input" type="text" value={ollamaUrl} placeholder={OLLAMA_DEFAULT_URL} onChange={(e) => updateOllamaUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void probeOllama(ollamaUrl); }} spellCheck={false} autoComplete="off" />
          <button className="cx-api-save" onClick={() => void probeOllama(ollamaUrl)} title="Probe the daemon">DETECT</button>
        </div>
        {ollamaProbe.status === "ok" && (
          <div className="cx-api-row" style={{ marginTop: 6 }}>
            <select className="cx-api-input" value={ollamaModel} onChange={(e) => updateOllamaModel(e.target.value)}>
              {ollamaProbe.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button className="cx-api-save" onClick={activateOllama} disabled={keys.active === "ollama"}>{keys.active === "ollama" ? "ACTIVE" : "USE"}</button>
          </div>
        )}
        <p className="cx-api-hint">Browser → <code>{ollamaUrl}</code> works when Ollama runs on the same machine as your browser. For LAN access, start Ollama with <code>OLLAMA_HOST=0.0.0.0</code>.</p>
      </div>
    </div>
  );
}
