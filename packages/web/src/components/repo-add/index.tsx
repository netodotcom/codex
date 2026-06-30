// repo-add — migrated feature entry. Replaces legacy/deleted/dist/repo-add.js
// in the Vite build (gen-web-entry maps it). Runs bootstrapRepos() (merges any
// previously persisted custom translations into CODEX_DATA.translations at
// module load), then exposes the EXACT same four window globals the legacy
// IIFE set via Object.assign(window, {...}):
//   window.RepoAdd, window.loadRepos, window.saveRepos, window.removeRepo
import { RepoAdd } from "./RepoAdd.js";
import { loadRepos, saveRepos, removeRepo } from "./helpers.js";
import { rw } from "./repo-add-window.js";

// Merge stored repos into the global translations array exactly once on boot
// (faithful port of the legacy IIFE).
(function bootstrapRepos(): void {
  const stored = loadRepos();
  if (!stored.length) return;
  const data = rw().CODEX_DATA;
  if (!data) return;
  const have = new Set(data.translations.map(t => t.id));
  for (const r of stored) if (!have.has(r.id)) {
    data.translations.push(r);
    try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: r.id } })); } catch {}
  }
})();

// Expose same surface as v1 (engines outlive skins).
Object.assign(rw(), { RepoAdd, loadRepos, saveRepos, removeRepo });
