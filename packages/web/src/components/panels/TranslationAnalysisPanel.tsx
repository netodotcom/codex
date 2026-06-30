// panels — TranslationAnalysisPanel (Backlog 4.1). Migrated from panels.jsx
// (l.1774). Compares the loaded translations of one verse and explains where
// philosophy drives divergence. Cache/fetch via an injected service; the
// translation registry comes from @codex/core.
import React, { useEffect, useMemo, useState } from "react";
import { translationById } from "@codex/core/data";
import { PaneHead, PanelStatus, RegenBtn, Collapsible, type CacheMeta, type PanelStatusState } from "./chrome.js";

export interface TransItem {
  id: string;
  name: string;
  year: string | null;
  philosophy: string;
  text: string;
}

export interface TxAnalysisData {
  verse_ref?: string;
  renderings: Array<{ translation?: string; year?: string; philosophy?: string; text?: string; key_choice?: string }>;
  divergence_points?: Array<{ issue?: string; options?: string[]; philosophy_split?: string }>;
  best_for_study?: string;
  best_for_devotion?: string;
  best_for_originalist?: string;
}

export interface TxAnalysisService {
  getCached(passageKey: string, transIds: string[]): TxAnalysisData | null;
  getMeta(passageKey: string, transIds: string[]): { fetchedAt: number } | null;
  load(passageKey: string, transList: TransItem[], opts: { passageLabel: string; provider?: string; model?: string; force?: boolean }): Promise<TxAnalysisData>;
  purge(passageKey: string, transIds: string[]): void;
}

export interface TxVerse {
  n: number;
  [key: string]: unknown;
}

export interface TxPassage {
  bookId: string;
  book: string;
  chapter: number;
  verses: TxVerse[];
}

function readTweaks(): { provider?: string; model?: string } {
  try {
    return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as { provider?: string; model?: string };
  } catch {
    return {};
  }
}

export function TranslationAnalysisPanel({
  passage,
  currentVerse,
  primary,
  compareSet,
  service,
}: {
  passage: TxPassage;
  currentVerse?: number;
  primary: string;
  compareSet?: string[];
  onJumpRef?: (ref: string) => void;
  service: TxAnalysisService;
}): React.ReactElement {
  const verse = passage.verses.find((v) => v.n === currentVerse) || passage.verses[0];
  const verseN = verse ? verse.n : 1;
  const passageLabel = `${passage.book} ${passage.chapter}:${verseN}`;

  const transList = useMemo<TransItem[]>(() => {
    const ids = [primary, ...[...(compareSet || [])].filter((id) => id !== primary)];
    return ids
      .map((id): TransItem | null => {
        const meta = translationById(id) as ({ name?: string; year?: string; philosophy?: string; kind?: string } | undefined);
        const txt = verse ? String(verse[id] || "") : "";
        return meta && txt
          ? { id, name: meta.name || id, year: meta.year || null, philosophy: meta.philosophy || meta.kind || "", text: txt }
          : null;
      })
      .filter((x): x is TransItem => x !== null);
  }, [primary, compareSet, verse]);

  const enoughTrans = transList.length >= 2;
  const passageKey = `${passage.bookId}.${passage.chapter}.${verseN}`;
  const cacheIds = transList.map((t) => t.id);
  const cacheSig = cacheIds.join("+");

  const [data, setData] = useState<TxAnalysisData | null>(() => (enoughTrans ? service.getCached(passageKey, cacheIds) : null));
  const [meta, setMeta] = useState<CacheMeta | null>(() => {
    if (!enoughTrans) return null;
    const m = service.getMeta(passageKey, cacheIds);
    return m ? { fromCache: true, fetchedAt: m.fetchedAt } : null;
  });
  const [status, setStatus] = useState<PanelStatusState>({ loading: false });

  useEffect(() => {
    if (!enoughTrans) {
      setData(null);
      setMeta(null);
      return;
    }
    setData(service.getCached(passageKey, cacheIds));
    const m = service.getMeta(passageKey, cacheIds);
    setMeta(m ? { fromCache: true, fetchedAt: m.fetchedAt } : null);
    setStatus({ loading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageKey, cacheSig, enoughTrans]);

  const fetchIt = (force: boolean): void => {
    const tw = readTweaks();
    setStatus({ loading: true });
    service
      .load(passageKey, transList, { passageLabel, provider: tw.provider, model: tw.model, force })
      .then((d) => {
        setData(d);
        setMeta({ fresh: true, fetchedAt: Date.now() });
        setStatus({ loading: false });
      })
      .catch((err: unknown) => {
        setStatus({ loading: false, error: (err as Error).message || String(err) });
      });
  };

  const onRegenerate = (): void => {
    service.purge(passageKey, cacheIds);
    fetchIt(true);
  };

  if (!enoughTrans) {
    return (
      <div className="cx-pane cx-pane-txan">
        <PaneHead title="TRANSLATION ANALYSIS" sub={passageLabel} />
        <div className="cx-txan-empty">
          <b>NEED 2+ TRANSLATIONS</b>
          <span>Open more translations in the Translations tab first, then return here to compare how each renders this verse.</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cx-pane cx-pane-txan">
        <PaneHead title="TRANSLATION ANALYSIS" sub={`${passageLabel} · ${transList.length} loaded`} />
        <div className="cx-txan-preview">
          <div className="cx-txan-preview-h">Currently loaded</div>
          <ul>
            {transList.map((t) => (
              <li key={t.id}>
                <b>{t.name}</b>
                <span className="cx-txan-prev-text">{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <PanelStatus status={status} passage={passage} onRegenerate={() => fetchIt(false)} kind="translation analysis" />
      </div>
    );
  }

  return (
    <div className="cx-pane cx-pane-txan">
      <PaneHead
        title="TRANSLATION ANALYSIS"
        sub={`${data.verse_ref || passageLabel} · ${data.renderings.length} renderings`}
        meta={meta}
        action={<RegenBtn onClick={onRegenerate} />}
      />

      <Collapsible defaultOpen title="COMPARISON TABLE" count={data.renderings.length}>
        <div className="cx-txan-table-wrap">
          <table className="cx-txan-table">
            <thead>
              <tr>
                <th>Translation</th>
                <th>Year</th>
                <th>Philosophy</th>
                <th>Text</th>
                <th>Key choice</th>
              </tr>
            </thead>
            <tbody>
              {data.renderings.map((r, i) => (
                <tr key={i}>
                  <td>
                    <b>{r.translation}</b>
                  </td>
                  <td>{r.year || "—"}</td>
                  <td>
                    <span className={`cx-txan-phil is-${(r.philosophy || "").toLowerCase().replace(/[^a-z]/g, "")}`}>{r.philosophy || "—"}</span>
                  </td>
                  <td className="cx-txan-text">{r.text}</td>
                  <td className="cx-txan-key">{r.key_choice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>

      {data.divergence_points && data.divergence_points.length ? (
        <Collapsible defaultOpen title="DIVERGENCE POINTS" count={data.divergence_points.length}>
          <div className="cx-txan-div-list">
            {data.divergence_points.map((d, i) => (
              <article key={i} className="cx-txan-div">
                <h4>{d.issue}</h4>
                {d.options && d.options.length ? (
                  <ul className="cx-txan-opts">
                    {d.options.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                {d.philosophy_split ? (
                  <p className="cx-txan-split">
                    <b>Philosophy — </b>
                    {d.philosophy_split}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Collapsible>
      ) : null}

      <Collapsible defaultOpen={false} title="RECOMMENDATIONS">
        <ul className="cx-txan-recs">
          {data.best_for_study ? (
            <li>
              <b>Best for study — </b>
              {data.best_for_study}
            </li>
          ) : null}
          {data.best_for_devotion ? (
            <li>
              <b>Best for devotion — </b>
              {data.best_for_devotion}
            </li>
          ) : null}
          {data.best_for_originalist ? (
            <li>
              <b>Closest to source — </b>
              {data.best_for_originalist}
            </li>
          ) : null}
        </ul>
      </Collapsible>
    </div>
  );
}
