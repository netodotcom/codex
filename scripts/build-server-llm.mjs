// Bundle @codex/core/llm into a single committed CommonJS file the Node server
// can require(). The browser build (Vite) consumes the TS source directly, but
// `node server.js` (CJS) can't import the TS ESM package, so we ship a bundled
// CJS artifact — same "committed build" ethos as dist-web/. Re-run after editing
// anything under packages/core/src/llm/.
//
//   node scripts/build-server-llm.mjs   →  vendor/codex-llm.cjs
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: join(ROOT, "vendor"),
    emptyOutDir: false,
    minify: false,
    target: "node18",
    lib: {
      entry: join(ROOT, "packages", "core", "src", "llm", "index.ts"),
      formats: ["cjs"],
      fileName: () => "codex-llm.cjs",
    },
    rollupOptions: {
      // Self-contained: the llm module has no runtime deps, so nothing external.
      external: [],
      output: { exports: "named" },
    },
  },
});

console.log("[build-server-llm] vendor/codex-llm.cjs written");
