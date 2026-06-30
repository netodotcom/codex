// kernel — orchestration logic (faithful port from legacy/kernel.js).
// Tool definitions, registry, ref parsing, mission loop, Strongs lookup —
// all ported with zero behaviour change. Window globals accessed via kw().
import type {
  Book,
  ParsedRef,
  ToolDef,
  ToolSpec,
  Mission,
  MissionStep,
  ArtifactSection,
  KernelRunHandle,
  ChatMessage,
  StrongsEntry,
  StrongsEntries,
  TrailEntry,
  NoteItem,
  TimelineEvent,
} from "./types.js";
import type {
  BibleVerse,
  BibleChapterResult,
  SearchHit,
  CrossRefItem,
  StrongsModuleShape,
  EastonModuleShape,
  TimelineModuleShape,
} from "./kernel-window.js";
import { kw } from "./kernel-window.js";

// ── Ref parsing — "John 1:1-5", "1 Samuel 3", "Rev 13" ─────────────────────

// NOTE: preserved from legacy — var ROMAN kept as const
const ROMAN: Record<string, string> = { "1": "i", "2": "ii", "3": "iii" };

export function normBook(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    // NOTE: preserved from legacy — ROMAN[d] lookup; d is always "1"|"2"|"3" here
    .replace(/^([123])\s+/, (_: string, d: string) => (ROMAN[d] ?? d) + " ")
    .replace(/\./g, "");
}

export function findBook(name: string): Book | null {
  const books = kw().CODEX_DATA?.books ?? [];
  const n = normBook(name);
  let exact: Book | null = null;
  let prefix: Book | null = null;
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    if (!book) continue;
    const bn = normBook(book.name);
    if (bn === n) { exact = book; break; }
    if (!prefix && bn.indexOf(n) === 0) prefix = book;
    if (!prefix && book.id === n.replace(/\s/g, "")) prefix = book;
  }
  return exact ?? prefix ?? null;
}

export function parseRef(ref: string): ParsedRef | null {
  const m = String(ref || "")
    .trim()
    .match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!m) return null;
  const book = findBook(m[1] ?? "");
  if (!book) return null;
  return {
    bookId: book.id,
    bookName: book.name,
    chapter: parseInt(m[2] ?? "0", 10),
    v1: m[3] != null ? parseInt(m[3], 10) : null,
    v2:
      m[4] != null
        ? parseInt(m[4], 10)
        : m[3] != null
          ? parseInt(m[3], 10)
          : null,
  };
}

export function primaryTranslation(): string {
  try {
    const t = kw().CODEX_DATA?.tweaks ?? {};
    return t.primary ?? localStorage.getItem("codex.primary") ?? "web";
  } catch (_) {
    return "web";
  }
}

export function clip(s: string, n: number): string {
  // NOTE: preserved from legacy — s == null check (not ===) to catch both null and undefined
  const str = String(s == null ? "" : s);
  return str.length > n ? str.slice(0, n) + " …[truncated]" : str;
}

// ── Tool registry ─────────────────────────────────────────────────────────────
// NOTE: preserved from legacy — module-level mutable map; mutated by register()

export const TOOLS: Record<string, ToolDef> = {};

export function register(tool: ToolDef): boolean {
  if (!tool || !tool.name || typeof tool.run !== "function") return false;
  TOOLS[tool.name] = tool;
  return true;
}

export function toolSpecs(): ToolSpec[] {
  return Object.keys(TOOLS).map((k) => {
    const t = TOOLS[k];
    return {
      name: k,
      description: t?.description ?? "",
      sideEffect: !!(t?.sideEffect),
    };
  });
}

export function call(
  name: string,
  args?: Record<string, unknown>,
): Promise<string> {
  const tool = TOOLS[name];
  if (!tool) throw new Error("Unknown tool: " + name);
  return Promise.resolve(tool.run(args ?? {}));
}

// ── Built-in tools ────────────────────────────────────────────────────────────

register({
  name: "read_passage",
  description:
    "Read scripture text. args: {ref: 'Book ch' or 'Book ch:v' or 'Book ch:v1-v2'}. Returns the verses.",
  run: async (args) => {
    const p = parseRef(String(args["ref"] ?? ""));
    if (!p) throw new Error("Unparseable ref: " + String(args["ref"] ?? ""));
    const bible = kw().BIBLE;
    if (!bible) throw new Error("BIBLE unavailable");
    const data = await bible.loadChapter(p.bookId, p.chapter, primaryTranslation());
    // loadChapter may return { verses: BibleVerse[] } or BibleVerse[] directly
    const verses: BibleVerse[] =
      data && !Array.isArray(data) && Array.isArray((data as BibleChapterResult).verses)
        ? ((data as BibleChapterResult).verses as BibleVerse[])
        : Array.isArray(data)
          ? (data as BibleVerse[])
          : [];
    if (!Array.isArray(verses)) throw new Error("No verses for " + String(args["ref"] ?? ""));
    const out = verses
      .filter((v) => {
        const n = v.verse ?? v.n;
        if (p.v1 == null) return true;
        return n != null && n >= p.v1 && n <= (p.v2 ?? p.v1);
      })
      .map((v) => String(v.verse ?? v.n ?? "") + ". " + String(v.text ?? "").trim())
      .join("\n");
    return clip(p.bookName + " " + p.chapter + ":\n" + out, 2600);
  },
});

register({
  name: "search_text",
  description:
    "Full-text search across cached scripture. args: {query: 'words OR \"a phrase\"', limit?: number}. Returns matching verses with refs.",
  run: async (args) => {
    const search = kw().CODEX_SEARCH;
    if (!search?.search) throw new Error("Search engine unavailable");
    const limit = Math.min(Number(args["limit"] ?? 8) || 8, 15);
    const hits = await search.search(String(args["query"] ?? ""), { limit });
    if (!Array.isArray(hits) || !hits.length)
      return "No matches for: " + String(args["query"] ?? "");
    return hits
      .slice(0, limit)
      .map((h: SearchHit) => (h.ref ?? h.id ?? "") + " — " + clip(String(h.text ?? h.snippet ?? "").trim(), 160))
      .join("\n");
  },
});

register({
  name: "cross_references",
  description:
    "Treasury of Scripture Knowledge cross-references for a verse. args: {ref: 'Book ch:v'}.",
  run: async (args) => {
    const X = kw().CODEX_CrossRefLookup;
    if (!X?.getCrossRefs) throw new Error("Cross-reference module unavailable");
    const p = parseRef(String(args["ref"] ?? ""));
    if (!p || p.v1 == null) throw new Error("Need a verse ref like 'John 1:1'");
    const key = p.bookId + "." + p.chapter + "." + p.v1;
    const refs = await X.getCrossRefs(key);
    if (!Array.isArray(refs) || !refs.length)
      return "No cross-references recorded for " + String(args["ref"] ?? "");
    return refs
      .slice(0, 14)
      .map((r: CrossRefItem) => {
        try {
          return X.formatRef ? X.formatRef(r) : String(r.ref ?? r);
        } catch (_) {
          return String(r.ref ?? r);
        }
      })
      .join(" · ");
  },
});

register({
  name: "gematria",
  description:
    "Compute gematria/isopsephy LOCALLY for a Hebrew or Greek word/phrase. args: {text}. Never guess these values — always call this.",
  run: async (args) => {
    const G = kw().CODEX_GEMATRIA;
    if (!G?.all) throw new Error("Gematria engine unavailable");
    const v = G.all(String(args["text"] ?? ""));
    return JSON.stringify(v);
  },
});

register({
  name: "open_console",
  description:
    "Open a depth console on a verse for the reader (visual side-effect; result text is just confirmation). args: {kind: 'map'|'mirror'|'sword'|'art'|'compare', ref: 'Book ch:v'}.",
  sideEffect: true,
  run: async (args) => {
    const kind = String(args["kind"] ?? "").toLowerCase();
    if (["map", "mirror", "sword", "art", "compare"].indexOf(kind) === -1)
      throw new Error("Unknown console: " + kind);
    const p = parseRef(String(args["ref"] ?? ""));
    if (!p || p.v1 == null) throw new Error("Need a verse ref like 'John 1:1'");
    window.dispatchEvent(
      new CustomEvent("codex:os-open", { detail: { kind, ref: args["ref"] } }),
    );
    return "Opened " + kind.toUpperCase() + " on " + String(args["ref"] ?? "") + " for the reader.";
  },
});

register({
  name: "goto",
  description: "Navigate the reader to a passage (visual side-effect). args: {ref}.",
  sideEffect: true,
  run: async (args) => {
    const nav = kw().codexJumpToRef;
    if (typeof nav !== "function") throw new Error("Navigation unavailable");
    nav(String(args["ref"] ?? ""));
    return "Reader navigated to " + String(args["ref"] ?? "") + ".";
  },
});

register({
  name: "session_trail",
  description:
    "The reader's recent reading trail (passages visited, most recent last). args: {hours?: number — window to include, default 12}. Use this for 'weave my session' style missions.",
  run: async (args) => {
    const hours = Math.max(1, Math.min(Number(args?.["hours"] ?? 12) || 12, 168));
    const cutoff = Date.now() - hours * 3600 * 1000;
    let trail: TrailEntry[];
    try {
      trail = JSON.parse(localStorage.getItem("codex.trail") ?? "[]") as TrailEntry[];
    } catch (_) {
      trail = [];
    }
    const recent = trail.filter((t) => t.at >= cutoff);
    if (!recent.length)
      return (
        "The trail is empty for the last " +
        hours +
        "h — the reader hasn't moved between passages yet. Ask them to read first, or weave from the current passage alone."
      );
    return recent
      .map((t) => {
        const d = new Date(t.at);
        return t.ref + "  (" + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0") + ")";
      })
      .join("\n");
  },
});

// ── Lexicon & study tools ─────────────────────────────────────────────────────

// NOTE: preserved from legacy — module-level cache; "H"|"G" → Promise<entries>
const strongsCache: Record<string, Promise<StrongsEntries>> = {};

export function strongsEntries(prefix: string): Promise<StrongsEntries> {
  const id = prefix === "H" ? "strongs-hebrew" : "strongs-greek";
  if (!strongsCache[prefix]) {
    const mods = kw().CODEX_MODULES;
    if (!mods || typeof mods.loadModule !== "function") {
      return Promise.reject(
        new Error("Strong's lexicon unavailable (module loader missing)"),
      );
    }
    const p: Promise<StrongsEntries> = mods
      .loadModule(id)
      .then((json) => {
        const m = json as StrongsModuleShape;
        const entries = m?.entries;
        if (!entries) throw new Error("Strong's module " + id + " has no entries");
        return entries;
      });
    strongsCache[prefix] = p;
    // NOTE: preserved from legacy — on failure, remove cache entry so next call retries
    p.catch(() => { delete strongsCache[prefix]; });
  }
  // strongsCache[prefix] is now guaranteed set
  return strongsCache[prefix] as Promise<StrongsEntries>;
}

export function fmtStrongs(key: string, e: StrongsEntry): string {
  const head =
    key + " " + (e.word ?? "") + (e.translit ? " (" + e.translit + ")" : "");
  const bits: string[] = [];
  if (e.pos) bits.push(e.pos);
  if (e.gloss) bits.push("gloss: " + e.gloss);
  if (e.def) bits.push("def: " + clip(String(e.def), 400));
  if (e.kjv) bits.push("KJV renderings: " + clip(String(e.kjv), 160));
  return head + " — " + bits.join(" · ");
}

register({
  name: "strongs_lookup",
  description:
    "Strong's lexicon entry (Hebrew/Greek). args: {number?: 'H7225' or 'G3056', word?: english/translit/lemma to search}. Returns lemma, transliteration, definition.",
  run: async (args) => {
    const num = String(args["number"] ?? "").trim().toUpperCase();
    const word = String(args["word"] ?? "").trim();
    if (!num && !word)
      throw new Error(
        "Provide a Strong's number (e.g. H7225) or a word to search",
      );

    if (num) {
      if (!/^[HG]\d+$/.test(num))
        throw new Error(
          "Bad Strong's number: " + num + " (expected H#### or G####)",
        );
      let entry: StrongsEntry | null = null;
      const sw = kw().CODEX_StrongsLookup;
      if (typeof sw === "function") {
        try { entry = sw(num) ?? null; } catch (_) { entry = null; }
      }
      if (!entry) {
        const entries = await strongsEntries(num.charAt(0) ?? "");
        entry = entries[num] ?? null;
      }
      if (!entry) return "No Strong's entry for " + num + ".";
      return clip(fmtStrongs(num, entry), 900);
    }

    const needle = word.toLowerCase();
    const out: string[] = [];
    let loadedAny = false;
    const prefixes = ["H", "G"];
    for (let i = 0; i < prefixes.length && out.length < 6; i++) {
      const prefix = prefixes[i];
      if (!prefix) continue;
      let entries: StrongsEntries;
      try {
        entries = await strongsEntries(prefix);
        loadedAny = true;
      } catch (_) {
        continue;
      }
      const keys = Object.keys(entries);
      for (let j = 0; j < keys.length && out.length < 6; j++) {
        const k = keys[j];
        if (!k) continue;
        const e = entries[k];
        if (!e) continue;
        const hay = (
          (e.word ?? "") + " " + (e.translit ?? "") + " " + (e.gloss ?? "")
        ).toLowerCase();
        if (hay.indexOf(needle) !== -1) out.push(fmtStrongs(k, e));
      }
    }
    if (!loadedAny) throw new Error("Strong's lexicon modules unavailable");
    if (!out.length) return "No Strong's entries match '" + word + "'.";
    return clip(out.join("\n"), 2000);
  },
});

register({
  name: "dictionary_lookup",
  description:
    "Easton's Bible Dictionary entry for a term. args: {term: e.g. 'alpha'}. Returns the entry text with scripture refs.",
  run: async (args) => {
    const term = String(args["term"] ?? "").trim().toLowerCase();
    if (!term) throw new Error("Need a term to look up");
    const mods = kw().CODEX_MODULES;
    if (!mods || typeof mods.loadModule !== "function")
      throw new Error("Dictionary unavailable (module loader missing)");
    let mod: EastonModuleShape;
    try {
      mod = (await mods.loadModule("easton-sample")) as EastonModuleShape;
    } catch (e: unknown) {
      throw new Error(
        "Dictionary module unavailable: " +
          String((e instanceof Error ? e.message : null) ?? e),
      );
    }
    const entries = mod?.entries ?? {};
    const entry = entries[term];
    if (!entry) {
      const near = Object.keys(entries)
        .filter((k) => k.indexOf(term) === 0)
        .slice(0, 6);
      return (
        "No Easton's entry for '" +
        term +
        "'." +
        (near.length ? " Near matches: " + near.join(", ") : "")
      );
    }
    const refs =
      Array.isArray(entry.refs) && entry.refs.length
        ? "\nRefs: " + entry.refs.slice(0, 10).join(" · ")
        : "";
    return (
      clip(
        (entry.title ?? term) + " — " + String(entry.body ?? "").trim(),
        1200,
      ) + refs
    );
  },
});

register({
  name: "timeline_events",
  description:
    "Biblical timeline events. args: {yearFrom?: number (negative = BC, e.g. -1000), yearTo?: number, query?: title/people/places keyword}. Returns up to 12 'year — title' lines.",
  run: async (args) => {
    let events: TimelineEvent[] | null = null;
    const timeline = kw().CODEX_Timeline;
    if (timeline && typeof timeline.loadEvents === "function") {
      events = await timeline.loadEvents();
    } else {
      const mods = kw().CODEX_MODULES;
      if (mods && typeof mods.loadModule === "function") {
        const mod = await mods
          .loadModule("timeline-events")
          .catch(() => null) as TimelineModuleShape | null;
        if (mod?.events) {
          events = mod.events.slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
        }
      }
    }
    if (!Array.isArray(events) || !events.length)
      throw new Error("Timeline module unavailable");

    const q = String(args["query"] ?? "").trim().toLowerCase();
    const yearFromRaw = args["yearFrom"];
    const yearToRaw = args["yearTo"];
    let from: number | null =
      yearFromRaw != null && yearFromRaw !== ""
        ? parseInt(String(yearFromRaw), 10)
        : null;
    let to: number | null =
      yearToRaw != null && yearToRaw !== ""
        ? parseInt(String(yearToRaw), 10)
        : null;
    if (from != null && isNaN(from)) from = null;
    if (to != null && isNaN(to)) to = null;

    const hits = events.filter((ev) => {
      if (from != null && ev.year < from) return false;
      if (to != null && ev.year > to) return false;
      if (q) {
        const hay = (
          (ev.title ?? "") +
          " " +
          (ev.summary ?? "") +
          " " +
          (ev.era ?? "") +
          " " +
          (ev.people ?? []).join(" ") +
          " " +
          (ev.places ?? []).join(" ")
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (!hits.length) return "No timeline events match.";

    function yearLabel(y: number): string {
      return y < 0 ? String(-y) + " BC" : y === 0 ? "1 BC/AD" : "AD " + String(y);
    }
    return hits
      .slice(0, 12)
      .map(
        (ev) =>
          yearLabel(ev.year) +
          " — " +
          ev.title +
          (Array.isArray(ev.scripture) && ev.scripture.length
            ? " (" + ev.scripture[0] + ")"
            : ""),
      )
      .join("\n");
  },
});

register({
  name: "save_note",
  description:
    "Save a study note for the reader — it appears in the Notes panel (side-effect). args: {ref: display ref like 'John 1:14' (may be ''), title?: short heading, body: the note text}.",
  sideEffect: true,
  run: async (args) => {
    const body = String(args["body"] ?? "").trim();
    if (!body) throw new Error("Note body is empty");
    const title = String(args["title"] ?? "").trim();
    const ref = String(args["ref"] ?? "").trim();
    const note: NoteItem = {
      id: "n_" + Date.now(),
      text: clip(title ? title + "\n" + body : body, 4000),
      ref,
      ts: Date.now(),
    };
    let notes: NoteItem[];
    try {
      notes = JSON.parse(
        localStorage.getItem("codex.notes.v1") ?? "[]",
      ) as NoteItem[];
    } catch (_) {
      notes = [];
    }
    if (!Array.isArray(notes)) notes = [];
    try {
      localStorage.setItem(
        "codex.notes.v1",
        JSON.stringify([note].concat(notes)),
      );
      localStorage.setItem("codex.notes.visible", "1");
    } catch (e: unknown) {
      throw new Error(
        "Could not persist note: " +
          String((e instanceof Error ? e.message : null) ?? e),
      );
    }
    try { window.dispatchEvent(new CustomEvent("codex:notes:show")); } catch (_) {}
    return (
      "Note saved" +
      (ref ? " on " + ref : "") +
      " (" +
      (notes.length + 1) +
      " total) — visible in the Notes panel."
    );
  },
});

// ── App-control tools ─────────────────────────────────────────────────────────
// The settings tools speak to the SAME store the Settings panel uses
// (localStorage codex.tweaks.v1 + the 'tweakchange' event + the
// __edit_mode_set_keys host message — see tweaks-panel.jsx useTweaks).

const TWEAKS_LS = "codex.tweaks.v1";

export function readTweaks(): Record<string, unknown> {
  try {
    return (
      (JSON.parse(localStorage.getItem(TWEAKS_LS) ?? "{}") as Record<string, unknown>) ?? {}
    );
  } catch (_) {
    return {};
  }
}

export function writeTweak(key: string, value: unknown): unknown {
  const stored = readTweaks();
  const prev = stored[key];
  stored[key] = value;
  try {
    localStorage.setItem(TWEAKS_LS, JSON.stringify(stored));
  } catch (e: unknown) {
    throw new Error(
      "Could not persist setting: " +
        String((e instanceof Error ? e.message : null) ?? e),
    );
  }
  const edits: Record<string, unknown> = {};
  edits[key] = value;
  try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*"); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits })); } catch (_) {}
  // No silent changes — every write echoes a visible chip.
  try {
    window.dispatchEvent(
      new CustomEvent("codex:toast", {
        detail: { msg: "⚙ set " + key + " " + JSON.stringify(value), kind: "ok" },
      }),
    );
  } catch (_) {}
  return prev;
}

register({
  name: "app_settings_get",
  description:
    "Read the user's app settings (the same codex.tweaks.v1 store the Settings panel uses). args: {key?: read one setting}. Returns JSON.",
  run: async (args) => {
    const t = readTweaks();
    const key = args["key"] != null ? String(args["key"]) : "";
    if (key)
      return JSON.stringify({
        key,
        value: Object.prototype.hasOwnProperty.call(t, key) ? t[key] : null,
        set: Object.prototype.hasOwnProperty.call(t, key),
      });
    return clip(JSON.stringify(t), 2000);
  },
});

register({
  name: "app_settings_set",
  description:
    "Change ONE app setting through the same store Settings uses (visible side-effect; the change is echoed to the user as a ⚙ chip — never silent). args: {key, value}. Useful keys: fontScale (number, reader text size), oracleFontScale, scriptureFont ('serif'|'mono'), accent ('cyan'|'amber'|'violet'|'green'|'rose'), redLetter (bool), sideBySide (bool), distractionFree (bool), primaryTranslation (translation id), provider, model.",
  sideEffect: true,
  run: async (args) => {
    const key = String(args["key"] ?? "").trim();
    if (!key) throw new Error("Need args.key");
    if (!Object.prototype.hasOwnProperty.call(args, "value"))
      throw new Error("Need args.value");
    const prev = writeTweak(key, args["value"]);
    return (
      "⚙ set " +
      key +
      " " +
      JSON.stringify(args["value"]) +
      (prev !== undefined ? " (was " + JSON.stringify(prev) + ")" : "") +
      " — persisted to the Settings store; some surfaces apply it on their next render."
    );
  },
});

register({
  name: "open_panel",
  description:
    "Open an app panel/window for the reader (visual side-effect). args: {id: one of trans|talmud|comm|gem|gnosis|disarm|exeg|txan (study panels) or library|oracle|marks|reader (desk windows)}.",
  sideEffect: true,
  run: async (args) => {
    const id = String(args["id"] ?? "").trim();
    if (!id) throw new Error("Need args.id");
    const deskIds = ["reader", "library", "oracle", "marks"];
    const desk = kw().codexDesk;
    if (deskIds.indexOf(id) !== -1 && desk?.open) {
      desk.open(id);
      return "Opened the " + id.toUpperCase() + " window.";
    }
    const panels = kw().codexDeskPanels;
    if (panels?.open) {
      panels.open(id);
      return "Opened the " + id.toUpperCase() + " panel window.";
    }
    try {
      window.dispatchEvent(
        new CustomEvent("codex:open-builtin-tab", { detail: { tabId: id } }),
      );
      return "Requested the " + id.toUpperCase() + " panel.";
    } catch (e: unknown) {
      throw new Error("Panel host unavailable");
    }
  },
});

register({
  name: "set_translation",
  description:
    "Switch the reader's primary translation (visual side-effect). args: {id: translation id like 'kjv', 'web', 'lxx', 'wlc'}.",
  sideEffect: true,
  run: async (args) => {
    const id = String(args["id"] ?? "").trim().toLowerCase();
    if (!id) throw new Error("Need args.id");
    const list = kw().CODEX_DATA?.translations ?? [];
    if (
      list.length &&
      !list.some((t) => t.id === id)
    ) {
      throw new Error(
        "Unknown translation id: " +
          id +
          ". Known: " +
          list
            .slice(0, 30)
            .map((t) => t.id)
            .join(", "),
      );
    }
    const setPrimary = kw().codexSetPrimary;
    if (typeof setPrimary === "function") {
      setPrimary(id);
    } else {
      writeTweak("primaryTranslation", id);
      try {
        window.dispatchEvent(
          new CustomEvent("codex:set-primary", { detail: { id } }),
        );
      } catch (_) {}
    }
    return "Primary translation switched to " + id.toUpperCase() + ".";
  },
});

register({
  name: "focus_mode",
  description:
    "Toggle focus mode — hides every window except the reader (visual side-effect). args: {on: true|false}.",
  sideEffect: true,
  run: async (args) => {
    const on = !!(args["on"]);
    const desk = kw().codexDesk;
    if (!desk || typeof desk.focus !== "function")
      throw new Error("Desk unavailable");
    desk.focus(on);
    return "Focus mode " + (on ? "ON — only the Word remains." : "off — the desk is back.");
  },
});

// ── Agent prompt — rebuilt per mission from the live registry ────────────────

export function kernelPrompt(maxSteps: number): string {
  const lines = Object.keys(TOOLS).map(
    (k) => "  · " + k + " — " + (TOOLS[k]?.description ?? ""),
  );
  // Section bodies render through the artifacts engine — teach the model
  // the rich-output grammar so artifacts can carry charts/flows/buttons.
  let artDoc = "";
  try {
    const art = kw().CODEX_ARTIFACTS;
    if (art?.directiveDoc) {
      artDoc =
        "\n\nSECTION BODIES — " +
        art.directiveDoc() +
        "\nChart/flow data must come from your tool results in THIS mission — never invented.";
    }
  } catch (_) {}
  return [
    "You are the CODEX KERNEL — the mission agent of a Bible-study OS. You accomplish the reader's intent by calling the app's own tools, then writing a cited artifact. You are a careful scholar: every factual claim in your sections must be traceable to a tool result or marked as interpretation; cite canonical refs (e.g. John 1:1) inline. Survey traditions neutrally; never preach.",
    "",
    "TOOLS:",
    lines.join("\n"),
    "",
    "PROTOCOL — reply with ONE JSON object per turn, nothing else, no fences:",
    '  {"thought":"why this step","tool":"<name>","args":{...}}            — call a tool',
    '  {"thought":"...","section":{"heading":"...","body":"markdown, cited"}} — append an artifact section',
    '  {"thought":"...","done":{"title":"...","summary":"2-3 sentences"}}     — finish the mission',
    "",
    "RULES:",
    "- GATHER before you WRITE: read/search/cross-reference first, then sections.",
    "- ≤ " + maxSteps + " total steps. Plan tightly. 2-5 sections is a good artifact.",
    "- Never invent verse text, cross-references, or gematria values — call the tool.",
    "- The final section must be a short 'Caveats' note (interpretive limits).",
    "- open_console/goto/open_panel/focus_mode are for SHOWING the reader things — use at most 2 per mission, only when visual context truly helps.",
    "- app_settings_set changes the user's real settings — only when the intent explicitly asks for it.",
    "- Return ONLY the JSON object each turn.",
    artDoc,
  ].join("\n");
}

// ── Mission storage ───────────────────────────────────────────────────────────

export function loadMissions(): Mission[] {
  try {
    return JSON.parse(localStorage.getItem("codex.missions") ?? "[]") as Mission[];
  } catch (_) {
    return [];
  }
}

export function saveMission(m: Mission): void {
  try {
    const all = loadMissions();
    const i = all.findIndex((x) => x.id === m.id);
    if (i >= 0) all[i] = m;
    else all.unshift(m);
    localStorage.setItem("codex.missions", JSON.stringify(all.slice(0, 20)));
  } catch (_) {}
}

// ── Event bus ─────────────────────────────────────────────────────────────────

export function emit(detail: Record<string, unknown>): void {
  try {
    window.dispatchEvent(new CustomEvent("codex:kernel", { detail }));
  } catch (_) {}
}

// ── The chat step ─────────────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  system: string,
): Promise<Record<string, unknown>> {
  const I = kw().CODEX_INTEL;
  if (!I) throw new Error("CODEX_INTEL unavailable");
  const eng = I.intelEngine();
  // AI-busy bus — the orb pulses for the duration of every model call.
  let busyId: unknown = null;
  try {
    if (kw().CODEX_AI_BUSY) busyId = kw().CODEX_AI_BUSY?.begin("KERNEL MISSION") ?? null;
  } catch (_) {}
  let r: Response | undefined;
  let body: Record<string, unknown> = {};
  try {
    r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: eng.provider,
        model: eng.model ?? "claude-haiku-4-5-20251001",
        system,
        messages,
        max_tokens: 1400,
      }),
    });
    body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  } finally {
    try {
      if (busyId != null && kw().CODEX_AI_BUSY) kw().CODEX_AI_BUSY?.end(busyId);
    } catch (_) {}
  }
  if (!r?.ok) throw new Error(I.intelErrMessage(body, r?.status ?? 0));
  const text = String(body["text"] ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const i = text.indexOf("{");
  if (i === -1) throw new Error("Kernel step was not JSON");
  return I.intelParseJSON(text.slice(i));
}

// ── The mission loop ──────────────────────────────────────────────────────────

export function run(
  intent: string,
  opts?: { maxSteps?: number },
): KernelRunHandle {
  const maxSteps = Math.min(opts?.maxSteps ?? 10, 16);
  const id =
    "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let aborted = false;
  const mission: Mission = {
    id,
    intent: String(intent ?? ""),
    startedAt: Date.now(),
    status: "running",
    steps: [],
    artifact: { title: "", summary: "", sections: [] },
  };
  saveMission(mission);
  emit({ id, type: "start", intent: mission.intent, maxSteps });

  (async () => {
    const system = kernelPrompt(maxSteps);
    const messages: ChatMessage[] = [
      {
        role: "user",
        content:
          "INTENT: " + mission.intent + "\n\nBegin. Return your first JSON step.",
      },
    ];
    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (aborted) throw new Error("aborted");
        const move = await chat(messages, system);
        if (aborted) throw new Error("aborted");
        const thought = String(move["thought"] ?? "");
        messages.push({ role: "assistant", content: JSON.stringify(move) });

        if (move["done"]) {
          const done = move["done"] as Record<string, unknown>;
          mission.artifact.title = String(done["title"] ?? mission.intent);
          mission.artifact.summary = String(done["summary"] ?? "");
          mission.status = "done";
          mission.finishedAt = Date.now();
          saveMission(mission);
          emit({ id, type: "done", step, thought, artifact: mission.artifact });
          return;
        }

        const sectionRaw = move["section"];
        if (
          sectionRaw &&
          typeof sectionRaw === "object" &&
          (sectionRaw as Record<string, unknown>)["heading"]
        ) {
          const sectionObj = sectionRaw as Record<string, unknown>;
          const sec: ArtifactSection = {
            heading: String(sectionObj["heading"]),
            body: String(sectionObj["body"] ?? ""),
          };
          mission.artifact.sections.push(sec);
          const stepRec: MissionStep = { kind: "section", heading: sec.heading };
          mission.steps.push(stepRec);
          saveMission(mission);
          emit({ id, type: "section", step, thought, section: sec });
          messages.push({
            role: "user",
            content:
              "Section recorded (" +
              mission.artifact.sections.length +
              " so far). Next JSON step.",
          });
          continue;
        }

        const toolName = String(move["tool"] ?? "");
        const tool = TOOLS[toolName];
        emit({
          id,
          type: "tool",
          step,
          thought,
          tool: toolName,
          args: (move["args"] ?? {}) as Record<string, unknown>,
        });
        let result: string;
        let failed = false;
        if (!tool) {
          result =
            "Unknown tool: " +
            toolName +
            ". Available: " +
            Object.keys(TOOLS).join(", ");
          failed = true;
        } else {
          try {
            const raw = await tool.run(
              (move["args"] ?? {}) as Record<string, unknown>,
            );
            result = typeof raw === "string" ? raw : JSON.stringify(raw);
          } catch (e: unknown) {
            result =
              "TOOL ERROR: " +
              String((e instanceof Error ? e.message : null) ?? e);
            failed = true;
          }
        }
        const resStr = clip(result, 1600);
        const stepRec: MissionStep = {
          kind: "tool",
          tool: toolName,
          args: (move["args"] ?? {}) as Record<string, unknown>,
          result: clip(resStr, 400),
          failed,
        };
        mission.steps.push(stepRec);
        saveMission(mission);
        emit({ id, type: "result", step, tool: toolName, result: resStr, failed });
        messages.push({
          role: "user",
          content:
            "RESULT of " +
            toolName +
            ":\n" +
            resStr +
            "\n\nNext JSON step (" +
            (maxSteps - step) +
            " remaining).",
        });
      }
      // Step budget exhausted — close out with what we have.
      mission.status = "done";
      mission.finishedAt = Date.now();
      if (!mission.artifact.title) mission.artifact.title = mission.intent;
      if (!mission.artifact.summary)
        mission.artifact.summary =
          "Mission reached its step budget; artifact contains the sections completed.";
      saveMission(mission);
      emit({
        id,
        type: "done",
        step: maxSteps,
        thought: "step budget reached",
        artifact: mission.artifact,
        budget: true,
      });
    } catch (e: unknown) {
      mission.status = aborted ? "aborted" : "error";
      mission.error = String((e instanceof Error ? e.message : null) ?? e);
      mission.finishedAt = Date.now();
      saveMission(mission);
      emit({
        id,
        type: aborted ? "abort" : "error",
        error: mission.error,
      });
    }
  })();

  return { id, abort: () => { aborted = true; } };
}
