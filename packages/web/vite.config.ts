import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { copyFileSync, existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

// Copy legacy runtime assets that live at the repo root and are referenced by
// relative path at runtime (not via the module graph), so the built bundle in
// dist-web/ boots with parity. (data/ is large and fetched lazily — handled by
// the PWA/serving layer in 1.3/1.5; sw.js must exist so SW registration is 200.)
function copyLegacyRuntimeAssets(): Plugin {
  const files = ["sw.js", "fresh.css"];
  return {
    name: "codex:copy-legacy-runtime-assets",
    apply: "build",
    closeBundle() {
      for (const f of files) {
        const src = resolve(repoRoot, f);
        if (existsSync(src)) copyFileSync(src, resolve(repoRoot, "dist-web", f));
      }
    },
  };
}

// Backlog 1.2 — boot the legacy app under Vite for parity, before migrating any
// module. Vite serves the existing index.html + its classic <script> graph from
// the repo root. Nothing is bundled or migrated yet; the parity probe is the gate.
export default defineConfig({
  root: repoRoot,
  // Relative asset URLs so the built app boots from any mount point — the local
  // Node server at "/" AND GitHub Pages at "/codex/". Absolute "/assets/…" would
  // 404 on the Pages subpath. (Cutover: index.html is now the built bundle.)
  base: "./",
  publicDir: false,
  plugins: [copyLegacyRuntimeAssets()],
  // Migrated .tsx `import React from "react"` → the legacy CDN window.React, so
  // the app shares one React instance during the incremental migration (4.0).
  resolve: {
    alias: { react: resolve(here, "src/react-shim.ts") },
  },
  // Classic JSX (CDN React has no jsx-runtime); components keep React in scope.
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  server: {
    host: "127.0.0.1", // bind IPv4 so the parity probe's default URL resolves
    port: 5180,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  // The legacy app loads globals via classic scripts + CDN; don't pre-bundle.
  optimizeDeps: { noDiscovery: true, include: [] },
  build: {
    outDir: resolve(repoRoot, "dist-web"),
    emptyOutDir: true,
    // index.src.html is the hand-authored source shell; its module entry
    // (packages/web/src/main.ts) pulls every engine + feature into the graph.
    rollupOptions: {
      input: resolve(repoRoot, "index.src.html"),
      // Stable, hash-free output names. The app already busts caches via the
      // service-worker VERSION bump (sw.js), so content hashes are redundant and
      // would force sw.js's precache list to be regenerated every build. Stable
      // names keep the committed index.html + sw.js hand-readable and diffable.
      output: {
        entryFileNames: "assets/codex.js",
        chunkFileNames: "assets/codex-[name].js",
        assetFileNames: (info) => {
          // All CSS (the html-linked styles.css/fresh.css + component imports)
          // is merged by Vite into one entry stylesheet → stable codex.css.
          const name = info.name || "";
          if (name.endsWith(".css")) return "assets/codex.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
