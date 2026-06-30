// marketplace — inline style definitions (migrated verbatim from marketplace.jsx).
// All marketplace styling is inline via the S object; the cx-mkt-* CSS class names
// are applied for progressive enhancement only and are NOT injected here (no CSS
// injection — the legacy never injected a <style> tag).
import type React from "react";

type CSSProp = React.CSSProperties;

export const S: {
  root: CSSProp;
  h1: CSSProp;
  h2: CSSProp;
  blurb: CSSProp;
  rule: CSSProp;
  chipRow: CSSProp;
  chip: (active: boolean) => CSSProp;
  grid2: CSSProp;
  card: CSSProp;
  row: CSSProp;
  badge: (kind: string) => CSSProp;
  pill: CSSProp;
  pillGhost: CSSProp;
  pillDanger: CSSProp;
  name: CSSProp;
  desc: CSSProp;
  meta: CSSProp;
  input: CSSProp;
  drop: (hot: boolean) => CSSProp;
  detailPre: CSSProp;
  backBtn: CSSProp;
  msg: (kind: string) => CSSProp;
} = {
  root: {
    padding: 14,
    color: "var(--cx-fg, #e8f6ff)",
    fontFamily: "var(--cx-font-sans, 'Inter Tight', system-ui, sans-serif)",
    fontSize: 13,
    lineHeight: 1.5,
  },
  h1: {
    margin: "0 0 4px 0",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    fontSize: 12,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--cx-accent, #7ee0ff)",
  },
  h2: {
    margin: "20px 0 8px 0",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--cx-accent, #7ee0ff)",
    opacity: 0.85,
  },
  blurb: { opacity: 0.7, margin: "0 0 12px 0" },
  rule: {
    height: 1,
    background: "linear-gradient(to right, transparent, var(--cx-rule, rgba(126,224,255,0.18)), transparent)",
    margin: "12px 0",
  },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 12px 0" },
  chip: (active: boolean): CSSProp => ({
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 10.5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    border: "1px solid " + (active
      ? "var(--cx-accent, #7ee0ff)"
      : "var(--cx-rule, rgba(126,224,255,0.18))"),
    background: active
      ? "color-mix(in oklab, var(--cx-accent, #7ee0ff) 18%, transparent)"
      : "transparent",
    color: active ? "var(--cx-accent, #7ee0ff)" : "inherit",
  }),
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 10,
  },
  card: {
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.16))",
    borderRadius: 8,
    padding: 12,
    background: "color-mix(in oklab, var(--cx-accent, #7ee0ff) 4%, transparent)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "pointer",
    transition: "border-color 120ms ease, transform 120ms ease",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
    borderRadius: 6,
    marginBottom: 6,
    fontSize: 12.5,
  },
  badge: (kind: string): CSSProp => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 9.5,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    color: kind === "soon" ? "var(--cx-accent-2, #ffc46b)" : "var(--cx-accent, #7ee0ff)",
    background: kind === "soon"
      ? "color-mix(in oklab, var(--cx-accent-2, #ffc46b) 15%, transparent)"
      : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 14%, transparent)",
    border: "1px solid " + (kind === "soon"
      ? "color-mix(in oklab, var(--cx-accent-2, #ffc46b) 45%, transparent)"
      : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 40%, transparent)"),
  }),
  pill: {
    background: "var(--cx-accent, #7ee0ff)",
    color: "#001218",
    border: "none",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    fontWeight: 600,
    cursor: "pointer",
  },
  pillGhost: {
    background: "transparent",
    color: "var(--cx-accent, #7ee0ff)",
    border: "1px solid var(--cx-accent, #7ee0ff)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    cursor: "pointer",
  },
  pillDanger: {
    background: "transparent",
    color: "var(--cx-accent-warn, #ff7a7a)",
    border: "1px solid color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 50%, transparent)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 10.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    cursor: "pointer",
  },
  name: {
    fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)",
    fontSize: 18,
    lineHeight: 1.15,
    margin: 0,
  },
  desc: {
    fontFamily: "var(--cx-font-serif, 'Cormorant Garamond', serif)",
    fontSize: 14,
    lineHeight: 1.4,
    margin: 0,
    opacity: 0.85,
  },
  meta: { fontSize: 10.5, opacity: 0.65, letterSpacing: "0.04em" },
  input: {
    width: "100%",
    padding: "8px 10px",
    background: "transparent",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.2))",
    borderRadius: 6,
    color: "inherit",
    fontFamily: "inherit",
    fontSize: 12,
    boxSizing: "border-box",
  },
  drop: (hot: boolean): CSSProp => ({
    marginTop: 8,
    padding: "18px 14px",
    border: "1px dashed " + (hot
      ? "var(--cx-accent, #7ee0ff)"
      : "var(--cx-rule, rgba(126,224,255,0.25))"),
    borderRadius: 8,
    textAlign: "center",
    opacity: hot ? 1 : 0.85,
    fontSize: 12,
    cursor: "pointer",
    background: hot
      ? "color-mix(in oklab, var(--cx-accent, #7ee0ff) 8%, transparent)"
      : "transparent",
  }),
  detailPre: {
    maxHeight: 240,
    overflow: "auto",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    fontSize: 11,
    padding: 10,
    background: "color-mix(in oklab, var(--cx-accent, #7ee0ff) 3%, transparent)",
    border: "1px solid var(--cx-rule, rgba(126,224,255,0.12))",
    borderRadius: 6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  backBtn: {
    background: "transparent",
    color: "var(--cx-accent, #7ee0ff)",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--cx-font-mono, 'JetBrains Mono', monospace)",
    fontSize: 11,
    letterSpacing: "0.1em",
    padding: 0,
    marginBottom: 8,
  },
  msg: (kind: string): CSSProp => ({
    marginTop: 8,
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 11.5,
    border: "1px solid " + (kind === "err"
      ? "color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 50%, transparent)"
      : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 40%, transparent)"),
    background: kind === "err"
      ? "color-mix(in oklab, var(--cx-accent-warn, #ff7a7a) 10%, transparent)"
      : "color-mix(in oklab, var(--cx-accent, #7ee0ff) 8%, transparent)",
    color: kind === "err" ? "var(--cx-accent-warn, #ff7a7a)" : "inherit",
  }),
};
