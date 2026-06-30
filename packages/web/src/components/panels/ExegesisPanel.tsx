// panels — ExegesisPanel (Backlog 4.1). Migrated from panels.jsx (l.1649). Deep
// AI exegesis with its own on-demand fetch + cache. The cache/fetch service
// (legacy window.CODEX_PANELS.*Exegesis) is injected so it's testable.
import React, { useEffect, useState } from "react";
import { PaneHead, PanelStatus, RegenBtn, Collapsible, type CacheMeta, type PanelStatusState } from "./chrome.js";

export interface ExegesisData {
  key_terms?: Array<{ term?: string; original?: string; translit?: string; lexical_range?: string; translation_choices?: string }>;
  literary_structure?: string;
  historical_context?: string;
  intertextual_echoes?: Array<{ ref?: string; note?: string }>;
  exegetical_options?: Array<{ view?: string; scholars?: string; argument?: string }>;
  preferred_reading?: string;
  theological_implication?: string;
  applicational_pivot?: string;
}

export interface ExegesisService {
  getCached(passageKey: string): ExegesisData | null;
  getMeta(passageKey: string): { fetchedAt: number } | null;
  load(passageKey: string, opts: { passageLabel: string; provider?: string; model?: string; force?: boolean }): Promise<ExegesisData>;
  purge(passageKey: string): void;
}

export interface ExegPassage {
  bookId: string;
  book: string;
  chapter: number;
}

function readTweaks(): { provider?: string; model?: string } {
  try {
    return JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as { provider?: string; model?: string };
  } catch {
    return {};
  }
}

export function ExegesisPanel({
  passage,
  currentVerse,
  service,
}: {
  passage: ExegPassage;
  currentVerse?: number;
  service: ExegesisService;
}): React.ReactElement {
  const passageKey = `${passage.bookId}.${passage.chapter}`;
  const passageLabel = `${passage.book} ${passage.chapter}${currentVerse ? ":" + currentVerse : ""}`;
  const [data, setData] = useState<ExegesisData | null>(() => service.getCached(passageKey));
  const [meta, setMeta] = useState<CacheMeta | null>(() => {
    const m = service.getMeta(passageKey);
    return m ? { fromCache: true, fetchedAt: m.fetchedAt } : null;
  });
  const [status, setStatus] = useState<PanelStatusState>({ loading: false });

  useEffect(() => {
    setData(service.getCached(passageKey));
    const m = service.getMeta(passageKey);
    setMeta(m ? { fromCache: true, fetchedAt: m.fetchedAt } : null);
    setStatus({ loading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageKey]);

  const fetchIt = (force: boolean): void => {
    const tw = readTweaks();
    setStatus({ loading: true });
    service
      .load(passageKey, { passageLabel: `${passage.book} ${passage.chapter}`, provider: tw.provider, model: tw.model, force })
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
    service.purge(passageKey);
    fetchIt(true);
  };

  if (!data) {
    return (
      <div className="cx-pane cx-pane-exeg">
        <PaneHead title="EXEGESIS · DEEP ANALYSIS" sub={passageLabel} />
        <PanelStatus status={status} passage={passage} onRegenerate={() => fetchIt(false)} kind="exegesis" />
      </div>
    );
  }
  return (
    <div className="cx-pane cx-pane-exeg">
      <PaneHead title="EXEGESIS · DEEP ANALYSIS" sub={passageLabel} meta={meta} action={<RegenBtn onClick={onRegenerate} />} />
      <div className="cx-exeg-list">
        {data.key_terms && data.key_terms.length ? (
          <Collapsible defaultOpen title="KEY TERMS" count={data.key_terms.length}>
            <div className="cx-exeg-terms">
              {data.key_terms.map((k, i) => (
                <article key={i} className="cx-exeg-term">
                  <header>
                    <span className="cx-exeg-term-en">{k.term}</span>
                    {k.original ? <span className="cx-exeg-term-orig">{k.original}</span> : null}
                    {k.translit ? <span className="cx-exeg-term-tr">{k.translit}</span> : null}
                  </header>
                  {k.lexical_range ? (
                    <p>
                      <b>Lexical range — </b>
                      {k.lexical_range}
                    </p>
                  ) : null}
                  {k.translation_choices ? (
                    <p>
                      <b>Translation choices — </b>
                      {k.translation_choices}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Collapsible>
        ) : null}
        {data.literary_structure ? (
          <Collapsible defaultOpen title="LITERARY STRUCTURE">
            <p className="cx-exeg-para">{data.literary_structure}</p>
          </Collapsible>
        ) : null}
        {data.historical_context ? (
          <Collapsible defaultOpen title="HISTORICAL CONTEXT">
            <p className="cx-exeg-para">{data.historical_context}</p>
          </Collapsible>
        ) : null}
        {data.intertextual_echoes && data.intertextual_echoes.length ? (
          <Collapsible defaultOpen title="INTERTEXTUAL ECHOES" count={data.intertextual_echoes.length}>
            <ul className="cx-xref">
              {data.intertextual_echoes.map((e, i) => (
                <li key={i}>
                  <b>{e.ref}</b>
                  <span>{e.note}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {data.exegetical_options && data.exegetical_options.length ? (
          <Collapsible defaultOpen title="EXEGETICAL OPTIONS" count={data.exegetical_options.length}>
            <div className="cx-exeg-opts">
              {data.exegetical_options.map((o, i) => (
                <article key={i} className="cx-exeg-opt">
                  <h4>{o.view}</h4>
                  {o.scholars ? <span className="cx-exeg-scholars">{o.scholars}</span> : null}
                  <p>{o.argument}</p>
                </article>
              ))}
            </div>
          </Collapsible>
        ) : null}
        {data.preferred_reading ? (
          <Collapsible defaultOpen title="PREFERRED READING">
            <p className="cx-exeg-para is-emph">{data.preferred_reading}</p>
          </Collapsible>
        ) : null}
        {data.theological_implication ? (
          <Collapsible defaultOpen={false} title="THEOLOGICAL IMPLICATION">
            <p className="cx-exeg-para">{data.theological_implication}</p>
          </Collapsible>
        ) : null}
        {data.applicational_pivot ? (
          <Collapsible defaultOpen={false} title="APPLICATIONAL PIVOT">
            <p className="cx-exeg-para">{data.applicational_pivot}</p>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );
}
