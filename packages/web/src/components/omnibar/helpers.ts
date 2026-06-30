// omnibar — logic + row builders (migrated from omnibar.jsx). The "/" catalog,
// learned-usage scoring, the forgiving fuzzy reference parser (Damerau-
// Levenshtein book matching), the guide/fallback/index row sets, and the
// top-level command table. Pure functions are ground-truth tested; the rest
// reach runtime globals only through the typed ow() boundary.
import {
  OMNI_VERBS,
  PANEL_INDEX,
  OMNI_PANEL_DESC,
  OMNI_PANEL_KEYS,
  OMNI_VERB_DESC,
  OMNI_VERB_KEYS,
  OMNI_CMD_KEYS,
  OMNI_STOP,
  OMNI_FREQ_KEY,
  omniNorm,
  omniWords,
  type OmniRow,
  type CatalogRow,
  type OmniCommand,
} from "./data.js";
import { ow, type KernelRef, type BookEntry } from "./omnibar-window.js";

export function omniParseRef(s: string): KernelRef | null {
  const K = ow().CODEX_KERNEL;
  return K && K.parseRef ? K.parseRef(s) : null;
}

// ── Learned usage — codex.cmd.freq.v1 = { [rowId]: { n, last } }.
export interface FreqEntry {
  n: number;
  last: number;
}
export type FreqMap = Record<string, FreqEntry>;

export function omniFreqLoad(): FreqMap {
  try {
    return (JSON.parse(localStorage.getItem(OMNI_FREQ_KEY) || "{}") || {}) as FreqMap;
  } catch {
    return {};
  }
}
export function omniFreqRecord(id: string): void {
  if (!id) return;
  try {
    const m = omniFreqLoad();
    const e = m[id] || { n: 0, last: 0 };
    e.n += 1;
    e.last = Date.now();
    m[id] = e;
    localStorage.setItem(OMNI_FREQ_KEY, JSON.stringify(m));
  } catch {
    /* private mode etc. — learning is a luxury, never a crash */
  }
}
export function omniFreqScore(map: FreqMap, ids: string[]): number {
  let s = 0;
  (ids || []).forEach((id) => {
    const e = map[id];
    if (!e || !e.n) return;
    const days = Math.max(0, (Date.now() - (e.last || 0)) / 86400000);
    s += e.n * Math.pow(0.97, days);
  });
  return s;
}

// ── Top-level commands ride the same index: consoles the rail doesn't hold.
// Each opens through an existing global/event — no new plumbing invented.
export const OMNI_COMMANDS: OmniCommand[] = [
  {
    id: "constellation", icon: "❂", aliases: ["constellation", "canon", "threads"],
    title: "Open the Constellation", sub: "the whole canon as one body — every cross-reference, live",
    action: () => { const f = ow().codexOpenConstellation; if (f) f(); },
  },
  {
    id: "oracle", icon: "◬", aliases: ["oracle"],
    title: "Open the Oracle", sub: "AI conversation in the left rail",
    action: () => {
      // open-library raises the left rail; the shortcut bus lands on the tab
      window.dispatchEvent(new CustomEvent("codex:open-library"));
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
    },
  },
  {
    id: "ops", icon: "❖", aliases: ["ops"],
    title: "Open OPS — task the kernel", sub: "mission cockpit, blank slate",
    action: () => { const f = ow().codexOpenOps; if (f) f(""); },
  },
  {
    id: "settings", icon: "⚙", aliases: ["settings", "tweaks"],
    title: "Open Settings", sub: "theme, language, API keys, every tweak",
    action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: {} })); },
  },
  // v9 FACE TO FACE — the desk
  {
    id: "focus", icon: "⛶", aliases: ["focus", "zen", "theater", "read"],
    title: "Focus — just the Word", sub: "hide every window but the reader · Esc restores",
    action: () => {
      const desk = ow().codexDesk;
      if (desk && desk.on()) desk.focus();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    },
  },
  {
    id: "library", icon: "☰", aliases: ["library", "books", "lib"],
    title: "Open the Library window", sub: "books, chapters, marks, Oracle — place it anywhere",
    action: () => {
      const desk = ow().codexDesk;
      if (desk && desk.on()) desk.open("library");
      else window.dispatchEvent(new CustomEvent("codex:open-library"));
    },
  },
  {
    // v11 — the study deck is dead; "study/panels" now opens the
    // translations window (each panel is its own window — see PANEL_INDEX
    // rows for the rest).
    id: "study", icon: "Α/Ω", aliases: ["study", "panels", "translations"],
    title: "Open the Translations window", sub: "every panel is its own window now — type a panel name for the rest",
    action: () => {
      const f = ow().codexOpenPanel;
      if (f) f("trans");
    },
  },
  // v11.4 GUIDE MODE — the two doors a lost user reaches for first.
  {
    id: "help", icon: "✶", aliases: ["help", "wiki", "guide", "docs", "manual", "tutorial"],
    title: "Help — how everything works", sub: "the built-in wiki, plain words",
    action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "help" } })); },
  },
  {
    id: "theme", icon: "◐", aliases: ["dark", "light", "theme", "night", "day"],
    title: "Toggle dark / light", sub: "flip the lights",
    action: () => {
      // the ◐ trace button is the canonical toggle; settings → appearance
      // is the honest fallback when the trace isn't mounted (mobile).
      const b = document.querySelector('.cx-trace-btn[aria-label*="theme" i]') as HTMLElement | null;
      if (b) b.click();
      else window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "appearance" } }));
    },
  },
];

// The FULL command catalog for "/" mode: verbs, every rail panel, top-level
// commands, plus the Loom. Each row carries a plain-words sub + a hidden
// haystack; sorted learned-score desc, then alphabetical. `fill` lets verb
// rows put "<verb> " back into the bar instead of closing (row.stay).
export function omniCatalogRows(fill: (s: string) => void): CatalogRow[] {
  const freq = omniFreqLoad();
  const out: CatalogRow[] = [];
  const add = (row: OmniRow, keys?: string, scoreIds?: string[]): void => {
    row.hay = omniWords([row.id, row.title, row.sub, keys || ""].join(" "));
    row.score = omniFreqScore(freq, scoreIds || [row.id]);
    out.push(row as CatalogRow);
  };
  Object.keys(OMNI_VERBS).forEach((k) => {
    const v = OMNI_VERBS[k]!;
    add({
      id: "verb-" + k, icon: v.icon, title: v.label,
      sub: `${OMNI_VERB_DESC[k]} — fills "${k} " so you add the reference`,
      stay: true,
      action: () => fill(k + " "),
    }, OMNI_VERB_KEYS[k], ["verb-" + k, "ref-" + k]);
  });
  PANEL_INDEX.forEach((p) => {
    add({
      id: "panel-" + p.id, icon: p.icon, title: `Open ${p.label} panel`,
      sub: OMNI_PANEL_DESC[p.id] || "in the study rail",
      action: () => omniOpenPanel(p.id),
    }, (OMNI_PANEL_KEYS[p.id] || "") + " " + p.label);
  });
  OMNI_COMMANDS.forEach((c) => {
    add({ id: "cmd-" + c.id, icon: c.icon, title: c.title, sub: c.sub, action: c.action },
      (c.aliases || []).join(" ") + " " + (OMNI_CMD_KEYS[c.id] || ""));
  });
  add({
    id: "loom", icon: "⟐", title: "Weave the session — the Loom",
    sub: "your reading trail becomes one cited study",
    action: () => {
      const f = ow().codexOpenOps;
      if (f) f("Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together.");
    },
  }, "weave loom summarize session trail synthesize study");
  out.sort((a, b) => (b.score - a.score) || String(a.title).localeCompare(String(b.title)));
  return out;
}

// Generous catalog match: every meaningful query word must appear SOMEWHERE
// in a row's haystack (substring, any order). "open the map" → the MAP verb;
// "turn on dark mode" → the theme toggle. Words under 3 chars are noise.
export function omniLooseRows(text: string, catalog: CatalogRow[]): CatalogRow[] {
  const words = omniWords(text).split(" ").filter((w) => w.length >= 3 && !OMNI_STOP.has(w));
  if (!words.length) return [];
  return catalog.filter((r) => words.every((w) => r.hay.indexOf(w) !== -1)).slice(0, 5);
}

// Damerau-Levenshtein, early-exit when a row exceeds `max`.
export function omniEditDist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    const di = d[i]!, dim1 = d[i - 1]!;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(dim1[j]! + 1, di[j - 1]! + 1, dim1[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + cost); // transposition — 'Jhon'
      }
      di[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[m]![n]!;
}

// Matchable spellings for one book: full name, roman→arabic prefix
// ("II Samuel" → "2samuel"), the bare name, and the canonical id. Ids carry
// a half-point penalty: the user typed a WORD, so 'Jhon' must prefer the
// name John (transposition, 1) over Jonah's id 'jon' (deletion, 1 + 0.5).
export function omniBookKeys(b: BookEntry): Array<[string, number]> {
  const out = new Map<string, number>(); // key → penalty
  const add = (s: string, pen: number): void => {
    const k = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
    const prev = out.get(k);
    if (k && (prev === undefined || prev > pen)) out.set(k, pen);
  };
  add(b.name, 0);
  const m = String(b.name).toLowerCase().match(/^(i{1,3})\s+(.+)$/);
  if (m) { add(m[1]!.length + " " + m[2]!, 0); add(m[2]!, 0); }
  add(b.id, 0.5);
  return [...out.entries()]; // [key, penalty]
}

export interface FuzzyRef {
  bookId: string;
  bookName: string;
  chapter: number;
  v1: number | null;
  dist: number;
  refStr: string;
}

// FORGIVING REF — when the kernel's parser shrugs, read the human intent:
//   'Jhon 3 16'    → John 3:16   (typo + space-for-colon)
//   'psalm s23'    → Psalms 23   (stray space)
//   'go to psalms' → Psalms 1    (natural phrase, book only)
// Returns { bookId, bookName, chapter, v1, refStr, dist } or null.
export function omniFuzzyRef(text: string): FuzzyRef | null {
  const books = (ow().CODEX_DATA && ow().CODEX_DATA!.books) || [];
  if (!books.length) return null;
  const s = String(text || "").trim().toLowerCase()
    .replace(/^(go to|goto|go|open|read|show me|show|take me to|to)\s+/, "")
    .replace(/[?!.]+$/, "").trim();
  if (s.length < 3 || s[0] === "/") return null;
  const m = s.match(/^([1-3]?\s*[a-z][a-z\s.'’]*?)[\s.,]*(\d{1,3})(?:\s*[:.,;\s-]\s*(\d{1,3}))?$/);
  const bookTok = m ? m[1]! : s;
  const qKey = bookTok.replace(/[^a-z0-9]+/g, "");
  if (qKey.length < 3) return null;
  let best: BookEntry | null = null, bestD = 3;
  for (let i = 0; i < books.length; i++) {
    const bk = books[i]!;
    const keys = omniBookKeys(bk);
    for (let k = 0; k < keys.length; k++) {
      const [key, pen] = keys[k]!;
      const d = ((qKey.length >= 3 && key.indexOf(qKey) === 0)
        ? 0 : omniEditDist(qKey, key, 2)) + pen;
      if (d < bestD) { bestD = d; best = bk; if (!d) break; }
    }
    if (best && bestD === 0) break; // canon order wins ties
  }
  if (!best) return null;
  // honesty thresholds — short tokens earn less tolerance; a book-only
  // guess (no chapter digits) must be near-certain or it's just noise.
  const okWithCh = bestD === 0 || (bestD <= 1 && qKey.length >= 4) || (bestD <= 2 && qKey.length >= 6);
  const okBookOnly = bestD === 0 || (bestD <= 1 && qKey.length >= 4);
  if (m ? !okWithCh : !okBookOnly) return null;
  const chapter = m ? Math.max(1, Math.min(best.chapters || 1, parseInt(m[2]!, 10) || 1)) : 1;
  const v1 = m && m[3] ? parseInt(m[3], 10) : null;
  return {
    bookId: best.id, bookName: best.name, chapter, v1, dist: bestD,
    refStr: `${best.name} ${chapter}${v1 ? ":" + v1 : ""}`,
  };
}

// EMPTY-STATE TEACHES — living examples that EXECUTE on click, rotated from
// the user's least-used capabilities (codex.cmd.freq.v1, inverse). A fresh
// install sees the five canonical doors in this order.
export function omniGuideRows(fill: (s: string) => void): OmniRow[] {
  const pool: Array<OmniRow & { ids: string[] }> = [
    {
      id: "guide-ref", icon: "→", title: "John 3:16",
      sub: "read a verse — type any reference and the reader goes there",
      ids: ["guide-ref", "ref-go"],
      action: () => { const f = ow().codexJumpToRef; if (f) f("John 3:16"); },
    },
    {
      id: "guide-sword", icon: "⚔", title: "sword John 1:1",
      sub: "the deep dive — four readings of one verse, side by side",
      ids: ["guide-sword", "ref-sword", "verb-sword"],
      action: () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: "sword", ref: "John 1:1" } })); },
    },
    {
      id: "guide-ops", icon: "❖", title: "what do the prophets say about hope?",
      sub: "ask the kernel — it plans, reads, and writes a cited answer",
      ids: ["guide-ops", "ops-free", "verb-ops"],
      action: () => { const f = ow().codexOpenOps; if (f) f("what do the prophets say about hope?"); },
    },
    {
      id: "guide-galaxy", icon: "❂", title: "galaxy",
      sub: "see the whole canon — every cross-reference as one sky of stars",
      ids: ["guide-galaxy", "cmd-constellation"],
      action: () => { const f = ow().codexOpenConstellation; if (f) f(); },
    },
    {
      id: "guide-help", icon: "✶", title: "help",
      sub: "how everything works — the built-in guide, plain words",
      ids: ["guide-help", "cmd-help"],
      action: () => { window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "help" } })); },
    },
    {
      id: "guide-search", icon: "Α", title: "shepherd",
      sub: "search the whole text — hits stream in as you type", stay: true,
      ids: ["guide-search"],
      action: () => { fill("shepherd"); },
    },
    {
      id: "guide-oracle", icon: "◬", title: "oracle",
      sub: "talk with the AI about whatever you're reading",
      ids: ["guide-oracle", "cmd-oracle"],
      action: () => {
        window.dispatchEvent(new CustomEvent("codex:open-library"));
        window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
      },
    },
    {
      id: "guide-loom", icon: "⟐", title: "weave",
      sub: "the Loom — your reading trail becomes one cited study",
      ids: ["guide-loom", "loom"],
      action: () => {
        const f = ow().codexOpenOps;
        if (f) f("Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together.");
      },
    },
  ];
  const freq = omniFreqLoad();
  return pool
    .map((g, i) => ({ ...g, guide: true, _ord: i, _score: omniFreqScore(freq, g.ids) }))
    .sort((a, b) => (a._score - b._score) || (a._ord - b._ord))
    .slice(0, 5);
}

// NEVER A DEAD END — when nothing matches, these three always do.
export function omniFallbackRows(text: string): OmniRow[] {
  return [
    {
      id: "fb-kernel", icon: "❖", title: `ask the kernel: “${text}”`,
      sub: "a mission — it plans, gathers, and writes a cited answer",
      action: () => { const f = ow().codexOpenOps; if (f) f(text); },
    },
    {
      id: "fb-search", icon: "🔍", title: `search the text for “${text}”`,
      sub: "full-text search across the whole canon", stay: true,
      action: null, // bound inside the component — needs setItems
    },
    {
      id: "fb-oracle", icon: "✦", title: "ask the Oracle",
      sub: "open the AI conversation and ask in your own words",
      action: () => {
        window.dispatchEvent(new CustomEvent("codex:open-library"));
        window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
      },
    },
  ];
}

export function omniOpenPanel(id: string): void {
  const w = ow();
  if (w.codexOpenPanel) { w.codexOpenPanel(id); return; }
  if (id.indexOf("plugin:") === 0) {
    // existing door for plugin tabs — app.jsx normalizes + surfaces the rail
    window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { panelId: id } }));
    return;
  }
  // builtin tabs have no open event yet — say so instead of guessing
  window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "panel API not available", kind: "err" } }));
}

// Fuzzy-match the query against panel labels + command aliases.
// strong = label starts with the query (ranks above search hits);
// weak   = label merely contains it (ranks below search hits).
export function omniIndexRows(text: string): { strong: OmniRow[]; weak: OmniRow[] } {
  const nq = omniNorm(text);
  const strong: OmniRow[] = [], weak: OmniRow[] = [];
  if (nq.length < 2) return { strong, weak };
  PANEL_INDEX.forEach((p) => {
    const nl = omniNorm(p.label);
    if (nl.indexOf(nq) === -1) return;
    const row: OmniRow = {
      id: "panel-" + p.id, icon: p.icon, title: `Open ${p.label} panel`,
      sub: "in the study rail",
      action: () => omniOpenPanel(p.id),
    };
    (nl.indexOf(nq) === 0 ? strong : weak).push(row);
  });
  OMNI_COMMANDS.forEach((c) => {
    if (!c.aliases.some((a) => omniNorm(a).indexOf(nq) === 0)) return;
    strong.push({ id: "cmd-" + c.id, icon: c.icon, title: c.title, sub: c.sub, action: c.action });
  });
  return { strong, weak };
}
