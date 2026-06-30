// Move already-migrated legacy artifacts into legacy/deleted/ — a staging area
// for files that now have a TypeScript replacement (packages/web/src/…). They're
// kept (not deleted) until the whole migration is validated; then the folder can
// be dropped. References are repointed so BOTH paths keep working:
//   · index.html (legacy path) loads them from legacy/deleted/
//   · gen-web-entry still swaps them for the TS module in the Vite build
//   · build-jsx SKIPS them (their dist is frozen — they're TS now)
//
// As more features migrate, add their base name to STAGED and re-run.
//   node scripts/stage-migrated.mjs
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STAGED_JSX, STAGED_JS } from "./migrated.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const L = (p) => join(ROOT, "legacy", p);
const D = (p) => join(ROOT, "legacy", "deleted", p);
mkdirSync(join(ROOT, "legacy", "deleted", "dist"), { recursive: true });

let movedCount = 0;
const moveIfPresent = (from, to) => {
  if (existsSync(from) && !existsSync(to)) {
    renameSync(from, to);
    movedCount++;
  }
};

for (const n of STAGED_JSX) {
  moveIfPresent(L(`${n}.jsx`), D(`${n}.jsx`));
  moveIfPresent(L(`dist/${n}.js`), D(`dist/${n}.js`));
}
for (const n of STAGED_JS) {
  moveIfPresent(L(`${n}.js`), D(`${n}.js`));
}

// Repoint index.html + sw.js: legacy/dist/<n>.js → legacy/deleted/dist/<n>.js,
// legacy/<n>.js → legacy/deleted/<n>.js. Idempotent (skips already-repointed).
const repoint = (text) => {
  for (const n of STAGED_JSX) {
    text = text.split(`legacy/dist/${n}.js`).join(`legacy/deleted/dist/${n}.js`);
    // undo any accidental double-prefix from re-runs
    text = text.split(`legacy/deleted/dist/${n}.js`).join(`legacy/deleted/dist/${n}.js`);
  }
  for (const n of STAGED_JS) {
    text = text.split(`"legacy/${n}.js`).join(`"legacy/deleted/${n}.js`);
  }
  return text;
};
for (const file of ["index.html", "sw.js"]) {
  const p = join(ROOT, file);
  writeFileSync(p, repoint(readFileSync(p, "utf8")));
}

console.log(`[stage] ${movedCount} files → legacy/deleted/  ·  staged: ${[...STAGED_JSX, ...STAGED_JS].join(", ")}`);
