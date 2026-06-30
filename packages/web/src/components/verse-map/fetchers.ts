// verse-map — real dependency implementations (Backlog 4.1, sub-slice 15).
//
// The integration boundary: these adapters read the window globals the legacy
// used (CODEX_INTEL, /api/chat, codexGoto, CODEX_AI_BUSY) and the migrated pure
// modules, and assemble the VerseMapDeps that VerseMap injects into MapBody. The
// AI prompts are ported verbatim from verse-map.jsx.
import { mapResolveBook, osisDisplay } from "./osis.js";
import { BIBLE_SITES } from "./sites.js";
import type { VerseMapDeps, ChatResponse } from "./deps.js";
import type { YearContext } from "./PolityTimeline.js";
import type { EmpirePolygon } from "./LeafletField.js";
import type { WikiInfo, PoiRefs, Poi } from "./PoiDossier.js";

interface IntelWindow {
  CODEX_INTEL?: {
    intelAI(opts: { system: string; user: string; maxTokens?: number }): Promise<Record<string, unknown>>;
    intelFmtYear(y: number): string;
    intelParseJSON(s: string): unknown;
  };
  codexGoto?: (book: string, ch: number, v: number) => void;
  codexJumpToRef?: (ref: string) => void;
  CODEX_AI_BUSY?: { begin(label: string): unknown; end(id: unknown): void };
}
function w(): IntelWindow {
  return window as unknown as IntelWindow;
}

export const MAP_PROMPT = `You are CODEX MAP — a scholarly cartographer for biblical passages. Given a verse reference and its text, identify the PRIMARY geographic and historical setting and return a single JSON object. No prose, no fences, only the JSON.`;

export const TOURIST_PROMPT = `You are CODEX TOURIST — a scholarly biblical-history guide. Given a user's current GPS coordinates, list places of biblical/sacred-text/historical importance within 50 km, ranked by significance. Return a single JSON object. No prose, no fences.`;

export const YEAR_CTX_PROMPT = `You are CODEX CHRONO. Given a location centroid and a year, return a single JSON object describing the political/religious situation at that exact year and 3 contemporary nearby events. No prose, no fences.

Schema:
{ "headline": "Babylonian siege under Nebuchadnezzar", "events": ["Temple destroyed", "Lamentations being composed", "Jeremiah in Egypt"] }

Rules: brief, factual, present-tense fragments. Return ONLY the JSON.`;

export const EMPIRE_PROMPT = `You are CODEX EMPIRE. Given a location and a year, return the major empire/polity controlling that area as a rough polygon (8-14 lat,lng vertices). JSON only, no fences.

Schema:
{ "name": "Neo-Assyrian Empire", "note": "Sargonid dynasty at peak extent", "coords": [[lat,lng],[lat,lng],...] }
Rules: coords must be real-world plausible. Return ONLY the JSON.`;

export const POI_REFS_PROMPT = `You are CODEX GAZETTEER. Given a place name from biblical geography, return a single JSON object: {"refs":["gen.11.31","neh.9.7"]} — 2 to 5 OSIS-style verse references (lowercase book.chapter.verse) where this place appears or is most directly relevant in the Protestant canon. If the place never appears in scripture, return {"refs":[]}. JSON only, no prose, no fences.`;

// ── AI-busy beacon (window.CODEX_AI_BUSY) ───────────────────────────────
const mapBusyIds = new Map<string, unknown>();
export function mapAiBusy(on: boolean, source: string): void {
  try {
    const bus = w().CODEX_AI_BUSY;
    if (!bus || typeof bus.begin !== "function" || typeof bus.end !== "function") return;
    if (on) {
      if (mapBusyIds.has(source)) return;
      mapBusyIds.set(source, bus.begin("MAP · " + (source || "intel")));
    } else {
      const id = mapBusyIds.get(source);
      if (id != null) {
        bus.end(id);
        mapBusyIds.delete(source);
      }
    }
  } catch {
    /* best-effort */
  }
}

function fmtYear(y: number): string {
  const intel = w().CODEX_INTEL;
  if (intel && typeof intel.intelFmtYear === "function") return intel.intelFmtYear(y);
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

// Tolerant parse: prefer the shared intel parser, else strip fences + first brace.
function parseJSON(s: string): unknown {
  const intel = w().CODEX_INTEL;
  if (intel && typeof intel.intelParseJSON === "function") return intel.intelParseJSON(s);
  const cleaned = String(s || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = cleaned.indexOf("{");
  if (i === -1) throw new Error("no json");
  return JSON.parse(cleaned.slice(i));
}

async function chat(body: unknown): Promise<ChatResponse> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()) as ChatResponse;
}

async function fetchYearContext(year: number): Promise<YearContext> {
  const decade = Math.round(year / 10) * 10;
  const k = `codex.yrctx.${decade}`;
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as YearContext;
  } catch {
    /* ignore */
  }
  const body = await chat({
    model: "claude-haiku-4-5-20251001",
    system: YEAR_CTX_PROMPT,
    messages: [{ role: "user", content: `Year: ${year} (${year < 0 ? Math.abs(year) + " BCE" : year + " CE"}). Return JSON.` }],
    max_tokens: 220,
  });
  const obj = parseJSON(String(body.text || "")) as YearContext;
  try {
    localStorage.setItem(k, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
  return obj;
}

async function fetchEmpirePolygon(lat: number, lng: number, year: number): Promise<EmpirePolygon | null> {
  const k = `codex.empire.${lat.toFixed(0)},${lng.toFixed(0)},${Math.round(year / 50) * 50}`;
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw) as EmpirePolygon;
  } catch {
    /* ignore */
  }
  try {
    const body = await chat({
      model: "claude-haiku-4-5-20251001",
      system: EMPIRE_PROMPT,
      messages: [{ role: "user", content: `Location: lat ${lat.toFixed(2)}, lng ${lng.toFixed(2)}. Year: ${year}. Return JSON polygon.` }],
      max_tokens: 600,
    });
    const obj = parseJSON(String(body.text || "")) as EmpirePolygon;
    try {
      localStorage.setItem(k, JSON.stringify(obj));
    } catch {
      /* ignore */
    }
    return obj;
  } catch {
    return null;
  }
}

const poiCache = new Map<string, WikiInfo>();
async function resolvePoiWiki(p: Poi): Promise<WikiInfo> {
  const cacheKey = `${p.wiki || ""}|${p.name || ""}`;
  const hit = poiCache.get(cacheKey);
  if (hit) return hit;
  const candidates: string[] = [];
  if (p.wiki) candidates.push(p.wiki.replace(/ /g, "_"));
  if (p.name) candidates.push(p.name.replace(/ /g, "_"));
  if (p.name) {
    const stripped = p.name.replace(/\(.*?\)/g, "").trim().replace(/^Mt\.?\s+/i, "Mount ").replace(/ /g, "_");
    if (stripped && !candidates.includes(stripped)) candidates.push(stripped);
  }
  let summary = "";
  let thumbUrl: string | null = null;
  let pageUrl: string | null = null;
  for (const slug of candidates) {
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      const tu = j.thumbnail?.source || j.originalimage?.source;
      const sm = (j.extract || "").trim();
      if (!summary && sm) summary = sm;
      if (!thumbUrl && tu) thumbUrl = tu;
      if (!pageUrl) pageUrl = j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
      if (thumbUrl && summary) break;
    } catch {
      /* try next */
    }
  }
  if (!thumbUrl && p.name) {
    try {
      const q = encodeURIComponent(p.name);
      const r = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&format=json&origin=*`,
        { headers: { Accept: "application/json" } },
      );
      if (r.ok) {
        const j = (await r.json()) as { query?: { search?: Array<{ title?: string }> } };
        const first = j?.query?.search?.[0]?.title;
        if (first) {
          const file = first.replace(/^File:/, "");
          thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;
        }
      }
    } catch {
      /* ignore */
    }
  }
  const out: WikiInfo = { summary, thumbUrl, pageUrl };
  poiCache.set(cacheKey, out);
  return out;
}

async function resolvePoiRefs(poi: Poi): Promise<PoiRefs> {
  const name = String(poi?.name || "").trim();
  if (!name) return { refs: [], src: "none" };
  const ck = "codex.poirefs." + name.toLowerCase();
  try {
    const raw = localStorage.getItem(ck);
    if (raw) return { refs: JSON.parse(raw) as string[], src: "cache" };
  } catch {
    /* ignore */
  }
  const lower = name.toLowerCase();
  const atlas = BIBLE_SITES.find(
    (s) => s.name.toLowerCase() === lower || lower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(lower),
  );
  if (atlas && Array.isArray(atlas.refs) && atlas.refs.length) {
    try {
      localStorage.setItem(ck, JSON.stringify(atlas.refs));
    } catch {
      /* ignore */
    }
    return { refs: atlas.refs, src: "atlas" };
  }
  const intel = w().CODEX_INTEL;
  if (!intel || typeof intel.intelAI !== "function") return { refs: [], src: "offline" };
  mapAiBusy(true, "gazetteer");
  try {
    const obj = await intel.intelAI({
      system: POI_REFS_PROMPT,
      user: `Place: ${name} (${poi?.kind || "place"}). Return the JSON object.`,
      maxTokens: 220,
    });
    const rawRefs = (obj as { refs?: unknown }).refs;
    const refs = Array.isArray(rawRefs) ? rawRefs.slice(0, 5).filter((r): r is string => typeof r === "string") : [];
    try {
      localStorage.setItem(ck, JSON.stringify(refs));
    } catch {
      /* ignore */
    }
    return { refs, src: "ai" };
  } catch {
    return { refs: [], src: "offline" };
  } finally {
    mapAiBusy(false, "gazetteer");
  }
}

function gotoOsis(osis: string): void {
  const parts = (String(osis || "").split("-")[0] ?? "").split(".");
  const b = mapResolveBook(parts[0] ?? "");
  if (b && typeof w().codexGoto === "function") {
    w().codexGoto?.(b.id, parseInt(parts[1] ?? "", 10) || 1, parseInt(parts[2] ?? "", 10) || 1);
    return;
  }
  if (typeof w().codexJumpToRef === "function") w().codexJumpToRef?.(osisDisplay(osis));
}

/** Resolve the AI map dossier for a verse (CODEX_INTEL.intelAI + MAP_PROMPT). */
export async function fetchMapData(refStr: string, verseText: string): Promise<Record<string, unknown>> {
  const intel = w().CODEX_INTEL;
  if (!intel || typeof intel.intelAI !== "function") throw new Error("CODEX_INTEL unavailable");
  return intel.intelAI({
    system: MAP_PROMPT,
    user: `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
    maxTokens: 2400,
  });
}

export function createVerseMapDeps(): VerseMapDeps {
  return {
    fmtYear,
    chat,
    touristPrompt: TOURIST_PROMPT,
    fetchYearContext,
    fetchEmpirePolygon,
    resolvePoiWiki,
    resolvePoiRefs,
    gotoOsis,
  };
}
