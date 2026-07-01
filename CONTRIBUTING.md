# Contributing to CODEX

Thanks for showing up. CODEX is open-source and still **fork-and-go** — a fresh clone runs with
zero install (`node server.js`) because the built bundle is committed. To *change* the app you now
work in a small TypeScript monorepo bundled with Vite. This guide explains how.

Companion docs: [`SPEC.md`](./docs/SPEC.md) (the formal extension spec) · [`MODULES.md`](./docs/MODULES.md) (data modules) · [`API.md`](./docs/API.md) (window globals + events) · [`ROADMAP.md`](./docs/ROADMAP.md).

---

## 1. Philosophy

We are building an **open-source alternative to Logos** that respects attention, multiple traditions, and the reader's intelligence.

1. **Open source first.** Everything that ships in `main` is permissively licensed and inspectable. No closed binaries, no obfuscation. Where a corpus is restricted, we prefer to ship a public-domain alternative.
2. **Distraction-respectful.** No popups. No streaks. No badges for opening the app. Notifications are off by default. The default state of every UI affordance is *quiet*.
3. **Multi-tradition.** Jewish, Catholic, Orthodox, Protestant, charismatic, academic, esoteric. CODEX surfaces parallels without claiming a winner. Scholarship, not proselytising.
4. **AI-native but optional.** Oracle, panel generation, and translation drift are powerful when on, but the app reads scripture beautifully with the network unplugged and zero LLM access.
5. **Zero-install to *run*, one command to *build*.** The committed bundle (`index.html` + `assets/`) means anyone can fork and open it with no toolchain. Changing the app means editing TypeScript and running `npm run build` — the built bundle is committed alongside the source.

If a feature pulls in any direction opposite these, expect pushback.

---

## 2. Run it locally

Running needs nothing but Node — the committed build boots as-is:

```bash
git clone <fork-url> codex
cd codex
node server.js          # → http://localhost:7777
```

That's it — no `npm install` to just use CODEX. Open `http://localhost:7777`. The server binds
`127.0.0.1` (localhost only) by default; the `/api/chat` proxy spends your API key with no auth,
so don't expose it. Use `node server.js --lan` to reach it from a phone on a trusted Wi-Fi.

Optional: drop an `.env` with `ANTHROPIC_API_KEY=sk-ant-…` (or `XAI_API_KEY`, `GROQ_API_KEY`,
`GEMINI_API_KEY`) to try Oracle and panel generation. The app works completely offline without it.
For local LLMs, run [Ollama](https://ollama.com) on `localhost:11434` — `/api/health` discovers it.

### Developing (changing the app)

```bash
npm install         # dev tooling only (Vite, Vitest, TypeScript) — no runtime deps, no lockfile committed
npm run dev         # Vite dev server + HMR → http://127.0.0.1:5180/index.src.html
npm run typecheck   # strict tsc across packages/core + packages/web
npm test            # full Vitest suite (jsdom)
npm run build       # bundle + promote index.html + assets/ to the repo root (the committed build)
npm run parity      # headless-Chrome boot-parity probe vs the golden signature
```

**Commit the rebuilt bundle with your source change.** `npm run build` bundles `index.src.html`
(whose module entry is `packages/web/src/main.ts`) into `assets/codex.js` + `assets/codex.css`
and promotes `index.html` + `assets/` to the repo root. CI fails if `index.html`/`assets/` drift
from source, so always run the build and stage the result.

---

## 3. File map

```
index.src.html          ── SOURCE HTML shell (edit this — the CDN tags, <head>, #root)
index.html              ── GENERATED, committed build entry (do NOT hand-edit)
assets/codex.js|css     ── GENERATED, committed Vite bundle
server.js               ── Node std-lib HTTP server + multi-provider AI proxy (no deps)
sw.js                   ── service worker (precaches the bundle + small data; VERSION bump busts cache)
cli.js                  ── optional terminal client (read scripture / Oracle from the shell)

packages/core/src/      ── framework-free shared logic (bundled to the browser AND the Node server)
  refs.ts gematria.ts data.ts modules.ts bible.ts marks.ts i18n.ts panels.ts search.ts llm/

packages/web/src/       ── the app (TypeScript + classic-JSX React)
  main.ts               ── the entry: side-effect imports of every engine+feature, IN LOAD ORDER
  runtime/<name>/       ── foundational engines: bible, search, wm, kernel, plugins, sync, …
                           each has <name>-window.ts (the ONLY place window is cast),
                           helpers.ts, types.ts, index.ts (load-time side effects), *.test.ts
  components/<name>/     ── feature panels/plugins: reader, crossref, strongs, vox, plans, …
                           each is a self-registering plugin (index.tsx)
  services/direct-api.ts ── browser-direct AI client (BYO key, skips the server)

scripts/                ── promote-build.mjs (build → root), parity-probe.mjs (boot-parity gate),
                           build-server-llm.mjs (core/llm → CJS for server.js) + manual smoke/QA tools

data/                   ── shipped JSON: modules/ (SPEC §4 / MODULES.md), help/articles.json, verses, …
styles.css · fresh.css  ── global CSS (Vite folds these into assets/codex.css)
manifest.json · icon.svg ── PWA manifest + app icon
```

The build pipeline is deliberately tiny: `vite build` bundles `index.src.html` (entry:
`main.ts`) → `dist-web/` → `promote-build.mjs` copies the result to `index.html` + `assets/`.

---

## 4. Coding conventions

- **TypeScript, strict.** `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `verbatimModuleSyntax`. Relative imports use the `.js` extension even for `.ts` sources (e.g. `import { x } from "./helpers.js"`); use `import type` for type-only imports.
- **Classic JSX.** `import React from "react"`; components keep React in scope (esbuild `jsxFactory: React.createElement`). React itself comes from the CDN (one shared `window.React` instance) — don't add it to the bundle.
- **`.tsx`** for files containing JSX, **`.ts`** for plain TypeScript.
- **The window boundary.** Every runtime engine touches globals only through its `<name>-window.ts` — a typed interface plus an accessor (`function xw(): XWindow { return window as unknown as XWindow; }`). That file is the SOLE home of `window as …` casts. Don't scatter `window as any` elsewhere.
- **No runtime npm dependencies you don't need.** `server.js` is Node std-lib only. The browser bundle stays lean; think hard before adding a dependency.
- **2-space indent**, semicolons, double quotes in TS, single in JSX attributes. Match what you see nearby.
- **Comment the *why*.** The code says *what*; comments explain *why this approach*. Read the headers of `runtime/plugins/`, `runtime/kernel/`, `runtime/bible/` for the house style.
- **One file = one concern.** Split along a natural seam before a file gets unwieldy.

---

## 5. Adding a new translation

Translations live in the bible engine (`packages/web/src/runtime/bible/`). The general pattern:

1. Register the translation in the translations table (id, label, language, default versification, fetcher).
2. Provide a fetcher that returns `{ verses: [{ n, text }] }` for `(book, chapter)` — any API, or bundled JSON.
3. Special needs (Hebrew RTL, Greek polytonic, red-letter overrides, YHWH restoration) wire into the existing overlay system.
4. Add a Vitest case (and a manual smoke: switch to your translation, verify a few passages).

For a self-contained text (no external API), bundle the JSON under `data/<your-id>/` and read from there; the service worker picks it up automatically.

---

## 6. Writing a panel (plugin)

The plugin runtime contract is unchanged — a plugin self-registers by pushing onto `window.CODEX_PLUGINS`:

```ts
// packages/web/src/components/hello-world/index.tsx
import { pw } from "./hello-world-window.js"; // window boundary
pw().CODEX_PLUGINS = pw().CODEX_PLUGINS || [];
pw().CODEX_PLUGINS.push({
  id: "hello-world",
  name: "Hello World",
  version: "0.1.0",
  panels: [{
    id: "hello", label: "Hello", glyph: "✦",
    render({ book, chapter, verse }) {
      return React.createElement("div", null, `Hello from ${book} ${chapter}:${verse ?? "?"}`);
    },
  }],
});
```

The difference from the old no-build world: instead of a `<script>` in `index.html`, your panel is a
TypeScript module under `packages/web/src/components/<name>/`. Add its import to
`packages/web/src/main.ts` at the right load position, then run `npm run build` and commit the
result. Full lifecycle, ctx shape, and event hooks: [`SPEC.md` §3](./docs/SPEC.md#3-plugin-spec).

---

## 7. Writing a help article

Open `data/help/articles.json`. Add an object to the `articles` array:

```jsonc
{
  "id": "my-article",                 // required, kebab-case, unique
  "title": "My Article",              // required
  "category": "Developer",            // must match one in `categories`
  "tags": ["plugin", "module"],       // for in-wiki search
  "lastUpdated": "2026-05-18",
  "body": "# Heading\n\nMarkdown content…"
}
```

Bump the file's top-level `"updated"` date. The Help Wiki picks it up on next load — no code changes needed.

---

## 8. Commit messages

Conventional-style, short imperative subject:

```
feat: add Greek concordance module
fix: panels-gen cache key collides across languages
docs: clarify plugin lifecycle in SPEC.md
refactor: split notes into notes-store + notes-ui
perf: lazy-load gematria index on first panel open
chore: bump sw VERSION to v271
```

The body (optional) explains *why*. Wrap at ~72 chars. One commit per logical change.

---

## 9. Pull requests

A good PR:

1. **Has a focused title** matching the commit style above.
2. **Explains the user-visible change** in 2-3 sentences. Screenshots / short screencaps for UI work.
3. **Passes the gates.** `npm run typecheck` and `npm test` are green, and `npm run build` was run so the committed `index.html`/`assets/` match your source (CI enforces this).
4. **Notes any storage / cache / SW version bumps.** If you change a `codex.*.v<N>` key shape, bump the suffix and migrate on read. If you touch the shell, bump `VERSION` in `sw.js` (mirror it in `packages/web/src/runtime/version/`).
5. **Updates docs.** New window global → document it in [`API.md`](./docs/API.md). New module type → update [`SPEC.md`](./docs/SPEC.md) §4 and [`MODULES.md`](./docs/MODULES.md). New user-facing feature → add a help article.
6. **Stays small.** Big PRs get split. For something large, post a short design note in an issue first.

### Etiquette

- Don't bundle unrelated changes.
- Don't re-format files you didn't touch.
- Don't hand-edit the generated build output (`index.html`, `assets/`) — change the source (`index.src.html`, `main.ts`, `packages/`) and rebuild.
- Think twice before adding a runtime dependency (browser bundle or `server.js`).
- If you're not sure whether a change fits, open a draft PR or an issue — we'd rather chat early than ask you to redo work.

---

## 10. Code of conduct

Be kind. Disagree with ideas, not people. Assume the other person is smart and acting in good faith. Apologise quickly when you slip. If a thread is getting hot, walk away for an hour.

CODEX exists at a busy intersection of traditions. We host all of them with curiosity and refuse none of them by default. Discussion that proselytises, mocks, or dismisses any tradition will be moderated.

That's the whole thing.

---

## 11. Where to go next

- The formal spec: [`SPEC.md`](./docs/SPEC.md)
- Modules tutorial: [`MODULES.md`](./docs/MODULES.md)
- API reference: [`API.md`](./docs/API.md)
- The roadmap (what we'd love help with): [`ROADMAP.md`](./docs/ROADMAP.md)

Welcome aboard.
