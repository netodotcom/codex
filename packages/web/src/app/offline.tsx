// app — offline/cache settings panels (migrated from app.jsx). OfflineBiblesPanel
// (per-translation status, test, repair, bundle, mass ops, updates), the
// OfflineStatus summary, and the CachedPanelsBrowser. Reads the BIBLE +
// CODEX_PANELS engines. NOTE: the legacy OfflineBiblesPanel declared its
// mass-op hooks AFTER an early return — a rules-of-hooks violation; here all
// hooks are hoisted above the early return.
import React from "react";
import { aw, cxToast, type AppBook, type UpdateEntry } from "./app-window.js";

const { useState, useEffect, useMemo } = React;

interface ResultEntry {
  phase?: string;
  ok?: boolean;
  summary?: string;
  // verifyTranslation returns arrays here; the checksum path returns counts —
  // hence `unknown` (both shapes flow through the same results map).
  missing?: unknown;
  corrupt?: unknown;
  passed?: boolean;
  smoke?: { ok: boolean; sample: string };
  cached?: number;
  total?: number;
  totalVerses?: number;
}
const arrLen = (x: unknown): number => (Array.isArray(x) ? x.length : 0);

export function OfflineBiblesPanel({ bookLookup }: { bookLookup: AppBook[] }): React.ReactElement {
  const [bumpKey, bump] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResultEntry>>({});
  const [diag, setDiag] = useState<{ backend: string; chapterCount: number; approxMB: number; quotaMB?: number } | null>(null);
  // Hoisted above the early return (legacy declared these after it).
  const [massBusy, setMassBusy] = useState<string | null>(null);
  const [massStatus, setMassStatus] = useState("");
  const [updates, setUpdates] = useState<UpdateEntry[] | null>(null);
  const [updateChoices, setUpdateChoices] = useState<Record<string, boolean>>({});
  const data = aw().CODEX_DATA;
  const BIBLE = aw().BIBLE;
  const bumpNow = (): void => bump((n) => n + 1);

  const refreshDiag = async (): Promise<void> => {
    if (!BIBLE?.storage?.diagnose) return;
    try {
      setDiag(await BIBLE.storage.diagnose());
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const onReady = (): void => {
      bumpNow();
      void refreshDiag();
    };
    window.addEventListener("codex:bible:ready", onReady);
    if (BIBLE?.ready) BIBLE.ready.then(onReady);
    return () => window.removeEventListener("codex:bible:ready", onReady);
  }, []);
  useEffect(() => {
    void refreshDiag();
  }, [bumpKey]);

  const translations = useMemo(() => {
    if (!BIBLE?.cacheStats) return [];
    return data.translations.map((t) => ({ t, stats: BIBLE.cacheStats(t.id, bookLookup) })).filter(({ stats }) => stats.cached > 0);
  }, [data.translations, bookLookup, bumpKey]);

  const offlineSmoke = async (tId: string): Promise<{ ok: boolean; sample: string }> => {
    const keys: Array<{ b: string; c: number }> = [];
    for (const b of bookLookup) for (let ch = 1; ch <= b.chapters; ch++) if (BIBLE.readOffline(b.id, ch, tId)) keys.push({ b: b.id, c: ch });
    const picks: Array<{ b: string; c: number }> = [];
    const pool = keys.slice();
    for (let i = 0; i < Math.min(5, pool.length); i++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    const samples: Array<{ ref: string; ok: boolean }> = [];
    const orig = window.fetch;
    window.fetch = () => Promise.reject(new Error("__OFFLINE_TEST__"));
    try {
      for (const k of picks) {
        try {
          const verses = await BIBLE.loadChapter(k.b, k.c, tId);
          const ok = Array.isArray(verses) && verses.length > 0 && typeof verses[0]?.text === "string" && (verses[0].text?.length ?? 0) > 4;
          samples.push({ ref: `${k.b} ${k.c}`, ok });
        } catch {
          samples.push({ ref: `${k.b} ${k.c}`, ok: false });
        }
      }
    } finally {
      window.fetch = orig;
    }
    const allOk = samples.length > 0 && samples.every((s) => s.ok);
    return { ok: allOk, sample: samples.length === 0 ? "no chapters to test" : `${samples.filter((s) => s.ok).length}/${samples.length} read offline · ${samples.map((s) => `${s.ref}${s.ok ? "✓" : "✗"}`).join(" ")}` };
  };

  const test = async (t: { id: string }): Promise<void> => {
    setBusy(t.id);
    setResults((r) => ({ ...r, [t.id]: { phase: "scanning…" } }));
    const v = BIBLE.verifyTranslation(t.id, bookLookup);
    const smoke = await offlineSmoke(t.id);
    setResults((r) => ({ ...r, [t.id]: { ...v, smoke } }));
    setBusy(null);
  };

  const repair = (t: { id: string }): void => {
    setBusy(t.id);
    setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `repairing 0…` } }));
    BIBLE.repairTranslation(t.id, bookLookup, (p) => {
      if (p.complete) {
        const cs = p.checksum;
        const phase = p.nothingToDo ? "nothing to repair" : cs?.passed ? `✓ checksum OK · ${cs.cached}/${cs.total} chapters · ${cs.totalVerses} verses` : `repair done · ${cs?.cached || "?"}/${cs?.total || "?"} cached · ${cs?.missing || 0} unrecoverable · ${cs?.corrupt || 0} corrupt`;
        setResults((r) => ({ ...r, [t.id]: { ...(cs || {}), smoke: r[t.id]?.smoke, phase } }));
        setBusy(null);
        bumpNow();
        return;
      }
      if (p.aborted) {
        setBusy(null);
        bumpNow();
        return;
      }
      const msg = p.phase === "retry" ? `retrying stragglers ${p.retryDone || 0}/${p.retryTotal || 0}` + (p.error ? ` (failed ${p.book} ${p.chapter})` : "") : `repairing ${p.done}/${p.total}` + (p.error ? ` (skipped ${p.book} ${p.chapter})` : "");
      setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: msg } }));
      if ((p.done || 0) % 25 === 0) bumpNow();
    });
  };

  const exportBundleFile = (t: { id: string }): void => {
    const bundle = BIBLE.storage!.exportBundle(t.id);
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setResults((r) => ({ ...r, [t.id]: { ...(r[t.id] || {}), phase: `exported ${bundle.chapterCount} chapters as ${t.id}.json — drop into /data/bibles/ to ship` } }));
  };

  const remove = (t: { id: string; name: string }): unknown => {
    if (!window.confirm(`Remove the offline copy of ${t.name}? Chapters re-fetch as you read.`)) return;
    const removed = BIBLE.removeTranslation(t.id);
    try {
      window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: t.id } }));
    } catch {
      /* ignore */
    }
    setResults((r) => {
      const x = { ...r };
      delete x[t.id];
      return x;
    });
    bumpNow();
    return removed;
  };

  const testAll = async (): Promise<void> => {
    setMassBusy("test");
    let pass = 0;
    let fail = 0;
    const list = translations.slice();
    for (const { t } of list) {
      setMassStatus(`testing ${t.name}… (${pass + fail + 1}/${list.length})`);
      const v = BIBLE.verifyTranslation(t.id, bookLookup);
      const smoke = await offlineSmoke(t.id);
      setResults((r) => ({ ...r, [t.id]: { ...v, smoke } }));
      if (smoke.ok) pass++;
      else fail++;
    }
    setMassStatus(`✓ TEST ALL complete · ${pass} ok · ${fail} with issues`);
    setMassBusy(null);
  };

  const repairAll = async (): Promise<void> => {
    if (!window.confirm(`Repair every cached translation (${translations.length})? This may take many minutes.`)) return;
    setMassBusy("repair");
    let i = 0;
    for (const { t } of translations) {
      i++;
      setMassStatus(`repairing ${t.name} · ${i}/${translations.length}`);
      await new Promise<void>((resolve) => {
        BIBLE.repairTranslation(t.id, bookLookup, (p) => {
          if (p.complete || p.aborted) {
            const cs = p.checksum;
            setResults((r) => ({ ...r, [t.id]: { ...(cs || {}), phase: cs?.passed ? `✓ ${cs.cached}/${cs.total} · ${cs.totalVerses} verses` : `done · ${cs?.cached}/${cs?.total}` } }));
            resolve();
          }
        });
      });
      bumpNow();
    }
    setMassStatus(`✓ REPAIR ALL complete`);
    setMassBusy(null);
  };

  const checkUpdates = async (): Promise<void> => {
    setMassBusy("check");
    setMassStatus("checking…");
    try {
      const list = await BIBLE.storage!.checkUpdates(aw().CODEX_DATA.translations);
      setUpdates(list);
      const initial: Record<string, boolean> = {};
      for (const u of list) initial[u.id] = !!u.hasUpdate;
      setUpdateChoices(initial);
      const have = list.filter((u) => u.hasUpdate).length;
      setMassStatus(have ? `${have} update${have > 1 ? "s" : ""} available` : "all up-to-date");
    } catch (e) {
      setMassStatus("check failed: " + ((e as Error).message || e));
    }
    setMassBusy(null);
  };

  const applyUpdates = async (): Promise<void> => {
    const targets = (updates || []).filter((u) => updateChoices[u.id]);
    if (!targets.length) return;
    setMassBusy("update");
    let i = 0;
    for (const u of targets) {
      i++;
      setMassStatus(`updating ${u.name} · ${i}/${targets.length}`);
      BIBLE.removeTranslation(u.id);
      try {
        window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: u.id } }));
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 100));
      await new Promise<void>((resolve) => {
        BIBLE.repairTranslation(u.id, bookLookup, (p) => {
          if (p.complete || p.aborted) resolve();
        });
      });
    }
    setMassStatus(`✓ updated ${targets.length} translation${targets.length > 1 ? "s" : ""}`);
    setUpdates(null);
    setMassBusy(null);
    bumpNow();
  };

  const onImportBundleFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const r = await BIBLE.storage!.importBundle(text);
      cxToast(`Imported ${r.imported} chapters of ${r.translation}.`, "ok");
      bumpNow();
      void refreshDiag();
    } catch (err) {
      cxToast("Import failed: " + ((err as Error).message || err), "err");
    }
    e.target.value = "";
  };

  if (translations.length === 0) {
    return (
      <p className="cx-export-hint" style={{ opacity: 0.6 }}>
        No bibles downloaded yet. Use the offline icon next to a translation in the Translations panel to save it for offline reading.
      </p>
    );
  }

  return (
    <div className="cx-ob">
      <div className="cx-ob-toolbar">
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length === 0} onClick={checkUpdates}>{massBusy === "check" ? "…" : "↻ CHECK UPDATES"}</button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length === 0} onClick={testAll}>{massBusy === "test" ? "…" : "✓ TEST ALL"}</button>
        <button className="cx-mini-btn" disabled={!!massBusy || translations.length === 0} onClick={repairAll}>{massBusy === "repair" ? "…" : "↺ REPAIR ALL"}</button>
      </div>
      {massStatus ? <p className="cx-ob-mass-status">{massStatus}</p> : null}

      {updates ? (
        <div className="cx-ob-updates">
          <header className="cx-ob-updates-h">
            <span>{updates.filter((u) => u.hasUpdate).length} update(s) available · pick which to apply</span>
            <button className="cx-mini-btn" onClick={() => setUpdates(null)}>✕</button>
          </header>
          <ul className="cx-ob-updates-list">
            {updates.length === 0 ? (
              <li className="cx-ob-empty">No cached translations to check.</li>
            ) : (
              updates.map((u) => {
                const ourDate = u.ourFetchedAt ? new Date(u.ourFetchedAt).toISOString().slice(0, 10) : "—";
                const srcDate = u.sourceUpdatedAt ? new Date(u.sourceUpdatedAt).toISOString().slice(0, 10) : "—";
                return (
                  <li key={u.id} className={`cx-ob-update-row ${u.hasUpdate ? "is-stale" : ""}`}>
                    <label>
                      <input type="checkbox" checked={!!updateChoices[u.id]} disabled={!u.hasUpdate} onChange={(e) => setUpdateChoices((c) => ({ ...c, [u.id]: e.target.checked }))} />
                      <span className="cx-ob-update-name">{u.name}</span>
                      <span className="cx-ob-update-meta">{u.hasUpdate ? <em>↑ source {srcDate} · ours {ourDate} ({u.ageDays}d old)</em> : u.source === "bible-api" ? <em>no version info from source</em> : <em>up-to-date · {ourDate}</em>}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
          <div className="cx-ob-updates-actions">
            <button className="cx-mini-btn" disabled={!!massBusy || !Object.values(updateChoices).some(Boolean)} onClick={applyUpdates}>{massBusy === "update" ? "UPDATING…" : `↓ APPLY ${Object.values(updateChoices).filter(Boolean).length}`}</button>
          </div>
        </div>
      ) : null}

      <div className="cx-ob-import">
        <label className="cx-mini-btn" title="Import a JSON bundle file (output of the BUNDLE button on any cached translation, or a hand-crafted bundle).">
          ⤒ IMPORT BUNDLE
          <input type="file" accept=".json,application/json" onChange={onImportBundleFile} style={{ display: "none" }} />
        </label>
        <span className="cx-export-hint" style={{ fontSize: 9.5, opacity: 0.55 }}>A bundle is a single .json file written by the BUNDLE button below — drop one in to import every chapter into the local cache instantly.</span>
      </div>
      {diag ? (
        <div className="cx-ob-diag" title={`Backend: ${diag.backend}`}>
          <span className="cx-ob-diag-l">
            <i className={`cx-ob-diag-dot ${diag.backend === "indexeddb" ? "is-ok" : "is-warn"}`} />
            {diag.backend === "indexeddb" ? "INDEXEDDB" : "FALLBACK · LOCAL"}
          </span>
          <span className="cx-ob-diag-r">{diag.chapterCount} chapters · {diag.approxMB} MB{diag.quotaMB ? ` / ${diag.quotaMB} MB quota` : ""}</span>
        </div>
      ) : null}
      {translations.map(({ t, stats }) => {
        const r = results[t.id];
        return (
          <div key={t.id} className={`cx-ob-row ${stats.fully ? "is-full" : "is-partial"}`}>
            <div className="cx-ob-head">
              <span className="cx-ob-glyph">{t.glyph}</span>
              <span className="cx-ob-name">{t.name}</span>
              <span className="cx-ob-count">{stats.cached}/{stats.total}{stats.fully ? " ✓" : ""}</span>
            </div>
            {r ? (
              <div className={`cx-ob-status ${r.ok ? "is-ok" : "is-warn"}`}>
                {r.phase ? <em>{r.phase}</em> : null}
                {r.summary ? <span>{r.summary}</span> : null}
                {r.smoke ? <small className={r.smoke.ok ? "is-ok" : "is-warn"}>{r.smoke.ok ? "✓ offline read OK · " : "✗ offline read failed · "}{r.smoke.sample}</small> : null}
              </div>
            ) : null}
            <div className="cx-ob-actions">
              <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => test(t)}>{busy === t.id && results[t.id]?.phase?.startsWith("scanning") ? "…" : "TEST"}</button>
              {(r && !r.ok && arrLen(r.missing) + arrLen(r.corrupt) > 0) || !stats.fully ? (
                <button className="cx-mini-btn" disabled={busy === t.id} onClick={() => repair(t)}>{busy === t.id ? "REPAIRING…" : `REPAIR ${stats.total - stats.cached || arrLen(r?.missing)}`}</button>
              ) : null}
              <button className="cx-mini-btn" disabled={busy === t.id || stats.cached === 0} onClick={() => exportBundleFile(t)} title="Download a pre-baked bundle of every cached chapter for this translation. Save the file at /data/bibles/<id>.json so the app loads it instantly on next install.">⤓ BUNDLE</button>
              <button className="cx-mini-btn cx-ob-rm" disabled={busy === t.id} onClick={() => remove(t)}>REMOVE</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OfflineStatus({ bookLookup }: { bookLookup: AppBook[] }): React.ReactElement {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const swReady = !!navigator.serviceWorker?.controller;
  const bibleCache = (() => {
    try {
      return JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const bibleCount = Object.keys(bibleCache).length;
  const transTally: Record<string, number> = {};
  for (const k of Object.keys(bibleCache)) {
    const tId = k.split(".").pop() ?? "";
    transTally[tId] = (transTally[tId] || 0) + 1;
  }
  const BIBLE = aw().BIBLE;
  const fullyCached = BIBLE?.cacheStats ? aw().CODEX_DATA.translations.filter((t) => BIBLE.cacheStats(t.id, bookLookup).fully) : [];
  const panelChapters = (aw().CODEX_PANELS?.cacheStats?.() || []).length;
  const usedBytes = Object.keys(localStorage)
    .filter((k) => k.startsWith("codex."))
    .reduce((s, k) => s + (localStorage.getItem(k)?.length || 0), 0);
  const fmt = (b: number): string => (b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);

  return (
    <div className="cx-offline-status">
      <div className={`cx-offline-row ${swReady ? "is-ok" : "is-warn"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">SERVICE WORKER</span>
        <span className="cx-offline-val">{swReady ? "active · app shell offline" : "installing…"}</span>
      </div>
      <div className={`cx-offline-row ${bibleCount > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">BIBLE CHAPTERS</span>
        <span className="cx-offline-val">{bibleCount} cached across {Object.keys(transTally).length} translations</span>
      </div>
      {fullyCached.length > 0 ? (
        <div className="cx-offline-row is-ok">
          <span className="cx-offline-dot" />
          <span className="cx-offline-lbl">FULLY OFFLINE</span>
          <span className="cx-offline-val">{fullyCached.map((t) => t.name).join(", ")}</span>
        </div>
      ) : null}
      <div className={`cx-offline-row ${panelChapters > 0 ? "is-ok" : "is-dim"}`}>
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">PANELS (TALMUD / GNOSIS / …)</span>
        <span className="cx-offline-val">{panelChapters} chapter{panelChapters === 1 ? "" : "s"} cached</span>
      </div>
      <div className="cx-offline-row is-dim">
        <span className="cx-offline-dot" />
        <span className="cx-offline-lbl">STORAGE</span>
        <span className="cx-offline-val">{fmt(usedBytes)} used</span>
      </div>
    </div>
  );
}

export function CachedPanelsBrowser({ onJump, bookLookup }: { onJump: (ref: string) => void; bookLookup: AppBook[] }): React.ReactElement {
  const [tick] = useState(0);
  const stats = useMemo(() => {
    if (!aw().CODEX_PANELS?.cacheStats) return [];
    return aw().CODEX_PANELS!.cacheStats!();
  }, [tick]);
  const totalBytes = stats.reduce((s, r) => s + r.bytes, 0);
  const fmtSize = (b: number): string => (b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1024 / 1024).toFixed(2)}MB`);
  const human = (ts?: number): string => {
    if (!ts) return "—";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    const d = new Date(ts);
    return `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, "0")}·${String(d.getDate()).padStart(2, "0")}`;
  };
  const label = (ref: string): string => {
    const [bookId, chapter] = ref.split(".");
    const book = bookLookup.find((b) => b.id === bookId);
    return book ? `${book.name} ${chapter}` : `${bookId} ${chapter}`;
  };
  if (stats.length === 0) {
    return (
      <p className="cx-export-hint" style={{ marginTop: 6 }}>
        No panels cached yet. Visit any chapter and Talmud / Commentary / Gematria / Gnosis content for that passage will be saved here for offline reading.
      </p>
    );
  }
  return (
    <div className="cx-cache-browser">
      <div className="cx-cache-browser-h">
        <span>{stats.length} chapters cached · {fmtSize(totalBytes)}</span>
      </div>
      <ul>
        {stats.slice(0, 50).map((r) => (
          <li key={r.ref}>
            <button className="cx-cache-row" onClick={() => onJump(label(r.ref))} title={`Open ${label(r.ref)} · cached ${r.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : "unknown"}`}>
              <span className="cx-cache-row-ref">{label(r.ref)}</span>
              <span className="cx-cache-row-meta">{human(r.fetchedAt)} · {fmtSize(r.bytes)}</span>
            </button>
          </li>
        ))}
      </ul>
      {stats.length > 50 ? <p className="cx-export-hint" style={{ marginTop: 4 }}>+ {stats.length - 50} more (oldest hidden).</p> : null}
    </div>
  );
}
