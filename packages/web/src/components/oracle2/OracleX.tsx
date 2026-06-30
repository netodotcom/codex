// oracle2 — OracleX component (migrated faithfully from oracle2.jsx v11).
// RICH RENDERING, TABS, FULL APP CONTROL via kernel tools, AI-BUSY orb.
// Behaviour, DOM, classes, events, and side-effects are unchanged from v1.
import React from "react";
import { injectCSS } from "./style.js";
import { ow } from "./oracle2-window.js";
import {
  ORACLE2_ACTIVE_KEY,
  ORACLE2_TOOLS_KEY,
  ORACLE2_TOOL_STEPS,
  ORACLE2_MAX_THREADS,
  oracle2NewThread,
  oracle2DeriveTitle,
  oracle2LoadThreads,
  oracle2SaveThreads,
} from "./data.js";
import type { OracleMsg, OracleThread } from "./data.js";
import { ORACLE2_SYSTEM, ORACLE2_INVOCATIONS, oracle2ParseToolCall, oracle2ToolDirective } from "./helpers.js";

const { useState, useEffect, useRef } = React;

interface ApiMsg {
  role: "user" | "assistant";
  content: string;
}

function stringifyError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (msg) return String(msg);
  }
  return String(e ?? "");
}

export function OracleX(): React.ReactElement {
  const [now, setNow] = useState<Record<string, unknown>>(() => {
    const n = ow().CODEX_NOW;
    return n ? (n as Record<string, unknown>) : {};
  });
  const [threads, setThreads] = useState<OracleThread[]>(oracle2LoadThreads);
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(ORACLE2_ACTIVE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toolsOn, setToolsOn] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(ORACLE2_TOOLS_KEY);
      if (v != null) return v === "1";
    } catch {
      // ignore
    }
    return !!ow().CODEX_KERNEL;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  // Self-injected CSS for everything v11 adds (idempotent <style id>).
  useEffect(() => {
    injectCSS();
  }, []);

  // The binding — follow the reader's cursor.
  useEffect(() => {
    const onNow = (e: Event): void => {
      const detail = (e as CustomEvent<Record<string, unknown>>).detail || ow().CODEX_NOW;
      if (detail && (detail as Record<string, unknown>)["ref"]) setNow(detail as Record<string, unknown>);
    };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  // Resolve active thread (fall back to the most recent).
  const active = threads.find((t) => t.id === activeId) || threads[0];
  const msgs: OracleMsg[] = (active && active.msgs) || [];

  useEffect(() => {
    oracle2SaveThreads(threads, active ? active.id : "");
  }, [threads, activeId]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, activeId]);
  useEffect(() => {
    try {
      localStorage.setItem(ORACLE2_TOOLS_KEY, toolsOn ? "1" : "0");
    } catch {
      // ignore
    }
  }, [toolsOn]);

  const patchActive = (updater: OracleMsg[] | ((prev: OracleMsg[]) => OracleMsg[])): void => {
    setThreads((prev) =>
      prev.map((t) => {
        if (!active || t.id !== active.id) return t;
        const nextMsgs = typeof updater === "function" ? updater(t.msgs) : updater;
        return { ...t, msgs: nextMsgs, title: oracle2DeriveTitle(nextMsgs), updatedAt: Date.now() };
      }),
    );
  };

  const newThread = (): void => {
    const t = oracle2NewThread();
    setThreads((prev) => [t, ...prev].slice(0, ORACLE2_MAX_THREADS));
    setActiveId(t.id);
    setErr(null);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) el.focus();
    }, 50);
  };

  const closeThread = (id: string): void => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (!next.length) {
        const t = oracle2NewThread();
        setActiveId(t.id);
        return [t];
      }
      if (active && id === active.id) {
        const first = next[0];
        if (first) setActiveId(first.id);
      }
      return next;
    });
  };

  // The binding: current verse text rides along as silent context.
  const contextBlock = (): string => {
    const n = ow().CODEX_NOW;
    if (!n) return "";
    const bid = n.bookId;
    if (!bid) return "";
    let text = "";
    try {
      const tr = n.translation || "web";
      const BIBLE = ow().BIBLE;
      const cached =
        BIBLE && typeof BIBLE.getCachedChapter === "function"
          ? BIBLE.getCachedChapter(bid, n.chapter, String(tr))
          : null;
      if (cached && Array.isArray(cached)) {
        const v = cached.find((x) => x.n === n.verse);
        if (v) {
          if (typeof v.text === "string") {
            text = v.text;
          } else {
            const trText = v[String(tr)];
            text = typeof trText === "string" ? trText : "";
          }
        }
      }
    } catch {
      // ignore
    }
    return `\n\n[READER CONTEXT — the user is at ${String(n.ref || "")}${text ? `: "${text}"` : ""}]`;
  };

  const callChat = async (system: string, apiMsgs: ApiMsg[]): Promise<string> => {
    let busyId: unknown = null;
    try {
      const busy_api = ow().CODEX_AI_BUSY;
      if (busy_api) busyId = busy_api.begin("ORACLE");
    } catch {
      // ignore
    }
    try {
      const tweaks = ((): { provider?: unknown; model?: unknown } => {
        try {
          return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as {
            provider?: unknown;
            model?: unknown;
          };
        } catch {
          return {};
        }
      })();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: tweaks.provider,
          model: tweaks.model,
          system,
          messages: apiMsgs,
          max_tokens: 1600,
        }),
      });
      interface ApiResp {
        text?: unknown;
        error?: unknown;
      }
      const raw: unknown = await r.json().catch((): unknown => ({}));
      const d: ApiResp = raw && typeof raw === "object" ? (raw as ApiResp) : {};
      if (!r.ok) {
        const errVal = d.error;
        const errMsg =
          typeof errVal === "string"
            ? errVal
            : errVal && typeof errVal === "object" && "message" in errVal && typeof (errVal as Record<string, unknown>)["message"] === "string"
              ? String((errVal as Record<string, unknown>)["message"])
              : "";
        throw new Error(errMsg || `HTTP ${r.status}`);
      }
      if (!d.text) throw new Error("the oracle returned silence");
      return String(d.text).trim();
    } finally {
      try {
        const busy_api = ow().CODEX_AI_BUSY;
        if (busyId != null && busy_api) busy_api.end(busyId);
      } catch {
        // ignore
      }
    }
  };

  const ask = (question: unknown): void => {
    const q = String(question || "").trim();
    if (!q || busyRef.current) return;
    setErr(null);
    const userMsg: OracleMsg = {
      role: "user",
      content: q,
      ref: String(now["ref"] || ""),
      ts: Date.now(),
    };
    const base = [...msgs, userMsg];
    patchActive(base);
    setBusy(true);
    busyRef.current = true;

    void (async () => {
      const grammar =
        ow().CODEX_ARTIFACTS && typeof ow().CODEX_ARTIFACTS?.directiveDoc === "function"
          ? "\n\n" + (ow().CODEX_ARTIFACTS?.directiveDoc?.() ?? "")
          : "";
      const toolsActive = toolsOn && !!ow().CODEX_KERNEL;
      const toolDoc = toolsActive ? oracle2ToolDirective() : "";
      const system = ORACLE2_SYSTEM + grammar + toolDoc + contextBlock();
      const apiMsgs: ApiMsg[] = base
        .filter((m) => m.role === "user" || m.role === "oracle")
        .slice(-12)
        .map((m) => ({
          role: m.role === "oracle" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));
      try {
        let reply = await callChat(system, apiMsgs);
        if (toolsActive) {
          for (let step = 0; step < ORACLE2_TOOL_STEPS; step++) {
            const call = oracle2ParseToolCall(reply);
            if (!call) break;
            let result = "";
            let failed = false;
            try {
              const K = ow().CODEX_KERNEL;
              result = String((K ? await K.call(call.tool, call.args) : undefined) ?? "");
            } catch (e) {
              result = stringifyError(e) || "tool failed";
              failed = true;
            }
            const preview = result.replace(/\s+/g, " ").trim().slice(0, 110) || "(empty)";
            patchActive((m) => [
              ...m,
              { role: "tool", tool: call.tool, content: preview, failed, ts: Date.now() },
            ]);
            apiMsgs.push({ role: "assistant", content: reply });
            apiMsgs.push({
              role: "user",
              content:
                `RESULT of ${call.tool}:\n${result.slice(0, 2400)}` +
                (step === ORACLE2_TOOL_STEPS - 1
                  ? "\n\n(Tool budget exhausted — answer the user now in prose/rich output. Do NOT emit another tool call.)"
                  : ""),
            });
            reply = await callChat(system, apiMsgs);
          }
          if (oracle2ParseToolCall(reply)) {
            apiMsgs.push({ role: "assistant", content: reply });
            apiMsgs.push({ role: "user", content: "Stop calling tools. Answer the user now in prose." });
            reply = await callChat(system, apiMsgs);
          }
        }
        patchActive((m) => [...m, { role: "oracle", content: reply, ts: Date.now() }]);
      } catch (e) {
        setErr(stringifyError(e) || "unknown error");
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    })();
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    ask(input);
    setInput("");
  };

  const Rich = (ow().CODEX_ARTIFACTS && ow().CODEX_ARTIFACTS?.Rich) || null;
  const nowRef = String(now["ref"] || "");

  return (
    <div className="cxo">
      <div className="cxo-banner" role="note">
        ◬ AI COMPANION · NOT SCRIPTURE · EVERY CITED REF IS ONE TAP FROM THE TEXT — CHECK ITS WORK
      </div>

      {/* threads as tabs */}
      <div className="cxo2-tabs" role="tablist" aria-label="Oracle threads">
        {threads.map((t) => {
          const isActive = !!(active && t.id === active.id);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              className={`cxo2-tab ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setActiveId(t.id);
                setErr(null);
              }}
              title={t.title}
            >
              <span className="cxo2-tab-lbl">{t.title}</span>
              {threads.length > 1 ? (
                <span
                  className="cxo2-tab-x"
                  role="button"
                  tabIndex={-1}
                  aria-label="Close thread"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeThread(t.id);
                  }}
                >
                  ×
                </span>
              ) : null}
            </button>
          );
        })}
        <button className="cxo2-tab-new" onClick={newThread} title="New thread" aria-label="New thread">
          +
        </button>
        {ow().CODEX_KERNEL ? (
          <button
            className={`cxo2-tools ${toolsOn ? "is-on" : ""}`}
            onClick={() => setToolsOn((v) => !v)}
            aria-pressed={toolsOn}
            title={
              toolsOn
                ? "Agent tools ON — the oracle may drive the app mid-chat (read passages, search, open panels, change settings — every call shown as a chip). Click to disable."
                : "Agent tools OFF — prose-only replies. Click to enable."
            }
          >
            ⚒ TOOLS
          </button>
        ) : null}
      </div>

      {/* the binding — what the oracle is looking at */}
      <div className="cxo-bind">
        <span className="cxo-bind-dot" aria-hidden />
        <span className="cxo-bind-lbl">BOUND TO</span>
        <button
          className="cxo-bind-ref"
          onClick={() => {
            if (nowRef && ow().codexJumpToRef) ow().codexJumpToRef?.(nowRef);
          }}
          title="The oracle reads over your shoulder — click to return there"
        >
          {nowRef || "the reader"}
        </button>
        {msgs.length ? (
          <button className="cxo-clear" onClick={() => patchActive([])} title="Burn this thread's messages">
            CLEAR
          </button>
        ) : null}
      </div>

      {/* invocations — one-tap scholarly moves on the current verse */}
      <div className="cxo-invoke" role="toolbar" aria-label="Invocations">
        {ORACLE2_INVOCATIONS.map((inv) => (
          <button
            key={inv.id}
            className="cxo-inv"
            disabled={busy || !nowRef}
            onClick={() => ask(inv.prompt(nowRef))}
            title={inv.prompt(nowRef || "the current verse")}
          >
            <i aria-hidden>{inv.glyph}</i>
            {inv.label}
          </button>
        ))}
      </div>

      <div className="cxo-thread" ref={scrollRef} aria-live="polite">
        {!msgs.length && !busy ? (
          <div className="cxo-empty">
            <span aria-hidden>◬</span>
            <p>The oracle waits. Invoke a move above, or ask anything about {nowRef || "the text"}.</p>
          </div>
        ) : null}
        {msgs.map((m, i) => {
          if (m.role === "tool") {
            return (
              <div key={i} className={`cxo2-toolchip ${m.failed ? "is-failed" : ""}`} title={m.content}>
                <b>⚒ {m.tool}</b>
                <span>{m.content}</span>
              </div>
            );
          }
          return (
            <div key={i} className={`cxo-msg is-${m.role}`}>
              {m.role === "user" ? (
                <>
                  <span className="cxo-msg-who">
                    YOU{m.ref ? ` · ${m.ref}` : ""}
                  </span>
                  <p>{m.content}</p>
                </>
              ) : (
                <>
                  <span className="cxo-msg-who">◬ ORACLE</span>
                  {Rich
                    ? React.createElement(Rich, { text: m.content })
                    : m.content.split(/\n{2,}/).map((p, j) => <p key={j}>{p}</p>)}
                </>
              )}
            </div>
          );
        })}
        {busy ? (
          <div className="cxo-msg is-oracle is-busy">
            <span className="cxo-msg-who">◬ ORACLE</span>
            <p className="cxo-consult">
              <i />
              <i />
              <i /> consulting…
            </p>
          </div>
        ) : null}
        {err ? (
          <div className="cxo-err">
            <b>THE ORACLE IS DARK</b>
            <code>{err}</code>
          </div>
        ) : null}
      </div>

      <form className="cxo-ask" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={nowRef ? `Ask about ${nowRef}…` : "Ask the oracle…"}
          aria-label="Ask the oracle"
          spellCheck={false}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          ⮐
        </button>
      </form>
    </div>
  );
}
