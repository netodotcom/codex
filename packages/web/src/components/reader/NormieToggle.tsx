// reader — "translate for normies" toggle (migrated from components.jsx).
// Rewrites dense esoteric / scholarly text in plain everyday language in the
// user's current UI language. Cached per text+lang so it's a one-time call.
import React from "react";
import { NORMIE_LANG_LABELS, normieHash, currentUiLang } from "./normie.js";
import { rw } from "./reader-window.js";

const { useState, useEffect } = React;

export function NormieToggle({ text, scope }: { text: string; scope?: string }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [plain, setPlain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lang = currentUiLang();
  const langLabel = NORMIE_LANG_LABELS[lang] || lang || "English";
  const cacheKey = `codex.normie.${scope || "gnosis"}.${normieHash(text || "")}.${lang}`;

  useEffect(() => {
    if (!open || plain || !text) return;
    let cancelled = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setPlain(cached);
        return;
      }
    } catch {
      /* ignore */
    }
    setLoading(true);
    setErr(null);
    const tweaks = rw().CODEX_DATA?.tweaks || {};
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: tweaks.provider,
        model: tweaks.model,
        system: `You are a friendly translator who rewrites dense esoteric, mystical, or scholarly Bible commentary into clear, plain everyday language anyone can understand. Use simple, conversational wording. No jargon. Keep it short: 1-3 sentences. Output ONLY the plain version, no preamble, no quotes. Respond in ${langLabel}.`,
        messages: [{ role: "user", content: text }],
        max_tokens: 300,
      }),
    })
      .then((r) => r.json())
      .then((d: { text?: string; error?: string }) => {
        if (cancelled) return;
        if (d.text) {
          const out = d.text.trim();
          setPlain(out);
          try {
            localStorage.setItem(cacheKey, out);
          } catch {
            /* ignore */
          }
        } else {
          throw new Error(d.error || "no response");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(String((e as Error).message || e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, text, cacheKey, langLabel, plain]);

  if (!text) return null;
  return (
    <div className="cx-normie">
      <button
        type="button"
        className={`cx-normie-btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
        title={open ? "Show original" : `Translate for normies (in ${langLabel})`}
      >
        {open ? "↺ original" : `🪶 plain version · ${lang}`}
      </button>
      {open ? (
        <div className="cx-normie-out">
          {loading ? <em>plain-talking…</em> : err ? <em className="cx-normie-err">⚠ {err}</em> : plain ? <p>{plain}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
