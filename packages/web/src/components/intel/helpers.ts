// intel — pure helpers (migrated verbatim from intel.jsx). Exported individually
// so each can be ground-truth tested. intelEngine/intelAI read/call runtime
// globals (window.CODEX_DATA, fetch) but only at call time, not module load.
import { iw } from "./intel-window.js";

// ── Constants ────────────────────────────────────────────────────────────────
export const INTEL_GLYPHS = "█▓▒░<>/\\|=+*#@$%&0123456789ABCDEF";

// ── Reduced-motion ───────────────────────────────────────────────────────────
export function intelReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

// ── Grade ────────────────────────────────────────────────────────────────────
export interface IntelGrade {
  key: "strong" | "moderate" | "faint";
  label: string;
}

export function intelGrade(v: unknown): IntelGrade {
  const n = Number(v) || 0;
  if (n >= 75) return { key: "strong",   label: "STRONG"   };
  if (n >= 45) return { key: "moderate", label: "MODERATE" };
  return { key: "faint", label: "FAINT" };
}

// ── Tolerant JSON parser ─────────────────────────────────────────────────────
// Recovers usable data from truncated AI responses by walking the string,
// tracking the last safe close-boundary, and closing open brackets.
export function intelParseJSON(s: string): unknown {
  try { return JSON.parse(s); } catch { /* fall through to recovery */ }
  let inString = false, escape = false;
  const stk: string[] = [];
  let lastSafe = 0;
  let safeStack: string[] = [];
  const mark = (idx: number): void => { lastSafe = idx; safeStack = stk.slice(); };
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i); // charAt: always string, never undefined
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; continue; }
      if (c === "\"") { inString = false; mark(i + 1); }
      continue;
    }
    if (c === "\"") { inString = true; continue; }
    if (c === "{" || c === "[") stk.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { stk.pop(); mark(i + 1); }
    else if (c === ",") mark(i);
    else if (/[\d.eE+\-tfn ul]/.test(c)) mark(i + 1);
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return JSON.parse(head + safeStack.reverse().join(""));
}

// ── Year formatter ───────────────────────────────────────────────────────────
// "1492 BCE" / "70 CE" / "—"
export function intelFmtYear(y: number | null | undefined): string {
  if (y === 0 || y == null || Number.isNaN(y)) return "—";
  return `${Math.abs(y)} ${y < 0 ? "BCE" : "CE"}`;
}

// ── HTML escape ──────────────────────────────────────────────────────────────
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function intelEscapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

// ── Engine resolution ────────────────────────────────────────────────────────
// The user's active engine, same resolution the AI panels use.
export interface IntelEngineResult {
  provider: string | undefined;
  model: string | undefined;
}

export function intelEngine(): IntelEngineResult {
  const tweaks = iw().CODEX_DATA?.tweaks;
  const p = tweaks?.provider;
  const m = tweaks?.model;
  return {
    provider: p ? String(p) : undefined,
    model: m ? String(m) : undefined,
  };
}

// ── Error message extraction ─────────────────────────────────────────────────
// Server error shapes vary: {error:"msg"} or {error:{message}} — get a string.
export function intelErrMessage(body: unknown, status: number): string {
  if (body != null && typeof body === "object") {
    const b = body as { error?: unknown };
    const e = b.error;
    if (typeof e === "string") return e;
    if (e != null && typeof e === "object") {
      const err = e as { message?: unknown; type?: unknown };
      const msg = err.message;
      const tp = err.type;
      if (msg) return String(msg);
      if (tp) return String(tp);
      return JSON.stringify(e);
    }
  }
  return `HTTP ${status}`;
}

// ── AI call pipeline ─────────────────────────────────────────────────────────
// The /api/chat → JSON-object pipeline every console repeats:
// engine resolution → POST → fence-strip → first "{" → tolerant parse.
// Throws Error with a human-readable message on any failure.
export interface IntelAIOptions {
  system?: string;
  user: string;
  maxTokens?: number;
  model?: string;
  provider?: string;
}

export async function intelAI({ system, user, maxTokens = 2400, model, provider }: IntelAIOptions): Promise<unknown> {
  const eng = intelEngine();
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: provider !== undefined ? provider : eng.provider,
      model: model || eng.model || "claude-haiku-4-5-20251001",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens,
    }),
  });
  const body = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(intelErrMessage(body, r.status));
  const rawText = body["text"];
  const text = (typeof rawText === "string" ? rawText : "").trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = text.indexOf("{");
  if (i === -1) throw new Error("Response was not JSON");
  return intelParseJSON(text.slice(i));
}
