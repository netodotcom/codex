// vox — inline style objects (migrated verbatim from vox.jsx). VOX ships no
// self-injected CSS: every rule is an inline React style object, kept here so the
// panel, panes and slider share one source. Typed as React.CSSProperties so the
// literal values (textTransform, whiteSpace, …) keep their exact meaning.
import type React from "react";

// ── Tradition badge colours ────────────────────────────────────────────────
const BADGE_COLORS = {
  christian:  { bg: "#3a2d10", fg: "#ffd47a", line: "#a07d2c" },
  catholic:   { bg: "#3a1414", fg: "#ffa0a0", line: "#a04848" },
  orthodox:   { bg: "#10203a", fg: "#a0c8ff", line: "#3060a0" },
  jewish:     { bg: "#102438", fg: "#9bd0ff", line: "#3a78b0" },
  messianic:  { bg: "#142a2a", fg: "#9be0d4", line: "#3a8878" },
  muslim:     { bg: "#0f2a18", fg: "#a0e6b4", line: "#3a8858" },
  sufi:       { bg: "#2a160f", fg: "#ffc8a0", line: "#a0683a" },
  gnostic:    { bg: "#231038", fg: "#d0a8ff", line: "#7048a0" },
  hermetic:   { bg: "#1f1038", fg: "#c0a0ff", line: "#6048a0" },
  quaker:     { bg: "#1c1f22", fg: "#c8cdd2", line: "#6a7480" },
  newage:     { bg: "#102a2a", fg: "#a0e8ff", line: "#3a8888" },
  interfaith: { bg: "#241d10", fg: "#dccc9e", line: "#7a6940" },
};
export function badgeStyle(badge: string | undefined): React.CSSProperties {
  const c = BADGE_COLORS[badge as keyof typeof BADGE_COLORS] || BADGE_COLORS.interfaith;
  return {
    background: c.bg, color: c.fg, border: "1px solid " + c.line,
    padding: "2px 8px", fontSize: "10px", letterSpacing: "0.12em",
    borderRadius: "10px", fontWeight: 600, textTransform: "uppercase",
    display: "inline-block",
  };
}

// ── Panel / section chrome ─────────────────────────────────────────────────
export const panelStyle: React.CSSProperties = {
  fontFamily: "Inter Tight, system-ui, sans-serif",
  color: "#c9d4dc",
  background: "#0a0f17",
  minHeight: "100%",
};
export const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.18em", color: "var(--cx-fg-dim, #8295ae)",
  textTransform: "uppercase", marginBottom: 6,
  display: "flex", alignItems: "center", gap: 8,
};
export const naturalBadge: React.CSSProperties = {
  color: "#7ee0ff", fontSize: 9, letterSpacing: "0.18em",
  border: "1px solid #2a4a60", padding: "1px 6px", borderRadius: 6,
};
export const ctxStripStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "8px 10px", marginBottom: 14,
  background: "#0e1320", border: "1px solid #232d3a", borderRadius: 6,
  fontSize: 12,
};
export const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "#0a0f17", color: "#d8e0e8",
  border: "1px solid #2a3340", borderRadius: 6,
  fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 12,
};
export const btnPrimary: React.CSSProperties = {
  padding: "12px 18px", minHeight: 44,
  background: "linear-gradient(180deg, #1a3548, #0e2030)",
  color: "#7ee0ff",
  border: "1px solid #3a6080",
  borderRadius: 8, cursor: "pointer", fontWeight: 700,
  letterSpacing: "0.15em", fontSize: 12,
  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
};
export const btnSecondary: React.CSSProperties = {
  padding: "10px 14px", minHeight: 40,
  background: "#13202e", color: "#c9d4dc",
  border: "1px solid #2a3340",
  borderRadius: 8, cursor: "pointer",
  letterSpacing: "0.12em", fontSize: 11,
  fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
};
export const nowSpeakingStyle: React.CSSProperties = {
  padding: "8px 10px", background: "#10202e",
  border: "1px solid #2a4a60", borderRadius: 6,
  fontSize: 12, color: "#c9d4dc", marginTop: 6,
};
export const cardsGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 10,
};
export const cardStyle: React.CSSProperties = {
  textAlign: "left", padding: 12,
  background: "#0e1320", border: "1px solid #232d3a",
  borderRadius: 8, cursor: "pointer", color: "#c9d4dc",
  fontFamily: "Inter Tight, system-ui, sans-serif",
};
export const cardTitleStyle: React.CSSProperties = {
  fontFamily: "Cormorant Garamond, Georgia, serif",
  fontSize: 18, color: "#e8ecf2", lineHeight: 1.15,
};
export const cardTraditionStyle: React.CSSProperties = {
  fontSize: 11, color: "#8b96a2", letterSpacing: "0.08em",
  marginBottom: 6, textTransform: "uppercase",
};
export const cardSummaryStyle: React.CSSProperties = {
  fontSize: 12, color: "#a4afba", lineHeight: 1.5,
};
export const prayerBodyStyle: React.CSSProperties = {
  marginTop: 8,
};
export const sectionStyle: React.CSSProperties = {
  padding: "10px 12px", marginBottom: 8,
  background: "#0e1320", border: "1px solid #1f2a36",
  borderRadius: 6,
  transition: "background 320ms ease, border-color 320ms ease",
};
export const activeSectionStyle: React.CSSProperties = {
  background: "#15263a", borderColor: "#3a6080",
  boxShadow: "0 0 0 1px rgba(126,224,255,0.15)",
};
export const silenceSectionStyle: React.CSSProperties = {
  background: "#0a0f17", borderStyle: "dashed",
  color: "#8b96a2", fontStyle: "italic",
};
export const sectionTagStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase",
  color: "var(--cx-fg-dim, #8295ae)", marginBottom: 4,
};
export function sectionTextStyle(langDefault: string | undefined): React.CSSProperties {
  const isHeb = langDefault === "he";
  return {
    fontFamily: isHeb
      ? "Cardo, 'Times New Roman', serif"
      : "Cormorant Garamond, Georgia, serif",
    fontSize: 17, lineHeight: 1.55, color: "#e0e6ec",
  };
}
export const silenceDurStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--cx-fg-dim, #8295ae)", marginTop: 4,
  fontFamily: "ui-monospace, monospace",
};
