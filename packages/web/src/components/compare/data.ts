// compare — data layer: app roster, feature matrix, price ranges, radar axes,
// and sentiment. Faithfully ported from legacy/compare.jsx (the IIFE constant
// values; order matters — CODEX is always column 0).

export interface App {
  id: string;
  name: string;
  short: string;
  color: string;
}

// Cell shape: "y" yes, "n" no, "p" partial/warn, "$" paywalled, or a string
// (rendered literally with neutral styling). `note` populates the tooltip.
export interface Cell {
  v: string;
  note: string;
}

export interface Feature {
  key: string;
  label: string;
  row: Cell[];
}

export interface Price {
  id: string;
  low: number;
  high: number;
  label: string;
}

export interface SentimentEntry {
  love: string[];
  hate: string[];
}

// Helper used in FEATURES rows; exported for test assertions.
export function C(v: string, note?: string): Cell {
  return { v, note: note ?? "" };
}

// ── App roster ─────────────────────────────────────────────────────────────
// Order matters; CODEX is always column 0.
export const APPS: App[] = [
  { id: "codex",   name: "CODEX",             short: "CDX", color: "var(--cx-accent, #7ee0ff)" },
  { id: "logos",   name: "Logos",             short: "LGS", color: "#c89bff" },
  { id: "esword",  name: "e-Sword",           short: "ESW", color: "#ffd479" },
  { id: "youver",  name: "YouVersion",        short: "YV",  color: "#ff8aa3" },
  { id: "sefaria", name: "Sefaria",           short: "SFR", color: "#9fe3b8" },
  { id: "olive",   name: "Olive Tree",        short: "OT",  color: "#8ec5ff" },
  { id: "blb",     name: "Blue Letter Bible", short: "BLB", color: "#ffb38a" },
];

// ── Feature matrix ──────────────────────────────────────────────────────────
export const FEATURES: Feature[] = [
  { key: "price",        label: "Price",
    row: [C("$0","Free, open source"), C("$100–$5000","Tiered libraries"), C("$0"), C("$0","Ads + subs upsell"), C("$0","Donation funded"), C("$0–$400","Resource bundles"), C("$0")] },
  { key: "oss",          label: "Open source",
    row: [C("y"), C("n"), C("n"), C("n"), C("y","Site code MIT; data CC"), C("n"), C("n")] },
  { key: "pwa",          label: "Browser / PWA",
    row: [C("y"), C("p","Web limited"), C("n"), C("y"), C("y"), C("p","Read-only web"), C("y")] },
  { key: "mobile",       label: "Native mobile",
    row: [C("p","Capacitor planned"), C("y"), C("p","via 3rd-party"), C("y"), C("y"), C("y"), C("y")] },
  { key: "desktop",      label: "Native desktop",
    row: [C("p","Tauri build"), C("y"), C("y","Windows only"), C("n"), C("n"), C("y"), C("n")] },
  { key: "offline",      label: "Full offline",
    row: [C("y"), C("p","Resources sync"), C("y"), C("p","Per translation"), C("p","Partial"), C("y"), C("n")] },
  { key: "ai_comm",      label: "AI commentary",
    row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
  { key: "ai_chat",      label: "AI chat (Oracle)",
    row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
  { key: "local_llm",    label: "Local LLM support",
    row: [C("y","Ollama / lmstudio"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
  { key: "airgap",       label: "Air-gap capable",
    row: [C("y"), C("n"), C("y"), C("n"), C("n"), C("p"), C("n")] },
  { key: "strongs",      label: "Strong's numbers",
    row: [C("p","Phase 1 subset"), C("y"), C("y"), C("n"), C("y"), C("$","Paywall"), C("y")] },
  { key: "interlinear",  label: "Interlinear",
    row: [C("p"), C("y"), C("y"), C("n"), C("y"), C("$"), C("y")] },
  { key: "tsk",          label: "Cross-refs (TSK)",
    row: [C("p","Subset shipping"), C("y"), C("y"), C("n"), C("p"), C("y"), C("y")] },
  { key: "plans",        label: "Reading plans",
    row: [C("y"), C("y"), C("p"), C("y","2000+"), C("y"), C("y"), C("p")] },
  { key: "parsha",       label: "Torah parsha",
    row: [C("y"), C("p"), C("n"), C("p"), C("y"), C("n"), C("n")] },
  { key: "hcal",         label: "Hebrew calendar",
    row: [C("y"), C("n"), C("n"), C("n"), C("y"), C("n"), C("n")] },
  { key: "gematria",     label: "Gematria",
    row: [C("y"), C("n"), C("n"), C("n"), C("p"), C("n"), C("n")] },
  { key: "apocrypha",    label: "Apocrypha",
    row: [C("y"), C("y"), C("p"), C("p"), C("y"), C("y"), C("p")] },
  { key: "gnostic",      label: "Gnostic texts",
    row: [C("y"), C("p"), C("n"), C("n"), C("n"), C("n"), C("n")] },
  { key: "plugins",      label: "Plugin API",
    row: [C("y"), C("p","Closed SDK"), C("y","ToolTip"), C("n"), C("y","API"), C("n"), C("n")] },
  { key: "market",       label: "Module marketplace",
    row: [C("y"), C("y","Massive"), C("y"), C("p"), C("p"), C("y"), C("n")] },
  { key: "custom_trans", label: "Author own translation",
    row: [C("y"), C("p"), C("y"), C("n"), C("y"), C("n"), C("n")] },
  { key: "cli",          label: "CLI",
    row: [C("y"), C("n"), C("n"), C("n"), C("p","API"), C("n"), C("n")] },
  { key: "kbd",          label: "Keyboard navigation",
    row: [C("y"), C("p"), C("p"), C("n"), C("p"), C("p"), C("p")] },
  { key: "terminal",     label: "Terminal mode",
    row: [C("y"), C("n"), C("n"), C("n"), C("n"), C("n"), C("n")] },
  { key: "ext",          label: "Browser extension",
    row: [C("y"), C("n"), C("n"), C("n"), C("p"), C("n"), C("n")] },
  { key: "widget",       label: "Embeddable widget",
    row: [C("y"), C("n"), C("n"), C("y","Verse of day"), C("y"), C("n"), C("y")] },
  { key: "translations", label: "Translations count",
    row: [C("43+"), C("250+"), C("200+"), C("2800+"), C("40+"), C("150+"), C("40+")] },
  { key: "languages",    label: "Languages",
    row: [C("12+"), C("40+"), C("30+"), C("1900+"), C("20+"), C("30+"), C("10+")] },
];

// ── Price ranges (USD) for the bar chart ────────────────────────────────────
export const PRICES: Price[] = [
  { id: "codex",   low: 0,   high: 0,    label: "$0 forever" },
  { id: "logos",   low: 100, high: 5000, label: "$100–$5,000" },
  { id: "esword",  low: 0,   high: 200,  label: "Free + add-ons" },
  { id: "youver",  low: 0,   high: 0,    label: "$0 (ads)" },
  { id: "sefaria", low: 0,   high: 0,    label: "$0 (donation)" },
  { id: "olive",   low: 0,   high: 400,  label: "$0–$400 bundles" },
  { id: "blb",     low: 0,   high: 0,    label: "$0" },
];

// ── Radar axes ──────────────────────────────────────────────────────────────
export const AXES: string[] = [
  "Original Languages", "AI Features", "Offline", "Reading Experience",
  "Study Depth", "Mobile", "Customization", "Community",
];

// Coverage scores 0-100 per app across the 8 axes (order matches AXES).
export const RADAR: Record<string, number[]> = {
  codex:   [70, 95, 100, 80, 75, 60, 95, 70],
  logos:   [95, 10, 50, 90, 98, 75, 60, 70],
  esword:  [70, 5, 95, 50, 70, 35, 55, 55],
  youver:  [10, 15, 55, 85, 20, 95, 35, 95],
  sefaria: [95, 10, 40, 70, 80, 60, 80, 75],
  olive:   [55, 10, 70, 80, 60, 80, 50, 60],
  blb:     [80, 10, 30, 60, 70, 50, 40, 65],
};

// ── Beloved vs Frustration per competitor ───────────────────────────────────
export const SENTIMENT: Record<string, SentimentEntry> = {
  codex: {
    love: ["AI is built in, not bolted on", "Genuinely free + open source", "Works fully offline / air-gapped", "Plugin API + CLI + extension"],
    hate: ["New — fewer translations than YouVersion", "Native apps still maturing", "Strong's coverage is Phase 1"],
  },
  logos: {
    love: ["Deepest original-language library", "Vast scholarly resources", "Polished UI"],
    hate: ["Eye-watering price ladder ($$$$)", "Bloated, slow startup", "Locks resources to account"],
  },
  esword: {
    love: ["Free for Windows since 2000", "Solid offline workflow", "Huge legacy module library"],
    hate: ["Windows-only at heart", "Dated UI", "Mobile is a separate paid product"],
  },
  youver: {
    love: ["Beautiful mobile reading", "Huge translation catalog", "Social plans + sharing"],
    hate: ["Almost no study depth", "No Strong's / interlinear", "Ad creep + telemetry"],
  },
  sefaria: {
    love: ["Best-in-class Jewish library", "Truly open data (CC)", "Beautiful linker graphs"],
    hate: ["Web-first, weak offline", "No AI assistance", "Christian texts limited"],
  },
  olive: {
    love: ["Smooth cross-device sync", "Clean reader", "Strong study-Bible catalog"],
    hate: ["Best features behind paywall", "Subscription creep", "Closed ecosystem"],
  },
  blb: {
    love: ["Free Strong's online since '96", "Reliable interlinear", "No-nonsense study tools"],
    hate: ["UI feels late-90s", "No offline", "No mobile-first design"],
  },
};
