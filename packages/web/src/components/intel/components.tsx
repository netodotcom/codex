// intel — React UI primitives (migrated verbatim from intel.jsx). Classic JSX
// (import React from "react" required; jsxFactory = React.createElement).
// All five components keep their exact prop shapes, CSS class names, aria roles,
// and control flow. Quirks are preserved (decrypt animation fires once per mount;
// ticker never auto-advances under reduced-motion).
import React from "react";
import { INTEL_GLYPHS, intelReducedMotion, intelGrade } from "./helpers.js";

const { useState, useEffect, useRef } = React;

// ── Decrypt-in text ──────────────────────────────────────────────────────────
// Scrambles every character, then resolves left→right. Runs once per mount.
export interface IntelDecryptProps {
  text: unknown;
  speed?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

export function IntelDecrypt({ text, speed = 18, className = "", as: As = "span" }: IntelDecryptProps): React.ReactElement {
  const target = String(text == null ? "" : text);
  const [shown, setShown] = useState(() => (intelReducedMotion() ? target : ""));
  const doneRef = useRef(intelReducedMotion());

  useEffect(() => {
    if (doneRef.current) { setShown(target); return; }
    let raf = 0, start = 0, cancelled = false;
    const step = (ts: number): void => {
      if (cancelled) return;
      if (!start) start = ts;
      // resolved chars grow with time; unresolved tail shows cipher noise
      const resolved = Math.min(target.length, Math.floor((ts - start) / speed));
      if (resolved >= target.length) { setShown(target); doneRef.current = true; return; }
      let s = target.slice(0, resolved);
      const tail = Math.min(target.length - resolved, 10);
      for (let i = 0; i < tail; i++) {
        // charAt: always string, avoids noUncheckedIndexedAccess on string[n]
        const ch = target.charAt(resolved + i);
        s += ch === " " ? " " : INTEL_GLYPHS.charAt((Math.random() * INTEL_GLYPHS.length) | 0);
      }
      setShown(s);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [target]);

  // Cast to React.ElementType so createElement can accept any intrinsic tag at
  // runtime while TypeScript uses the most permissive createElement overload.
  const Tag = As as React.ElementType;
  return <Tag className={`cx-intel-decrypt ${className}`} aria-label={target}>{shown || " "}</Tag>;
}

// ── Signal-strength meter ────────────────────────────────────────────────────
// value: 0-100. Five bars, lit count ∝ value, glow on the lit ones.
export interface IntelBarsProps {
  value: unknown;
  label?: string;
  className?: string;
}

export function IntelBars({ value, label, className = "" }: IntelBarsProps): React.ReactElement {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const lit = Math.max(1, Math.round((v / 100) * 5));
  const g = intelGrade(v);
  return (
    <span className={`cx-intel-bars is-${g.key} ${className}`}
          role="img" aria-label={`${label || "signal"} ${v}/100 — ${g.label}`}
          title={`${label || "resonance"} · ${v}/100 · ${g.label}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <i key={i} className={i <= lit ? "is-lit" : ""} style={{ height: `${3 + i * 2}px` }} />
      ))}
      <b className="cx-intel-bars-grade">{g.label}</b>
    </span>
  );
}

// ── Classification banner ────────────────────────────────────────────────────
// The honest strip: names the console + scope, and ALWAYS carries the
// survey-not-prediction caveat so the scary aesthetic stays truthful.
export interface IntelBannerProps {
  console?: string;
  scope?: string;
  note?: string;
  className?: string;
}

export function IntelBanner({ console: consoleName, scope, note, className = "" }: IntelBannerProps): React.ReactElement {
  return (
    <div className={`cx-intel-banner ${className}`} role="note">
      <span className="cx-intel-banner-sig">CODEX//{consoleName}{scope ? `//${scope}` : ""}</span>
      <span className="cx-intel-banner-note">{note || "OPEN RECORD · FREELY GIVEN · SCHOLARLY SURVEY, NOT PREDICTION"}</span>
    </div>
  );
}

// ── Cycling intel ticker ─────────────────────────────────────────────────────
// items: array of strings (or {text} objects). One line, rotates.
export interface IntelTickerProps {
  items: unknown;
  interval?: number;
  className?: string;
}

function tickerText(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && "text" in x) {
    const t = (x as { text?: unknown }).text;
    return typeof t === "string" ? t : "";
  }
  return "";
}

export function IntelTicker({ items, interval = 3500, className = "" }: IntelTickerProps): React.ReactElement | null {
  const list = (Array.isArray(items) ? (items as unknown[]) : [])
    .map(tickerText)
    .filter(Boolean);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (list.length < 2 || intelReducedMotion()) return;
    const t = setInterval(() => setIdx(i => (i + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list.length, interval]);
  if (!list.length) return null;
  // noUncheckedIndexedAccess: guard array lookup even though bounds are known
  const current = list[idx % list.length] ?? "";
  return (
    <div className={`cx-intel-ticker ${className}`} aria-live="off">
      <span className="cx-intel-ticker-dot" aria-hidden="true" />
      <span className="cx-intel-ticker-line" key={idx}>{current}</span>
      {list.length > 1 ? <span className="cx-intel-ticker-n">{(idx % list.length) + 1}/{list.length}</span> : null}
    </div>
  );
}

// ── ID stamp chip ────────────────────────────────────────────────────────────
export interface IntelStampProps {
  code: React.ReactNode;
  tone?: string;
  className?: string;
}

export function IntelStamp({ code, tone = "accent", className = "" }: IntelStampProps): React.ReactElement {
  return <span className={`cx-intel-stamp is-${tone} ${className}`}>{code}</span>;
}
