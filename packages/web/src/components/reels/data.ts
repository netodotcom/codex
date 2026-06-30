// reels — deck management (faithfully ported from the legacy IIFE in
// reels.jsx). Module-scope State singleton, curated-card loader, deck filler,
// seen-card tracker, and the depth-action emitter. All logic is the exact
// same as the legacy; TypeScript types and strict-mode guards added.
import { rw } from "./reels-window.js";
import type { ReelCard, NavCtx, ReaderProfile } from "./reels-window.js";

export type { ReelCard, NavCtx };

export const DECK_KEY = "codex.reels.deck.v1";
export const SEEN_KEY = "codex.reels.seen.v1";

// Rotation order — interleaves card kinds so the feed feels alive.
export const TYPE_ORDER = [
  "light-verse", "symbol", "name-of-god", "did-you-know",
  "art-verse", "parable-3", "prophecy-pair", "counting",
  "question", "quest-tease",
] as const;

// In-memory deck state — survives navigation but rebuilt on cold start.
export interface DeckState {
  curated: ReelCard[] | null;
  deck: ReelCard[];
  seen: Set<string> | null;
  busy: boolean;
  listeners: Set<() => void>;
}

export const State: DeckState = {
  curated: null,
  deck: [],
  seen: null,
  busy: false,
  listeners: new Set(),
};

export function bumpListeners(): void {
  State.listeners.forEach((fn) => { try { fn(); } catch {} });
}

// Depth-action emitter — fires ONLY on genuine depth actions (open passage,
// quest-tease tap, a question resolved), NEVER on mere scrolling/viewing a
// reel (no-doom-loop rule). Guarded so nothing breaks when the engagement
// engine is absent / in Lite mode. The engine listens on the
// codex:depth-action bus event and records it (bumps mastery + continuity).
export function emitDepth(
  type: string,
  ref: string | null | undefined,
  weight: number,
  domain: string | null,
): void {
  try {
    const eng = rw().CODEX_ENGAGEMENT;
    if (eng && typeof eng.emit === "function") {
      eng.emit(type, ref ?? undefined, weight, domain);
      return;
    }
  } catch {}
  // Fallback: dispatch the bus event directly (the engine still listens),
  // so an emit() that is missing/throwing never silently drops the signal.
  try {
    window.dispatchEvent(new CustomEvent("codex:depth-action", {
      detail: { type, ref: ref ?? null, weight, domain: domain ?? null },
    }));
  } catch {}
}

export function loadSeen(): Set<string> {
  if (State.seen) return State.seen;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    State.seen = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { State.seen = new Set(); }
  return State.seen;
}

export function markSeen(card: ReelCard): void {
  const s = loadSeen();
  s.add(cardKey(card));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-2000))); } catch {}
}

export function cardKey(c: ReelCard): string {
  return `${c.type}:${c.id || (c.anchor || "x") + ":" + (c.title || "").slice(0, 32)}`;
}

export async function loadCurated(): Promise<ReelCard[]> {
  if (State.curated) return State.curated;
  try {
    const modules = rw().CODEX_MODULES;
    if (modules) {
      const mod = await modules.loadModule("reels-curated");
      State.curated = mod.cards ?? [];
    } else {
      const r = await fetch("data/modules/reels-curated.json");
      const j = (await r.json()) as { cards?: ReelCard[] };
      State.curated = j.cards ?? [];
    }
  } catch (e) {
    console.warn("[reels] could not load curated deck:", e);
    State.curated = [];
  }
  return State.curated;
}

// Pull a fresh card off the wheel. Round-robins through types so the
// user never sees 5 of the same kind in a row.
export function pickCurated(
  typeRotation: string,
  profile: ReaderProfile | null,
): ReelCard | null {
  const seen = loadSeen();
  const curated = State.curated ?? [];
  let pool = curated.filter((c) => !seen.has(cardKey(c)));
  if (!pool.length) {
    // All cards seen — reset the rolling window so the user can re-encounter.
    State.seen = new Set();
    try { localStorage.removeItem(SEEN_KEY); } catch {}
    const ri = Math.floor(Math.random() * curated.length);
    return curated[ri] ?? null;
  }
  // Profile bias: when the reader has favourite books, prefer cards anchored
  // there — but only when that still leaves a healthy pool (keep variety).
  if (profile && profile.topBooks && profile.topBooks.length) {
    const topBooks = profile.topBooks;
    const fav = pool.filter((c) => {
      if (typeof c.anchor !== "string" || c.anchor.indexOf(".") <= 0) return false;
      const parts = c.anchor.split(".");
      const b = parts[0];
      return b != null && topBooks.indexOf(b) >= 0;
    });
    if (fav.length >= 3 && Math.random() < 0.6) pool = fav;
  }
  const byType = pool.filter((c) => c.type === typeRotation);
  const finalPool = byType.length ? byType : pool;
  const fi = Math.floor(Math.random() * finalPool.length);
  return finalPool[fi] ?? null;
}

// Build a card from the current chapter context — uses existing caches
// (verse art, gematria, panels) opportunistically.
export function fromContext(ctx: NavCtx): ReelCard | null {
  if (!ctx || !ctx.bookId || !ctx.chapter) return null;
  try {
    for (let v = 1; v <= 20; v++) {
      const key = `codex.art.${ctx.bookId}.${ctx.chapter}.${v}`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const art = JSON.parse(raw) as {
        works?: Array<{
          commonsFile?: string;
          title?: string;
          artist?: string;
          year?: number;
          medium?: string;
          summary?: string;
        }>;
      };
      const work = (art.works ?? []).find((w) => w.commonsFile);
      if (!work) continue;
      const cardId = `art:${ctx.bookId}.${ctx.chapter}.${v}.${work.title ?? ""}`;
      if (loadSeen().has(`art-verse:${cardId}`)) continue;
      return {
        type: "art-verse",
        id: cardId,
        anchor: `${ctx.bookId}.${ctx.chapter}.${v}`,
        title: work.title,
        artist: work.artist,
        year: work.year,
        medium: work.medium,
        image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(work.commonsFile ?? "")}?width=1200`,
        body: work.summary ?? "",
        hue: "#0a0e16",
      };
    }
  } catch {}
  return null;
}

export async function refillDeck(ctx: NavCtx, targetSize = 30): Promise<void> {
  if (State.busy) return;
  State.busy = true;
  try {
    await loadCurated();
    // Reader taste profile (from likes + highlights + history).
    const engage = rw().CODEX_ENGAGE;
    const profile: ReaderProfile | null =
      engage && typeof engage.buildReaderProfile === "function"
        ? engage.buildReaderProfile()
        : null;
    let i = State.deck.length;
    let attempts = 0;
    while (State.deck.length < targetSize && attempts < 200) {
      const rotIdx = i % TYPE_ORDER.length;
      let typeForSlot: string = TYPE_ORDER[rotIdx] ?? "light-verse";
      if (
        profile && profile.topTypes && profile.topTypes.length &&
        Math.random() < 0.55
      ) {
        const topTypes = profile.topTypes;
        const ti = Math.floor(Math.random() * Math.min(3, topTypes.length));
        typeForSlot = topTypes[ti] ?? typeForSlot;
      }
      let card: ReelCard | null = null;
      if (typeForSlot === "art-verse") {
        card = fromContext(ctx);
      }
      if (!card) card = pickCurated(typeForSlot, profile);
      const theCard = card;
      if (theCard && !State.deck.find((c) => cardKey(c) === cardKey(theCard))) {
        State.deck.push(theCard);
        markSeen(theCard);
        i++;
      }
      attempts++;
    }
    try { localStorage.setItem(DECK_KEY, JSON.stringify(State.deck)); } catch {}
  } finally {
    State.busy = false;
    bumpListeners();
  }
}

export function restoreDeck(): void {
  if (State.deck.length) return;
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (raw) State.deck = (JSON.parse(raw) as ReelCard[]) ?? [];
  } catch {}
}

// Pre-load hook — called when the user navigates. Triggers a refill so
// by the time they open Reels there's a stocked deck.
let preloadDebounce: ReturnType<typeof setTimeout> | undefined;
export function schedulePreload(ctx: NavCtx): void {
  clearTimeout(preloadDebounce);
  preloadDebounce = setTimeout(() => {
    restoreDeck();
    refillDeck(ctx, 30).catch(() => {});
  }, 1200);
}
