// translations — CodexTranslationsX (migrated verbatim from translations.jsx).
// A thin projection of the TRANS engine onto language lanes of translation cards.
// No logic changes — same DOM output, same event listeners, same side-effects.
//
// Contract: same props as the old TranslationsPanel —
//   { primary, onPrimary, compareSet, onToggleCompare, passage, currentVerse }
// Used as the body of the TRANS desk window (app.jsx) AND the trans tab in the
// mobile drawer (panels.jsx). Engines stay in bible.js / panels.jsx.
import React from "react";
import type { TxTranslation, TxStats, TranslationsPanelProps } from "./translations-window.js";
import { tw } from "./translations-window.js";
import { TX_LANG_NAMES, TX_LANG_ORDER } from "./data.js";
import type { OfflineState } from "./helpers.js";
import { txToast } from "./helpers.js";
import { TxCard } from "./TxCard.js";

export function CodexTranslationsX({
  primary, onPrimary, compareSet, onToggleCompare, passage, currentVerse,
}: TranslationsPanelProps): React.ReactElement {
  const data = tw().CODEX_DATA!;
  const TS = tw().CODEX_TRANS_STATE ?? null;
  const [bumpKey, bump] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const filterRef = React.useRef<HTMLInputElement>(null);

  const verse = passage.verses.find(v => v.n === currentVerse) ?? passage.verses[0];
  const primaryMeta = data.translations.find(t => t.id === primary);
  const primaryText: string = verse ? (String(verse[primary] ?? "") || "—") : "—";
  const refStr = `${passage.book} ${passage.chapter}:${verse?.n ?? "—"}`;
  const userIds = new Set((tw().loadRepos?.() ?? []).map(r => r.id));

  // Live repaint: download ticks, install/removal, IDB warm-load.
  React.useEffect(() => {
    const fn = (): void => bump(n => n + 1);
    const unsub = TS ? TS.subscribe(fn) : null;
    window.addEventListener("codex:translations-changed", fn);
    window.addEventListener("codex:bible:ready", fn);
    const bible = tw().BIBLE;
    if (bible?.ready) { bible.ready.then(fn); }
    return () => {
      if (unsub) unsub();
      window.removeEventListener("codex:translations-changed", fn);
      window.removeEventListener("codex:bible:ready", fn);
    };
  }, []);

  // Cache stats per translation — re-derived on every bump so dots are true.
  const stats = React.useMemo(() => {
    const m: Record<string, TxStats> = {};
    const bible = tw().BIBLE;
    if (!bible?.cacheStats) return m;
    for (const t of data.translations) {
      try { m[t.id] = bible.cacheStats(t.id, data.books); } catch {}
    }
    return m;
  }, [data.translations, data.books, bumpKey]);

  // Lanes: group by language, EN-first canonical order, then any others.
  const lanes = React.useMemo(() => {
    const byLang = new Map<string, TxTranslation[]>();
    for (const t of data.translations) {
      const k = t.lang ?? "??";
      if (!byLang.has(k)) byLang.set(k, []);
      byLang.get(k)!.push(t);
    }
    const order = [
      ...TX_LANG_ORDER.filter(l => byLang.has(l)),
      ...[...byLang.keys()].filter(l => !TX_LANG_ORDER.includes(l)),
    ];
    return order.map(lang => ({ lang, items: byLang.get(lang)! }));
  }, [data.translations, bumpKey]);

  // Filter — name / lang / id / year, lanes without matches vanish.
  const q = query.trim().toLowerCase();
  const shown = !q ? lanes : lanes.map(g => ({
    ...g,
    items: g.items.filter(t =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.lang || "").toLowerCase().includes(q) ||
      (t.id || "").toLowerCase().includes(q) ||
      String(t.year ?? "").includes(q) ||
      (TX_LANG_NAMES[t.lang ?? ""] ?? "").toLowerCase().includes(q)
    ),
  })).filter(g => g.items.length > 0);

  const pick = (t: TxTranslation): void => {
    if (t.placeholder) return;
    onPrimary(t.id);
    if (TS?.maybeAutoBundle) TS.maybeAutoBundle(t, data.books);
  };
  const toggleCompare = (t: TxTranslation): void => {
    const wasOn = compareSet.includes(t.id);
    onToggleCompare(t.id);
    if (!wasOn && TS?.maybeAutoBundle) TS.maybeAutoBundle(t, data.books);
  };
  const dotAct = (t: TxTranslation, off: OfflineState): void => {
    if (!TS) return;
    if (off.downloading) TS.stop(t);
    else if (off.kind === "full" && t.source !== "bundle") TS.clear(t);
    else if (off.kind !== "full") TS.start(t);
  };
  const removeOne = (t: TxTranslation): void => {
    if (!userIds.has(t.id)) return;
    if (!window.confirm(`Remove ${t.name} from your library? Cached chapters will be cleared.`)) return;
    tw().removeRepo?.(t.id);
    if (compareSet.includes(t.id)) onToggleCompare(t.id);
    if (primary === t.id) onPrimary("kjv");
    bump(n => n + 1);
  };

  // Keyboard: ←/→ walk the cards of a lane (cards are real buttons, so
  // Tab + Enter already work; arrows make a lane feel like one instrument).
  const onLaneKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const track = e.currentTarget;
    const picks = [...track.querySelectorAll<HTMLButtonElement>(".cx-tx-card-pick:not([disabled])")];
    const i = picks.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    e.preventDefault();
    const next = picks[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) { next.focus(); next.scrollIntoView({ block: "nearest", inline: "nearest" }); }
  };

  // Compare renderings (primary excluded) for the verse preview stack.
  const compareRows = compareSet
    .filter(id => id !== primary)
    .map(id => ({ id, meta: data.translations.find(t => t.id === id) }))
    .filter((r): r is { id: string; meta: TxTranslation } => r.meta !== undefined);

  const copyPrimary = (): void => {
    if (!verse) return;
    try {
      navigator.clipboard?.writeText(`${String(primaryText).trim()} — ${refStr} (${primaryMeta?.name ?? primary})`);
      txToast(`Copied · ${refStr}`, "ok");
    } catch { txToast("Copy failed", "err"); }
  };

  const RepoAdd = tw().RepoAdd ?? null;

  return (
    <div className="cx-pane cx-tx" role="region" aria-label="Translations">
      {/* ── THE CURRENT WORD ─────────────────────────────────────────── */}
      <section className="cx-tx-current">
        <div className="cx-tx-identity" title={`${primaryMeta?.name ?? primary} · ${primaryMeta?.year ?? ""} · ${primaryMeta?.license ?? ""}`}>
          <b className="cx-tx-id-glyph">{primaryMeta?.glyph || (primary || "?").toUpperCase()}</b>
          <span className="cx-tx-id-name">{primaryMeta?.name ?? primary}</span>
          <span className="cx-tx-id-year">{primaryMeta?.year ?? ""}</span>
        </div>
        <blockquote
          className="cx-tx-verse"
          onClick={copyPrimary}
          title="Tap to copy"
        >
          <span className="cx-tx-verse-text">{primaryText}</span>
          <cite className="cx-tx-verse-ref">{refStr}</cite>
        </blockquote>
        {compareRows.length ? (
          <div className="cx-tx-compare" aria-label="Compare renderings">
            {compareRows.map(({ id, meta }) => (
              <div key={id} className="cx-tx-cmp-row">
                <b className="cx-tx-cmp-tag" title={meta.name}>{meta.glyph || id.toUpperCase()}</b>
                <span className="cx-tx-cmp-text">{verse ? (String(verse[id] ?? "") || "—") : "—"}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── Filter ───────────────────────────────────────────────────── */}
      <div className="cx-tx-bar">
        <input
          ref={filterRef}
          type="search"
          className="cx-tx-filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter · name, lang, id, year"
          aria-label="Filter translations"
        />
        <span className="cx-tx-legend" aria-hidden="true">● offline · ◐ partial · ○ network</span>
      </div>

      {/* ── LANGUAGE LANES ───────────────────────────────────────────── */}
      <div className="cx-tx-lanes">
        {shown.map(({ lang, items }) => (
          <section key={lang} className="cx-tx-lane" data-lang={lang}>
            <header className="cx-tx-lane-h">
              <b className="cx-tx-lane-tag">{lang}</b>
              <span className="cx-tx-lane-name">{TX_LANG_NAMES[lang] ?? lang}</span>
              <span className="cx-tx-lane-count">{items.length}</span>
            </header>
            <div className="cx-tx-lane-track" role="listbox" aria-label={`${TX_LANG_NAMES[lang] ?? lang} translations`} onKeyDown={onLaneKey}>
              {items.map(t => (
                <TxCard
                  key={t.id}
                  t={t}
                  isPrimary={primary === t.id}
                  isCompare={compareSet.includes(t.id)}
                  isUser={userIds.has(t.id)}
                  stats={stats[t.id]}
                  dl={TS ? TS.get(t.id) : null}
                  onPick={() => pick(t)}
                  onCompare={() => toggleCompare(t)}
                  onDot={(off) => dotAct(t, off)}
                  onRemove={() => removeOne(t)}
                />
              ))}
            </div>
          </section>
        ))}
        {!shown.length ? <div className="cx-tx-none">no translation matches &quot;{query}&quot;</div> : null}
      </div>

      {RepoAdd ? (
        <details className="cx-tx-browse">
          <summary>＋ Browse community translations</summary>
          {React.createElement(RepoAdd, { onAdded: () => bump(n => n + 1) })}
        </details>
      ) : null}
    </div>
  );
}
