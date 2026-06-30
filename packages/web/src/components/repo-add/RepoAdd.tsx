// repo-add — RepoAdd React component (faithful port from legacy/repo-add.jsx).
// Renders an expandable panel for discovering and adding custom Bible
// translations at runtime. Persists repos to localStorage and merges them into
// window.CODEX_DATA.translations.
import React from "react";
import type { Repo, CatalogEntry } from "./data.js";
import { PROVIDER_CATALOG } from "./data.js";
import { loadRepos, saveRepos } from "./helpers.js";
import { rw } from "./repo-add-window.js";

const { useState } = React;

export interface RepoAddProps {
  onAdded?: (repo: Repo) => void;
}

export function RepoAdd({ onAdded }: RepoAddProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("bolls");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const existing = new Set((rw().CODEX_DATA?.translations || []).map(t => t.id));
  const catalog: CatalogEntry[] = PROVIDER_CATALOG[provider] || [];
  const needle = q.trim().toLowerCase();
  const results = catalog.filter(c =>
    !existing.has(c.id) &&
    (!needle ||
      c.id.includes(needle) ||
      c.name.toLowerCase().includes(needle) ||
      (c.apiId || "").toLowerCase().includes(needle))
  );

  const add = async (entry: CatalogEntry): Promise<void> => {
    setBusy(entry.id); setErr("");
    const repo: Repo = {
      id: entry.id,
      name: entry.name,
      year: entry.year || "—",
      license: "User-added",
      glyph: (entry.apiId || entry.id).toUpperCase().slice(0, 5),
      lang: entry.lang || "EN",
      source: provider,
      apiId: entry.apiId || entry.id,
    };
    // Verify it loads — Genesis 1 is the canonical probe.
    try {
      // NOTE: both branches of the ternary are identical (preserved quirk from v1).
      await rw().BIBLE?.loadChapter("gen", 1, repo.id === repo.apiId ? repo.id : repo.id);
      // bible.js looks up source/apiId via CODEX_DATA, so register first then probe.
    } catch {}
    // Register in-memory + persisted.
    // NOTE: CODEX_DATA! mirrors legacy — will throw at runtime if absent (preserved quirk).
    const data = rw().CODEX_DATA!;
    if (!data.translations.find(t => t.id === repo.id)) {
      data.translations.push(repo);
      try { window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: repo.id } })); } catch {}
    }
    const stored = loadRepos();
    if (!stored.find(r => r.id === repo.id)) { stored.push(repo); saveRepos(stored); }
    // Probe again to actually warm the cache now that registration is complete.
    try {
      await rw().BIBLE?.loadChapter("gen", 1, repo.id);
    } catch (e: unknown) {
      const desc = (e as { message?: string }).message || String(e);
      setErr(`Couldn't reach ${repo.name}: ${desc}`);
    }
    setBusy(null);
    onAdded?.(repo);
  };

  return (
    <div className={`cx-repo ${open ? "is-open" : ""}`}>
      <button className="cx-repo-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "× close" : "+ add a corpus"}
      </button>
      {open ? (
        <div className="cx-repo-panel">
          <div className="cx-repo-providers">
            {Object.keys(PROVIDER_CATALOG).map(p => (
              <button key={p}
                className={`cx-repo-prov ${provider === p ? "is-on" : ""}`}
                onClick={() => setProvider(p)}>
                {p}
              </button>
            ))}
          </div>
          <input
            className="cx-repo-input"
            placeholder="Search · niv, septuagint, msg…"
            value={q}
            onChange={e => setQ(e.target.value)}
            spellCheck={false}
            autoFocus
          />
          <ul className="cx-repo-results">
            {results.length === 0 ? (
              <li className="cx-repo-empty">— {existing.size > 9 ? "all known repos already added" : "no match in catalog"} —</li>
            ) : results.slice(0, 12).map(r => (
              <li key={r.id} className="cx-repo-result">
                <span className="cx-repo-r-name">
                  <b>{r.name}</b>
                  <i>{r.year} · {r.apiId}{r.lang && r.lang !== "EN" ? " · " + r.lang : ""}</i>
                </span>
                <button
                  className="cx-repo-add"
                  onClick={() => add(r)}
                  disabled={busy === r.id}
                >{busy === r.id ? "…" : "+ add"}</button>
              </li>
            ))}
          </ul>
          {err ? <p className="cx-repo-err">{err}</p> : null}
          <p className="cx-repo-hint">
            Repos cache locally — every chapter you read is kept for offline study.
          </p>
        </div>
      ) : null}
    </div>
  );
}
