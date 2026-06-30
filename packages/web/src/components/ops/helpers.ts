// ops — pure helpers (migrated from ops.jsx). These are the only pieces of
// logic that are truly pure (no side-effects, no DOM, no window reads):
//   · parseArtifactBody — the ref-chip regex from ArtifactBodyLegacy's useMemo
//   · artifactToMarkdown — the markdown serialiser from copyArtifact
// Extracted so they can be unit-tested in isolation.
import type { OpsArtifact } from "./ops-window.js";

export interface ArtifactBodyPart {
  t: "text" | "ref";
  v: string;
}

/**
 * Parse an artifact body string into alternating text and scripture-ref segments.
 * Migrated verbatim from the useMemo inside ArtifactBodyLegacy in ops.jsx.
 */
export function parseArtifactBody(body: string): ArtifactBodyPart[] {
  const re = /\b((?:[1-3]\s+)?[A-Z][a-z]+(?:\s+of\s+[A-Z][a-z]+)?)\s+(\d+):(\d+(?:[-–]\d+)?)\b/g;
  const out: ArtifactBodyPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const s = String(body || "");
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    out.push({ t: "ref", v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

/**
 * Serialise an OPS artifact to a markdown string.
 * Migrated verbatim from copyArtifact in ops.jsx.
 */
export function artifactToMarkdown(a: OpsArtifact, intent: string): string {
  return [
    `# ${a.title || intent}`,
    "",
    a.summary,
    "",
    ...(a.sections ?? []).map((s) => `## ${s.heading}\n\n${s.body}`),
  ].join("\n");
}
