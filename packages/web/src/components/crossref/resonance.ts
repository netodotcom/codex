// crossref — depth-action emit + the optional AI "resonance" (migrated from
// crossref.jsx). All of it silently degrades when the engines / keys are
// absent. Reads window.CODEX_ENGAGEMENT, window.CODEX_INTEL, the live intel
// engine, localStorage, window.CODEX_DATA, and POSTs to /api/chat.
import { xw } from "./crossref-window.js";
import type { IntelEngine } from "./crossref-window.js";
import { formatRef, snippetFor } from "./helpers.js";

// ── Depth-action emit (frozen contract: crossref-follow w1 / chain w5) ─
export function emitDepth(type: string, ref: string | null, weight: number): void {
  try {
    const E = xw().CODEX_ENGAGEMENT;
    if (E && typeof E.emit === "function") {
      E.emit(type, ref || null, weight, "cross-references");
      return;
    }
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("codex:depth-action", {
          detail: { type, ref: ref || null, weight, domain: "cross-references" },
        }),
      );
    }
  } catch (e) {}
}

interface KeyStore {
  active?: unknown;
  anthropic?: unknown;
  grok?: unknown;
  groq?: unknown;
  gemini?: unknown;
}

// ── Optional AI "resonance" — silent degrade when no key is set ───────
export function hasAiKey(): boolean {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("codex.api.keys.v1") || "null");
    const k = (parsed && typeof parsed === "object" ? parsed : {}) as KeyStore;
    if (k.active === "ollama") return true; // local, keyless
    if (k.anthropic || k.grok || k.groq || k.gemini) return true;
  } catch (e) {}
  try {
    if (localStorage.getItem("codex.anthropic.key")) return true;
  } catch (e) {}
  const t: { provider?: unknown; model?: unknown } = (xw().CODEX_DATA && xw().CODEX_DATA!.tweaks) || {};
  return !!(t.provider || t.model);
}

export function getActiveEngine(): IntelEngine {
  return xw().CODEX_INTEL!.intelEngine();
}

export const RESONANCE_PROMPT =
  "You are a calm, scholarly study aide. In ONE or TWO sentences (under 45 words, no preamble, " +
  "no quotation marks), name the thematic thread that links these two scripture references. " +
  "Be specific and neutral; cite the shared motif, not a sermon.";

export function fetchResonance(
  sourceKey: string,
  targetKey: string,
  translation?: string,
): Promise<string | null> {
  const eng = getActiveEngine();
  const model = eng.model || "claude-haiku-4-5-20251001";
  const cacheKey =
    "codex.xref.resonance." + sourceKey + "|" + targetKey + "|" + (eng.provider || "") + "|" + model;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached != null) return Promise.resolve(cached || null);
  } catch (e) {}
  const srcRef = formatRef(sourceKey),
    tgtRef = formatRef(targetKey);
  const srcText = snippetFor(sourceKey, translation) || "";
  const tgtText = snippetFor(targetKey, translation) || "";
  return fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: eng.provider,
      model,
      system: RESONANCE_PROMPT,
      messages: [
        {
          role: "user",
          content: `A: ${srcRef}${srcText ? " — " + srcText : ""}\nB: ${tgtRef}${tgtText ? " — " + tgtText : ""}\n\nName the link.`,
        },
      ],
      max_tokens: 120,
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      const rec = body as { text?: unknown } | null;
      const text = rec && typeof rec.text === "string" ? rec.text.trim() : "";
      const out = text ? text.replace(/^["“]|["”]$/g, "").trim() : "";
      try {
        localStorage.setItem(cacheKey, out);
      } catch (e) {}
      return out || null;
    })
    .catch(() => null);
}
