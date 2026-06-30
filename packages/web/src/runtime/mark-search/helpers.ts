// mark-search — pure logic (faithful port from legacy/mark-search.js).
// Same caching, signature, preview, and ranking behaviour as the v1 IIFE.
import type { Mark, RankResult, CacheEntry, CacheStore } from "./types.js";

export const CACHE_KEY = "codex.marksearch.v1";
export const CACHE_MAX = 50;

export function readCache(): CacheStore {
  try {
    // NOTE: preserved from legacy — double coalesce handles JSON.parse returning null.
    return (JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheStore | null) ?? {};
  } catch {
    return {};
  }
}

export function writeCache(cache: CacheStore): void {
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) {
    // NOTE: preserved from legacy — entries without ts are treated as oldest (ts=0).
    const sorted = keys
      .map((k): [string, number] => [k, cache[k]?.ts ?? 0])
      .sort((a, b) => a[1] - b[1]);
    const drop = sorted.slice(0, sorted.length - CACHE_MAX);
    for (const [k] of drop) delete cache[k];
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

export function clearCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export function sigFor(query: string, marks: Mark[]): string {
  const norm = (query || "").trim().toLowerCase();
  // NOTE: preserved from legacy — fingerprint uses sorted keys + total count (marks.length),
  // not re-derived key count; cheap enough for LRU purposes.
  const keys = marks.map(m => m.key).sort().join(",");
  return `${norm}||${marks.length}||${keys}`;
}

export function previewMark(m: Mark, i: number): string {
  // NOTE: preserved from legacy — ref/color fall back to "?" even though Mark types them
  // as required strings, guarding against runtime garbage from the app layer.
  const ref  = m.ref   || "?";
  const col  = m.color || "?";
  const note = m.note ? ` · note:"${String(m.note).slice(0, 90)}"` : "";
  const text = m.text ? ` · text:"${String(m.text).slice(0, 110)}"` : "";
  return `${i + 1}. [${m.key}] ${ref} · ${col}${note}${text}`;
}

export async function rank(query: string, marks: Mark[], context?: string): Promise<RankResult[]> {
  const q = (query || "").trim();
  if (!q || !Array.isArray(marks) || marks.length === 0) return [];

  const sig = sigFor(q, marks);
  const cache = readCache();
  const hit = cache[sig];
  if (hit !== undefined && Array.isArray(hit.results)) {
    // NOTE: preserved from legacy — refresh ts on cache hit so entry survives LRU eviction.
    cache[sig] = { ...hit, ts: Date.now() };
    writeCache(cache);
    return hit.results;
  }

  const list = marks.map(previewMark).join("\n");
  const system = [
    "You are CODEX · mark-search ranker.",
    "Given a user query and their saved scripture marks, return an ordered JSON array",
    "of the most semantically relevant marks. Match on biblical themes, motifs,",
    "characters, doctrines, emotional resonance — NOT just literal substrings.",
    "If the query echoes a passage you can identify, prioritise marks on or near it.",
    "If the user's current passage is provided, give a small tie-breaker boost to",
    "marks that cross-resonate with where they're reading.",
    "Return AT MOST 12 results. If nothing meaningfully matches, return [].",
    "Output ONLY the JSON array, no preface, no fences. Schema:",
    `[{"key":"<mark-key>","reason":"<≤14-word reason>"}]`,
  ].join("\n");

  const user = [
    `Query: "${q}"`,
    context ? `Current passage: ${context}` : "Current passage: (none)",
    "",
    `Marks (${marks.length}):`,
    list,
    "",
    "Return ranked JSON.",
  ].join("\n");

  let results: RankResult[] = [];
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: 600,
      }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json() as { text?: unknown };
    const txt = String(data.text ?? "").trim();
    // NOTE: preserved from legacy — tolerate accidental code fences / leading prose.
    const rawJson = txt.match(/\[[\s\S]*\]/)?.[0];
    if (!rawJson) return [];
    const parsed: unknown = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const validKeys = new Set(marks.map(x => x.key));
    results = (parsed as unknown[])
      .filter((x): x is { key: string; reason: unknown } =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as { key?: unknown }).key === "string" &&
        validKeys.has((x as { key: string }).key)
      )
      .slice(0, 12)
      .map(x => ({ key: x.key, reason: String(x.reason ?? "").slice(0, 140) }));
  } catch (e) {
    console.warn("MarkSearch.rank failed:", e);
    return [];
  }

  cache[sig] = { ts: Date.now(), results };
  writeCache(cache);
  return results;
}
