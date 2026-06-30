// app — the single notification dock + auto-cache pill (migrated from app.jsx).
// ToastDock is the ONE renderer for codex:toast (plain {msg,kind} + rich "mark"
// variants). AutoCacheTick surfaces auto-cache progress in the footer.
import React from "react";
import { Tick } from "../components/reader/chrome.js";

const { useState, useEffect } = React;

interface ToastItem {
  id: string;
  variant?: string;
  kind: string;
  msg?: string;
  icon?: string;
  label?: string;
  title?: string;
  desc?: string;
}

export function ToastDock(): React.ReactElement | null {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const reduced = (() => {
      try {
        return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    })();
    const LIFETIME = reduced ? 6000 : 4200;
    const onToast = (e: Event): void => {
      const d = (e as CustomEvent<Record<string, string>>).detail || {};
      const kindRaw = d["kind"];
      const kind = ["ok", "warn", "err"].includes(kindRaw ?? "") ? kindRaw! : "info";
      const id = Math.random().toString(36).slice(2);
      if (d["variant"] === "mark") {
        const label = String(d["label"] || "").slice(0, 80);
        const title = String(d["title"] || "").slice(0, 160);
        const desc = String(d["desc"] || "").slice(0, 220);
        if (!label && !title && !desc) return;
        setItems((prev) => [...prev, { id, variant: "mark", kind, icon: d["icon"] || "▦", label, title, desc }].slice(-3));
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), LIFETIME);
        return;
      }
      const msg = String(d["msg"] || "").slice(0, 220);
      if (!msg) return;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline && kindRaw === "err" && /panel|fetch|network|api|model|oracle|generate/i.test(msg)) return;
      setItems((prev) => [...prev, { id, msg, kind }].slice(-3));
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), LIFETIME);
    };
    window.addEventListener("codex:toast", onToast);
    (window as unknown as { __cxToastListener?: boolean }).__cxToastListener = true;
    return () => {
      window.removeEventListener("codex:toast", onToast);
      (window as unknown as { __cxToastListener?: boolean }).__cxToastListener = false;
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="cx-toast-dock" aria-live="polite">
      {items.map((t) =>
        t.variant === "mark" ? (
          <div key={t.id} className={`cx-toast cx-toast--mark cx-toast-${t.kind}`}>
            <span className="cx-toast-icon" aria-hidden="true">
              {t.icon || "▦"}
            </span>
            <div className="cx-toast-body">
              <div className="cx-toast-label">{t.label}</div>
              <div className="cx-toast-title">{t.title}</div>
              <div className="cx-toast-desc">{t.desc}</div>
            </div>
          </div>
        ) : (
          <div key={t.id} className={`cx-toast cx-toast-${t.kind}`}>
            {t.msg}
          </div>
        ),
      )}
    </div>
  );
}

interface CacheState {
  phase: "idle" | "running" | "done" | "hidden";
  done: number;
  total: number;
  pct: number;
}

export function AutoCacheTick(): React.ReactElement | null {
  const [state, setState] = useState<CacheState>({ phase: "idle", done: 0, total: 0, pct: 0 });
  useEffect(() => {
    const onStart = (e: Event): void => setState({ phase: "running", done: 0, total: (e as CustomEvent<{ total?: number }>).detail.total || 0, pct: 0 });
    const onTick = (e: Event): void => {
      const d = (e as CustomEvent<{ total?: number; done?: number }>).detail || {};
      const total = d.total || 0;
      const done = d.done || 0;
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      setState({ phase: "running", done, total, pct });
    };
    const onDone = (): void => {
      setState({ phase: "done", done: 0, total: 0, pct: 100 });
      setTimeout(() => setState((s) => ({ ...s, phase: "hidden" })), 4000);
    };
    const onErr = (): void => setState({ phase: "hidden", done: 0, total: 0, pct: 0 });
    window.addEventListener("codex:autocache-start", onStart);
    window.addEventListener("codex:autocache-tick", onTick);
    window.addEventListener("codex:autocache-done", onDone);
    window.addEventListener("codex:autocache-error", onErr);
    return () => {
      window.removeEventListener("codex:autocache-start", onStart);
      window.removeEventListener("codex:autocache-tick", onTick);
      window.removeEventListener("codex:autocache-done", onDone);
      window.removeEventListener("codex:autocache-error", onErr);
    };
  }, []);
  if (state.phase === "idle" || state.phase === "hidden") return null;
  if (state.phase === "done") {
    return <Tick className="cx-hide-mobile cx-autocache is-done">✓ INSTALLED</Tick>;
  }
  return (
    <Tick className="cx-hide-mobile cx-autocache">
      INSTALL&nbsp;<b>{state.pct}%</b>
    </Tick>
  );
}
