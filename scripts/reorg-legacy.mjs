// One-shot reorg: move the un-migrated legacy app (its .jsx source, the runtime
// .js modules index.html loads, and the committed dist/ Babel output) into a
// legacy/ folder so the repo root reads clean. Non-destructive + reversible:
// nothing is deleted, only moved + path references rewritten. Kept at root:
// index.html (entry), server.js, cli.js, sw.js (service-worker scope), config,
// css, data/, the new packages/ vendor/ scripts/.
//
//   node scripts/reorg-legacy.mjs
import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY = join(ROOT, "legacy");

const html = readFileSync(join(ROOT, "index.html"), "utf8");

// Local <script src> files (bar https). dist/* and bare root .js both load here.
const srcRe = /<script\b[^>]*\bsrc="(?!https?:)([^"]+\.js)"[^>]*>/g;
const srcs = [];
let m;
while ((m = srcRe.exec(html))) srcs.push(m[1]);
// bare root .js (no slash) — these MOVE. (server.js/cli.js/sw.js aren't here.)
const movedJs = [...new Set(srcs.filter((s) => !s.includes("/")))];
// every root .jsx source moves too.
const movedJsx = readdirSync(ROOT).filter((f) => f.endsWith(".jsx"));

mkdirSync(LEGACY, { recursive: true });
let moved = 0;
for (const f of [...movedJs, ...movedJsx]) {
  if (existsSync(join(ROOT, f))) {
    renameSync(join(ROOT, f), join(LEGACY, f));
    moved++;
  }
}
if (existsSync(join(ROOT, "dist")) && !existsSync(join(LEGACY, "dist"))) {
  renameSync(join(ROOT, "dist"), join(LEGACY, "dist"));
  moved++;
}

// ── rewrite index.html script srcs ──
let html2 = html.replace(/src="dist\//g, 'src="legacy/dist/');
for (const f of movedJs) html2 = html2.split(`src="${f}"`).join(`src="legacy/${f}"`);
writeFileSync(join(ROOT, "index.html"), html2);

// ── rewrite sw.js precache (r("…")) — dist/* + the moved root .js only ──
let sw = readFileSync(join(ROOT, "sw.js"), "utf8");
sw = sw.replace(/r\("dist\//g, 'r("legacy/dist/');
for (const f of movedJs) sw = sw.split(`r("${f}")`).join(`r("legacy/${f}")`);
writeFileSync(join(ROOT, "sw.js"), sw);

console.log(`[reorg] moved ${moved} entries → legacy/  (${movedJsx.length} .jsx, ${movedJs.length} .js, dist/)`);
console.log(`[reorg] moved .js: ${movedJs.join(", ")}`);
