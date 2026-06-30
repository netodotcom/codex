// panels — GematriaPanel + GematriaLexicalGrid (Backlog 4.1). Migrated from
// panels.jsx (l.781). The offline ∑ calculator + lexical-value grid + (schema-2)
// deep block. Runtime services (index/nav/strongs/kab) are injected.
import React, { useMemo, useState } from "react";
import { computeGematriaCalc } from "./gem-chars.js";
import { PaneHead, PanelStatus, RegenBtn, Collapsible } from "./chrome.js";
import { clickableProps } from "./util.js";
import { tx } from "./tx.js";
import { GemValueModal, useKabbalahMap } from "./GemValueModal.js";
import { GematriaDeep, type GematriaDeepData } from "./GematriaDeep.js";
import type { GemServices } from "./gem-services.js";
import type { PanelProps, GematriaEntry } from "./types.js";

function GematriaLexicalGrid({ items, services }: { items: GematriaEntry[]; services: GemServices }): React.ReactElement {
  const kabMap = useKabbalahMap(services);
  const [modalValue, setModalValue] = useState<number | null>(null);
  return (
    <>
      <div className="cx-gem-grid">
        {items.map((g, i) => (
          <div key={i} className="cx-gem-cell">
            <div className="cx-gem-term cx-gem-clickable" {...clickableProps(() => services.openStrongs(g.term), `Open Strong's for ${g.term}`)}>
              {g.term}
            </div>
            <div className="cx-gem-translit">{g.translit}</div>
            <div className="cx-gem-meaning">{g.meaning}</div>
            <div className="cx-gem-value cx-gem-clickable" {...clickableProps(() => setModalValue(g.value), `Open value ${g.value}`)} title={`See every verse summing to ${g.value}`}>
              <b>{g.value}</b>
              <i>{g.system}</i>
            </div>
          </div>
        ))}
      </div>
      {modalValue ? (
        <GemValueModal value={modalValue} system="" kabMap={kabMap} services={services} onClose={() => setModalValue(null)} onJump={services.jumpRef} />
      ) : null}
    </>
  );
}

export function GematriaPanel({ panelData, status, meta, passage, onRegenerate, services }: PanelProps & { services: GemServices }): React.ReactElement {
  const [calc, setCalc] = useState("");
  const calcResult = useMemo(() => computeGematriaCalc(calc), [calc]);
  const deep = panelData?.["gematriaDeep"] as GematriaDeepData | undefined;

  return (
    <div className="cx-pane">
      <PaneHead
        title={tx("panel.gematria.head", "GEMATRIA · ISOPSEPHY")}
        sub={`Numerical resonance · ${passage.book} ${passage.chapter}`}
        meta={meta}
        action={panelData ? <RegenBtn onClick={onRegenerate} /> : null}
      />

      <Collapsible
        defaultOpen
        title={
          <span>
            ∑ CALCULATOR
            <span className="cx-cache-pill is-cached" style={{ marginLeft: 8 }}>
              ✓ OFFLINE · ON-DEVICE
            </span>
          </span>
        }
        sub={calcResult.script ? `${calcResult.script} · live` : "paste Greek or Hebrew"}
      >
        <div className="cx-gem-calc">
          <div className="cx-gem-calc-row">
            <input value={calc} onChange={(e) => setCalc(e.target.value)} placeholder="λόγος / אהבה" spellCheck={false} dir="auto" />
            <div className="cx-gem-calc-out">
              <span>{calcResult.sum || "—"}</span>
              <i>SUM</i>
            </div>
          </div>

          {calcResult.breakdown.length > 0 ? (
            <>
              <div className="cx-gem-breakdown">
                {calcResult.breakdown.map((p, i) => (
                  <span key={i} className="cx-gem-bd-cell">
                    <span className="cx-gem-bd-ch">{p.ch}</span>
                    <span className="cx-gem-bd-v">{p.v}</span>
                  </span>
                ))}
              </div>
              <div className="cx-gem-extra">
                <span>
                  <b>{calcResult.sum}</b> sum
                </span>
                <span>
                  <b>{calcResult.ordinal}</b> ordinal
                </span>
                <span>
                  <b>{calcResult.reduced}</b> reduced (digital root)
                </span>
              </div>
            </>
          ) : null}
        </div>
      </Collapsible>

      {!panelData ? (
        <PanelStatus status={status} passage={passage} onRegenerate={onRegenerate} kind="gematria" />
      ) : (
        <>
          <Collapsible defaultOpen title="LEXICAL VALUES" count={panelData.gematria.length}>
            <GematriaLexicalGrid items={panelData.gematria as GematriaEntry[]} services={services} />
          </Collapsible>

          <Collapsible defaultOpen title="RESONANCES" count={(panelData.gematriaNotes || []).length}>
            <div className="cx-gem-notes">
              {(panelData.gematriaNotes || []).map((n, i) => (
                <p key={i}>▹ {n}</p>
              ))}
            </div>
          </Collapsible>

          {deep && deep._schema === 2 ? <GematriaDeep deep={deep} services={services} /> : null}
        </>
      )}
    </div>
  );
}
