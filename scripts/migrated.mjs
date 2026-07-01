// Single source of truth for which legacy scripts are migrated to TS and where.
// gen-web-entry (build swap), stage-migrated (move to legacy/deleted/), and
// build-jsx (skip the frozen ones) all import from here. To migrate a feature:
// add its base name to ONE_TO_ONE (folder === name) or SPECIAL, then re-run
// stage-migrated + the build.

// Special cases: the legacy script name differs from the TS folder.
export const SPECIAL = {
  "legacy/deleted/direct-api.js": "./services/direct-api.js",
  "legacy/deleted/dist/app.js": "./app/index.js",
  "legacy/deleted/dist/components.js": "./components/reader/index.js", // reading surface → reader/
  "legacy/deleted/dist/tweaks-panel.js": "./components/settings/index.js",
};

// 1:1 — legacy/deleted/dist/<n>.js → ./components/<n>/index.js
export const ONE_TO_ONE = [
  // originally migrated
  "panels", "verse-map", "timeline",
  // reader plugin soul (reader.jsx) — merged into the reader/ folder (1:1 by name)
  "reader",
  // batch (parallel workflow)
  "vox", "constellation", "crossref", "continuity", "artifacts", "omnibar", "help",
  "passage-guide", "builder", "dictionary", "ai-quests", "reels", "mobile", "marketplace",
  "verse-mirror", "compare", "jewish-study", "word-study", "notes", "sword", "oracle2",
  "strongs", "quest-messiah", "ops", "translations", "verse-art", "intel", "library2",
  "verse-menu", "repo-add", "verse-compare", "winhost", "marks-plugin", "textflow",
  "plans",
];

// Runtime engines (foundational .js, NOT .jsx — no dist build). Plain
// legacy/<n>.js → ./runtime/<n>/index.js, exactly like direct-api. Migrated in
// dependency-ordered waves; each is self-contained with its own window boundary.
export const ENGINES = [
  // wave 1 (leaf + probe-tracked globals)
  "version", "observability", "light-themes", "mark-search", "gematria", "modules",
  // wave 2 (foundational small/medium: data + plugins are probe-tracked)
  "data", "plugins", "boot-contract", "auto-cache", "sync", "shell", "displays", "ai-translate-ui",
  // wave 3 (large foundational: i18n + bible are probe-tracked via t/BIBLE)
  "i18n", "bible", "engagement", "wm", "search", "panels-gen", "kernel",
];

export const MIGRATED = {
  ...SPECIAL,
  ...Object.fromEntries(ONE_TO_ONE.map((n) => [`legacy/deleted/dist/${n}.js`, `./components/${n}/index.js`])),
  ...Object.fromEntries(ENGINES.map((n) => [`legacy/deleted/${n}.js`, `./runtime/${n}/index.js`])),
};

// Base names whose .jsx + dist/<n>.js move to legacy/deleted/ and that build-jsx
// must SKIP (their dist is frozen — they're TS now). Includes the .jsx-sourced
// specials (app/components/tweaks-panel) but NOT direct-api (it's plain .js).
export const STAGED_JSX = ["app", "components", "tweaks-panel", ...ONE_TO_ONE];
// Plain .js moved legacy/<n>.js → legacy/deleted/<n>.js + src repointed: direct-api + the runtime engines.
export const STAGED_JS = ["direct-api", ...ENGINES];
