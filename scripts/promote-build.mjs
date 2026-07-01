// promote-build.mjs — the Vite cutover's final step.
//
// After `vite build` emits the bundle to dist-web/, this copies it up to the
// repo root so the committed, hand-servable app IS the TypeScript build:
//   dist-web/index.vite.html → index.html   (the canonical entry, served at "/")
//   dist-web/assets/*         → assets/      (the stable-named bundle: codex.js/css)
//
// The app boots from the repo root via `node server.js` (and from GitHub Pages
// at "/codex/") with every root-relative runtime asset — data/, sw.js, icon.svg,
// styles.css, manifest — resolving exactly as before. base:"./" (vite.config.ts)
// keeps the asset URLs relative so both mount points work.
//
// The source template is index.src.html (gen-web-entry reads it); the raw legacy
// scripts under legacy/deleted/ are no longer loaded by anything after the build.
import { cpSync, rmSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist-web");

if (!existsSync(join(DIST, "index.vite.html"))) {
  console.error("[promote] dist-web/index.vite.html not found — run the Vite build first.");
  process.exit(1);
}

// index.html ← the built entry.
cpSync(join(DIST, "index.vite.html"), join(ROOT, "index.html"));

// assets/ ← the built bundle. Clear first so no stale files linger.
const destAssets = join(ROOT, "assets");
if (existsSync(destAssets)) rmSync(destAssets, { recursive: true, force: true });
mkdirSync(destAssets, { recursive: true });
cpSync(join(DIST, "assets"), destAssets, { recursive: true });

const files = readdirSync(destAssets).sort();
console.log(`[promote] dist-web → repo root · index.html + assets/ (${files.length} files: ${files.join(", ")})`);
