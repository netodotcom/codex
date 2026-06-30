// repo-add — storage helpers (faithful port from legacy/repo-add.jsx).
// loadRepos / saveRepos are pure localStorage calls.
// removeRepo also mutates the in-memory CODEX_DATA translations list —
// same side-effects as v1.
import type { Repo } from "./data.js";
import { rw } from "./repo-add-window.js";

export const REPOS_KEY = "codex.repos.v1";

export function loadRepos(): Repo[] {
  try { return JSON.parse(localStorage.getItem(REPOS_KEY) || "[]") as Repo[]; }
  catch { return []; }
}

export function saveRepos(list: Repo[]): void {
  try { localStorage.setItem(REPOS_KEY, JSON.stringify(list)); } catch {}
}

// Remove a user-added repo by id. Drops it from CODEX_DATA.translations,
// from the persisted store, and purges any cached chapters so the slot is
// fully recoverable. Returns true if anything was removed.
export function removeRepo(id: string): boolean {
  const data = rw().CODEX_DATA;
  if (!data) return false;
  const stored = loadRepos();
  const next = stored.filter(r => r.id !== id);
  if (next.length === stored.length) return false; // not user-added
  saveRepos(next);
  data.translations = data.translations.filter(t => t.id !== id);
  try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id } })); } catch {}
  // Purge cache entries for this translation.
  try {
    const cache = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}") as Record<string, unknown>;
    let dirty = false;
    for (const k of Object.keys(cache)) {
      if (k.endsWith("." + id)) { delete cache[k]; dirty = true; }
    }
    if (dirty) localStorage.setItem("codex.bible.cache.v2", JSON.stringify(cache));
  } catch {}
  return true;
}
