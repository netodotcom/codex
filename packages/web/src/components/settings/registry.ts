// settings — the registry + pure routing/format helpers (migrated from
// tweaks-panel.jsx). Every setting CODEX knows about, the retired keys, and the
// functions that route unknown keys/sections into the right group.

export const SETTINGS_GROUPS = ["APPEARANCE", "SCRIPTURE", "THE NAME", "AI & KEYS", "READING", "INSTRUMENTS", "SYSTEM", "DANGER"];

export interface RegistryEntry {
  key: string;
  label: string;
  kind: string;
  group: string;
  owner: string;
  kw: string;
}

// Keys that once existed and were retired on purpose — listed so nothing is
// silently dropped (the settings index treats these as accounted for).
export const CODEX_SETTINGS_DEPRECATED = [
  "engageEnabled", "engageDailyThreshold", "engageNotifyCadence", "engageReduceMotion",
  "yhwhMode",
  "os7",
  "railVisible",
  "theaterMode",
];

export const SETTINGS_REGISTRY: RegistryEntry[] = [
  // APPEARANCE
  { key: "autoTheme", label: "Theme · follow the sun", kind: "segment", group: "APPEARANCE", owner: "self", kw: "theme dark light night day auto solar mode appearance lights" },
  { key: "manualDark", label: "Theme · day / night", kind: "segment", group: "APPEARANCE", owner: "self", kw: "theme dark light night day manual appearance" },
  { key: "accent", label: "Accent color", kind: "color", group: "APPEARANCE", owner: "child", kw: "accent color cyan amber green violet glow" },
  { key: "lightTheme", label: "Day-mode palette", kind: "swatch", group: "APPEARANCE", owner: "child", kw: "palette parchment vellum linen sandstone sage solarized slate rose old book day light" },
  { key: "scanlines", label: "Scanlines", kind: "toggle", group: "APPEARANCE", owner: "child", kw: "scanlines crt texture grain" },
  { key: "schizo", label: "Schizo Mode", kind: "toggle", group: "APPEARANCE", owner: "child", kw: "schizo easter egg glitch" },
  // SCRIPTURE
  { key: "primaryTranslation", label: "Primary translation", kind: "select", group: "SCRIPTURE", owner: "self", kw: "translation bible version kjv web primary text" },
  { key: "fontScale", label: "Scripture size", kind: "slider", group: "SCRIPTURE", owner: "self", kw: "font size text scale scripture aa bigger smaller type reader" },
  { key: "scriptureFont", label: "Scripture face", kind: "segment", group: "SCRIPTURE", owner: "self", kw: "font face serif mono typeface family" },
  { key: "redLetter", label: "Red-letter words", kind: "toggle", group: "SCRIPTURE", owner: "self", kw: "red letter words of jesus christ crimson" },
  { key: "sideBySide", label: "Side-by-side translations", kind: "toggle", group: "SCRIPTURE", owner: "self", kw: "side by side parallel two translations columns compare" },
  // THE NAME
  { key: "divineGold", label: "The Name in covenant gold", kind: "toggle", group: "THE NAME", owner: "self", kw: "divine gold golden name yhwh tetragrammaton yahweh jehovah lord restore sacred covenant color reader" },
  { key: "divineHebrew", label: "Tetragrammaton in Hebrew (יהוה)", kind: "toggle", group: "THE NAME", owner: "self", kw: "divine hebrew tetragrammaton yhwh script name reader" },
  // AI & KEYS
  { key: "apiKeys", label: "API keys (Anthropic · Grok · Groq · Gemini · Ollama)", kind: "keys", group: "AI & KEYS", owner: "child", kw: "api key keys secret token anthropic claude grok xai groq gemini google ollama local engine" },
  { key: "provider", label: "Oracle engine", kind: "segment", group: "AI & KEYS", owner: "child", kw: "provider engine anthropic claude xai grok groq gemini google ollama local ai" },
  { key: "model", label: "Oracle model", kind: "select", group: "AI & KEYS", owner: "child", kw: "model haiku sonnet opus llama deepseek ai" },
  { key: "hermeneuticDriftCompensation", label: "Hermeneutic drift compensation", kind: "toggle", group: "AI & KEYS", owner: "child", kw: "drift hermeneutic advanced inference experimental" },
  // READING
  { key: "distractionFree", label: "Distraction-free reading", kind: "toggle", group: "READING", owner: "self", kw: "distraction free focus zen hide chrome quiet theater" },
  { key: "caffeinate", label: "Keep screen awake", kind: "toggle", group: "READING", owner: "child", kw: "caffeinate keep screen awake wake lock sleep" },
  { key: "notesEnabled", label: "Margin notes", kind: "toggle", group: "READING", owner: "child", kw: "notes margin notebook write" },
  { key: "oracleFontScale", label: "Oracle font size", kind: "slider", group: "READING", owner: "child", kw: "oracle font size chat text scale" },
  { key: "highlightColor", label: "Default mark color", kind: "color", group: "READING", owner: "child", kw: "highlight color marks amber cyan violet green rose default" },
  { key: "autoBundle", label: "Auto-bundle translations", kind: "toggle", group: "READING", owner: "child", kw: "auto bundle download translations offline as i read" },
  { key: "overlayGnosis", label: "Reader overlay · Gnosis", kind: "toggle", group: "READING", owner: "self", kw: "overlay gnosis reader margin esoteric glyph" },
  { key: "overlayTalmud", label: "Reader overlay · Talmud", kind: "toggle", group: "READING", owner: "self", kw: "overlay talmud reader margin rabbinic glyph" },
  { key: "overlayCommentary", label: "Reader overlay · Commentary", kind: "toggle", group: "READING", owner: "self", kw: "overlay commentary reader margin voices glyph" },
  // INSTRUMENTS
  { key: "continuityEnabled", label: "Continuity layer", kind: "toggle", group: "INSTRUMENTS", owner: "self", kw: "continuity streak engagement mastery analyst quests" },
  { key: "continuityThreshold", label: "Depth actions per day", kind: "slider", group: "INSTRUMENTS", owner: "self", kw: "continuity threshold depth actions per day" },
  { key: "notifyCadence", label: "Announcements", kind: "segment", group: "INSTRUMENTS", owner: "self", kw: "announcements milestones toasts cadence notifications quiet" },
  { key: "gnosis", label: "Gnosis overlay", kind: "external", group: "INSTRUMENTS", owner: "external", kw: "gnosis overlay esoteric ring engaged dormant" },
  { key: "modules", label: "Module marketplace", kind: "action", group: "INSTRUMENTS", owner: "child", kw: "modules marketplace plugins install browse" },
  // SYSTEM
  { key: "lang", label: "Language", kind: "select", group: "SYSTEM", owner: "child", kw: "language english español deutsch français idioma langue sprache" },
  { key: "install", label: "Install CODEX", kind: "action", group: "SYSTEM", owner: "child", kw: "install pwa app offline home screen standalone" },
  { key: "sync", label: "Cross-device sync", kind: "panel", group: "SYSTEM", owner: "child", kw: "sync cross device qr transfer" },
  { key: "dataPortable", label: "Export / import everything", kind: "action", group: "SYSTEM", owner: "child", kw: "export import backup restore json portable data" },
  { key: "cache", label: "Cache & offline status", kind: "panel", group: "SYSTEM", owner: "child", kw: "cache offline chapters panels clear storage status" },
  { key: "offlineBibles", label: "Offline Bibles", kind: "panel", group: "SYSTEM", owner: "child", kw: "offline bibles download bundles translations" },
  { key: "bootIntro", label: "Boot intro sequence", kind: "toggle", group: "SYSTEM", owner: "child", kw: "boot intro animation startup terminal first impression" },
  { key: "keyboard", label: "Keyboard shortcuts", kind: "action", group: "SYSTEM", owner: "child", kw: "keyboard shortcuts keys reference arrows" },
  { key: "tour", label: "Welcome tour", kind: "action", group: "SYSTEM", owner: "self", kw: "tour welcome replay onboarding first run" },
  // DANGER
  { key: "personalization", label: "Clear personalization", kind: "action", group: "DANGER", owner: "self", kw: "personalization profile taste reels oracle context clear privacy" },
  { key: "factoryReset", label: "Factory reset (settings only)", kind: "action", group: "DANGER", owner: "child", kw: "reset factory defaults wipe settings danger" },
];

// Route an unknown (newly registered) tweak key to a group by its name.
export function groupForKey(k: string): string {
  const s = String(k);
  if (/yhwh|golden|tetragram|sacred|name/i.test(s)) return "THE NAME";
  if (/overlay|font|letter|verse|scripture|translat|interlinear|margin/i.test(s)) return "SCRIPTURE";
  if (/theme|accent|scanline|glow|light|dark|palette/i.test(s)) return "APPEARANCE";
  if (/oracle|provider|model|api|drift|engine/i.test(s)) return "AI & KEYS";
  if (/note|mark|highlight|caffeinate|read|distraction/i.test(s)) return "READING";
  if (/continuity|quest|engage|gnosis|reel|cadence/i.test(s)) return "INSTRUMENTS";
  return "SYSTEM";
}

export function humanize(k: string): string {
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function inferKind(v: unknown): string {
  if (typeof v === "boolean") return "toggle";
  if (typeof v === "number") return "number";
  return "text";
}

// Section-label → group routing for host-provided children. Covers the
// canonical English labels plus the i18n variants app.jsx may emit.
export function groupForSection(label: string): string {
  const FIXED: Record<string, string> = {
    "AI Engines": "AI & KEYS", "AI Model": "AI & KEYS", "Advanced inference": "AI & KEYS",
    Modules: "INSTRUMENTS", Continuity: "INSTRUMENTS",
    "Danger zone": "DANGER",
    "First impression": "SYSTEM", Keyboard: "SYSTEM", Install: "SYSTEM",
    "Cross-device sync": "SYSTEM", Shell: "SYSTEM", Personalization: "DANGER",
    Deck: "SYSTEM",
  };
  if (FIXED[label] != null) return FIXED[label];
  const lc = String(label || "").toLowerCase();
  if (/look|apari|aparê|erschein|apparen|aspect|glamour|מראה|रूप/.test(lc)) return "APPEARANCE";
  if (/marks|marcas|marques|markier|notae/.test(lc)) return "READING";
  if (/reading|lectura|leitur|lectur|lesen/.test(lc)) return "READING";
  if (/ai|engine|drift|infer|motor/.test(lc)) return "AI & KEYS";
  if (/sync|sincron|cache|caché|offline|export|import|bibles|biblias|portab|dados|daten|données|data/.test(lc)) return "SYSTEM";
  if (/danger|peligro|gefahr|zone/.test(lc)) return "DANGER";
  if (/language|idioma|langue|sprache|install|instalar|installation|module|keyboard|teclado|tastatur|clavier/.test(lc)) return "SYSTEM";
  if (/continuity|continuidad|engage/.test(lc)) return "INSTRUMENTS";
  return "SYSTEM";
}

// Search keywords injected per child section so plain words hit even when the
// rendered text says something else.
export const SECTION_KW: Record<string, string> = {
  "AI Engines": "api key keys secret token anthropic claude grok xai groq gemini google ollama local engine active",
  "AI Model": "ai model provider engine anthropic claude grok groq gemini ollama test ping",
  "Advanced inference": "drift hermeneutic experimental easter",
  Look: "appearance accent color scanlines palette day light dark theme",
  Marks: "marks highlight color clear amber cyan violet green rose",
  Reading: "reading caffeinate awake notes oracle font size bundle translations",
  "Cross-device sync": "sync cross device transfer qr",
  Install: "install pwa offline app home screen",
  Cache: "cache offline chapters panels clear storage",
  "Offline · Bibles": "offline bibles download bundle",
  "Data · portable": "export import backup restore json data portable",
  "First impression": "boot intro animation startup",
  Keyboard: "keyboard shortcuts keys arrows",
  "Danger zone": "reset factory defaults wipe danger",
  Modules: "modules marketplace plugins",
  Language: "language english idioma langue sprache",
};

export function isLight(hex: string): boolean {
  const h = String(hex).replace("#", "");
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, "0");
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
