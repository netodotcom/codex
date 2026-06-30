// omnibar — pure constants (migrated verbatim from omnibar.jsx). The verb table,
// the universal panel index, the plain-words descriptions + hidden keyword
// haystacks for the "/" catalog, and the stop-word set. Static by design: the
// bar must answer even before plugins load. No window, no side effects.

// One row the bar can render and execute. `action` may be async (the inline
// search fallback) or null (a dead/explanatory row). The catalog adds hay/score;
// guide/loose helpers add a few transient flags.
export interface OmniRow {
  id: string;
  icon: string;
  title: string;
  sub?: string;
  action?: (() => void) | (() => Promise<void>) | null;
  stay?: boolean;
  primary?: boolean;
  guide?: boolean;
  hay?: string;
  score?: number;
}

// A "/" catalog row — hay (search haystack) + score (learned rank) are required.
export interface CatalogRow extends OmniRow {
  hay: string;
  score: number;
}

export interface OmniVerb {
  kind: "console" | "go" | "ops";
  icon: string;
  label: string;
}

export interface PanelEntry {
  id: string;
  label: string;
  icon: string;
}

export interface OmniCommand {
  id: string;
  icon: string;
  aliases: string[];
  title: string;
  sub: string;
  action: () => void;
}

export const OMNI_VERBS: Record<string, OmniVerb> = {
  sword:   { kind: "console", icon: "⚔", label: "SWORD — fourfold edge" },
  mirror:  { kind: "console", icon: "⌬", label: "MIRROR — pattern analysis" },
  map:     { kind: "console", icon: "◎", label: "MAP — geo intelligence" },
  art:     { kind: "console", icon: "▦", label: "ART — paintings & illustrations" },
  compare: { kind: "console", icon: "≡", label: "COMPARE — all translations" },
  go:      { kind: "go",      icon: "→", label: "GO — jump the reader" },
  ops:     { kind: "ops",     icon: "❖", label: "OPS — task the kernel" },
};

// ── Universal index — every rail panel, one flat static list. Ids/labels
// mirror panels.jsx builtins + the plugin register calls; icons are the
// rail glyphs. Static by design: the bar must answer even before plugins load.
export const PANEL_INDEX: PanelEntry[] = [
  { id: "trans",  label: "TRANSLATIONS", icon: "Α/Ω" },
  { id: "talmud", label: "TALMUD",       icon: "ת" },
  { id: "comm",   label: "COMMENTARY",   icon: "§" },
  { id: "gem",    label: "GEMATRIA",     icon: "Σn" },
  { id: "gnosis", label: "GNOSIS",       icon: "⟁" },
  { id: "disarm", label: "DISARM",       icon: "⚔" },
  { id: "exeg",   label: "EXEGESIS",     icon: "✎" },
  { id: "txan",   label: "TX·ANALYSIS",  icon: "⟷" },
  { id: "plugin:crossrefs-tsk:crossrefs",     label: "CROSS-REFS",   icon: "✝" },
  { id: "plugin:strongs-concordance:strongs", label: "STRONG'S",     icon: "ℋ" },
  { id: "plugin:word-study:word",             label: "WORD",         icon: "Λ" },
  { id: "plugin:bible-dictionary:dictionary", label: "DICT",         icon: "ℵ" },
  { id: "plugin:passage-guide:guide",         label: "GUIDE",        icon: "❖" },
  { id: "plugin:compare:compare",             label: "COMPARE",      icon: "⚖" },
  { id: "plugin:jewish-study:torah",          label: "TORAH",        icon: "ה" },
  { id: "plugin:reading-plans:plans",         label: "PLANS",        icon: "⥁" },
  { id: "plugin:biblical-timeline:timeline",  label: "TIMELINE",     icon: "⏳" },
  { id: "plugin:reels:reels",                 label: "REELS",        icon: "▶" },
  { id: "plugin:vox:vox",                     label: "VOX",          icon: "◉" },
  { id: "plugin:continuity:dossier",          label: "ANALYST DESK", icon: "▦" },
  { id: "plugin:module-marketplace:market",   label: "MARKET",       icon: "⊞" },
  { id: "plugin:sermon-builder:builder",      label: "STUDIES",      icon: "❡" },
  { id: "plugin:ai-quests:quests",            label: "QUESTS",       icon: "⚔" },
];

export const omniNorm = (s: string): string => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
// like omniNorm but word-preserving — the "/" palette matches per query word
export const omniWords = (s: string | null | undefined): string =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ── Learned usage — codex.cmd.freq.v1 = { [rowId]: { n, last } }.
export const OMNI_FREQ_KEY = "codex.cmd.freq.v1";

// ── Plain-words descriptions + hidden search keywords for the "/" catalog.
export const OMNI_PANEL_DESC: Record<string, string> = {
  trans: "Translations and side-by-side compare",
  talmud: "Talmudic context and questions",
  comm: "Commentary on the open passage",
  gem: "Gematria and numeric resonance",
  gnosis: "Esoteric / mystical reading layer",
  disarm: "How power twists this verse — and the rebuttals",
  exeg: "Verse-level exegesis",
  txan: "Word-by-word translation analysis",
  "plugin:crossrefs-tsk:crossrefs": "Cross-references for the verse",
  "plugin:strongs-concordance:strongs": "Strong's concordance lookups",
  "plugin:word-study:word": "Deep word studies",
  "plugin:bible-dictionary:dictionary": "Bible dictionary",
  "plugin:passage-guide:guide": "Guided tour of the passage",
  "plugin:compare:compare": "Side-by-side comparison view",
  "plugin:jewish-study:torah": "Torah portions and Jewish lens",
  "plugin:reading-plans:plans": "Reading plans",
  "plugin:biblical-timeline:timeline": "Biblical timeline",
  "plugin:reels:reels": "Short-form scripture reels",
  "plugin:vox:vox": "Voice reading and prayer",
  "plugin:continuity:dossier": "Analyst desk — continuity, mastery, intel log",
  "plugin:module-marketplace:market": "Plugin marketplace",
  "plugin:sermon-builder:builder": "Sermon & study builder",
  "plugin:ai-quests:quests": "Quests and challenges",
};
export const OMNI_PANEL_KEYS: Record<string, string> = {
  trans: "versions languages bibles parallel",
  talmud: "rabbinic jewish judaism sages",
  comm: "explain notes scholars meaning",
  gem: "numbers numerology hebrew letters",
  gnosis: "mystical esoteric hidden secret",
  disarm: "abuse misuse rebuttal apologetics",
  exeg: "interpretation meaning close reading",
  txan: "greek hebrew grammar original language",
  "plugin:crossrefs-tsk:crossrefs": "connections related verses links",
  "plugin:strongs-concordance:strongs": "lexicon concordance greek hebrew",
  "plugin:word-study:word": "etymology vocabulary meaning",
  "plugin:bible-dictionary:dictionary": "definitions encyclopedia lookup",
  "plugin:passage-guide:guide": "tour walkthrough overview",
  "plugin:compare:compare": "differences versions parallel",
  "plugin:jewish-study:torah": "parsha portion hebrew jewish",
  "plugin:reading-plans:plans": "schedule daily devotional habit",
  "plugin:biblical-timeline:timeline": "history chronology dates events",
  "plugin:reels:reels": "video shorts clips watch",
  "plugin:vox:vox": "audio listen speech read aloud",
  "plugin:continuity:dossier": "progress stats history intel",
  "plugin:module-marketplace:market": "plugins addons install extensions",
  "plugin:sermon-builder:builder": "sermon preach write outline",
  "plugin:ai-quests:quests": "games challenges achievements play",
};
export const OMNI_VERB_DESC: Record<string, string> = {
  sword: "fourfold analysis console on any verse",
  mirror: "pattern analysis console on any passage",
  map: "geographic intelligence for any passage",
  art: "paintings and illustrations for any passage",
  compare: "every translation of a verse, side by side",
  go: "jump the reader to any reference",
  ops: "task the kernel with a mission",
};
export const OMNI_VERB_KEYS: Record<string, string> = {
  sword: "analyze deep dive verse",
  mirror: "patterns structure chiasm",
  map: "geography places atlas where",
  art: "images paintings pictures visual",
  compare: "translations versions differences",
  go: "jump navigate goto open reference",
  ops: "mission ai agent research task",
};
export const OMNI_CMD_KEYS: Record<string, string> = {
  constellation: "connections graph network visualize links galaxy stars map of the canon",
  oracle: "talk to ai chat ask question conversation assistant",
  ops: "mission ai kernel agent task",
  settings: "preferences theme options configure keys",
  focus: "distraction free fullscreen reading mode hide everything zen",
  library: "window books navigation left rail bookmarks oracle",
  study: "window panels translations languages compare",
  help: "lost confused learn start how works what is this manual instructions",
  theme: "dark mode light night day lights appearance switch toggle",
};

// Words that carry intent but not meaning — dropped before loose matching
// so "turn on dark mode" hunts the haystacks with just "dark mode".
export const OMNI_STOP = new Set<string>([
  "the", "a", "an", "to", "of", "in", "on", "at", "go", "open", "show",
  "me", "my", "i", "turn", "please", "want", "see", "view", "get", "take",
  "and", "is", "it", "up", "with",
]);
