// promote-build.mjs — the Vite cutover's final step.
//
// Vite builds the source shell index.src.html (its module entry is
// packages/web/src/main.ts) and emits dist-web/index.src.html + assets/. This
// copies that up to the repo root so the committed, hand-servable app IS the
// TypeScript build:
//   dist-web/index.src.html → index.html   (the canonical entry, served at "/")
//   dist-web/assets/*        → assets/      (the stable-named bundle: codex.js/css)
//
// The app boots from the repo root via `node server.js` (and from GitHub Pages
// at "/codex/") with every root-relative runtime asset — data/, sw.js, icon.svg,
// styles.css, manifest — resolving exactly as before. base:"./" (vite.config.ts)
// keeps the asset URLs relative so both mount points work.
import { cpSync, rmSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-web");

if (!existsSync(join(DIST, "index.src.html"))) {
  console.error("[promote] dist-web/index.src.html not found — run the Vite build first.");
  process.exit(1);
}

// index.html ← the built entry (Vite emits it under the input's name).
cpSync(join(DIST, "index.src.html"), join(ROOT, "index.html"));

// assets/ ← the built bundle. Clear first so no stale files linger.
const destAssets = join(ROOT, "assets");
if (existsSync(destAssets)) rmSync(destAssets, { recursive: true, force: true });
mkdirSync(destAssets, { recursive: true });
cpSync(join(DIST, "assets"), destAssets, { recursive: true });

const files = readdirSync(destAssets).sort();
console.log(`[promote] dist-web → repo root · index.html + assets/ (${files.length} files: ${files.join(", ")})`);
