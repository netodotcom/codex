// panels — GemValueModal + useKabbalahMap (Backlog 4.1). Migrated from panels.jsx.
// The value-detail overlay: every cached verse summing to N + a kabbalistic
// gloss. Index + engagement come from the injected GemServices.
import React, { useEffect, useRef, useState } from "react";
import { ordinalWord } from "./format.js";
import { clickableProps } from "./util.js";
import type { GemServices, GemMatch, KabMap } from "./gem-services.js";

interface KabWindow {
  __CODEX_KAB__?: KabMap;
}

export function useKabbalahMap(services: GemServices): KabMap | null {
  const [map, setMap] = useState<KabMap | null>(() => (window as unknown as KabWindow).__CODEX_KAB__ || null);
  useEffect(() => {
    if (map) return;
    let alive = true;
    void services.loadKabMap().then((m) => {
      if (alive && m) setMap(m);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return map;
}

export interface GemValueModalProps {
  value: number;
  system: string;
  kabMap: KabMap | null;
  services: GemServices;
  onClose(): void;
  onJump(ref: string): void;
}

export function GemValueModal({ value, kabMap, services, onClose, onJump }: GemValueModalProps): React.ReactElement {
  const [hits, setHits] = useState<GemMatch[] | null>(null);
  useEffect(() => {
    services.emitDepth("gematria-lookup", String(value), 1);
  }, [value, services]);
  const matchEmittedRef = useRef(false);
  useEffect(() => {
    matchEmittedRef.current = false;
  }, [value]);
  useEffect(() => {
    let alive = true;
    const IDX = services.index;
    void (async () => {
      if (!IDX) {
        setHits([]);
        return;
      }
      try {
        await IDX.ensure();
      } catch {
        /* ignore */
      }
      if (!alive) return;
      const list = IDX.find(value) || [];
      setHits(list);
      if (list.length > 0 && !matchEmittedRef.current) {
        matchEmittedRef.current = true;
        services.emitDepth("gematria-match", String(value), 4);
      }
    })();
    return () => {
      alive = false;
    };
  }, [value, services]);

  const concept = kabMap?.value_to_concept?.[String(value)];
  const sefirah = (kabMap?.sefirot || []).find((s) => s.value === value);

  return (
    <div className="cx-gem-modal-wrap" onClick={onClose}>
      <div className="cx-gem-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Value detail ${value}`}>
        <header className="cx-gem-modal-h">
          <span className="cx-gem-modal-val">
            VALUE <b>{value}</b>
          </span>
          <button className="cx-gem-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {concept || sefirah ? (
          <section className="cx-gem-modal-meaning">
            {sefirah ? (
              <p>
                <b>{sefirah.translit}</b> <span dir="rtl">{sefirah.name}</span> — {sefirah.meaning}. The {ordinalWord(sefirah.n)} Sefirah.
              </p>
            ) : null}
            {concept ? (
              <p className="cx-gem-modal-concept">
                <i>{concept.category}</i> · {concept.concept}
              </p>
            ) : null}
          </section>
        ) : null}
        <section className="cx-gem-modal-hits">
          <h4>IN YOUR LIBRARY {hits ? `(${hits.length})` : "(…)"}</h4>
          {!hits ? (
            <p className="cx-gem-empty">⌬ scanning your cached verses…</p>
          ) : !hits.length ? (
            <p className="cx-gem-empty">No verses in your library sum to {value}. Read more chapters to grow the index.</p>
          ) : (
            <ul className="cx-gem-modal-list">
              {hits.slice(0, 20).map((m, i) => (
                <li
                  key={i}
                  {...clickableProps(() => {
                    onJump(m.ref);
                    onClose();
                  }, `Open ${m.ref}`)}
                >
                  <span className="cx-gem-xref">{m.ref}</span>
                  <span className="cx-gem-xword" dir="auto">
                    {m.word}
                  </span>
                  <span className="cx-gem-xnote">— {m.system}</span>
                </li>
              ))}
              {hits.length > 20 ? <li className="cx-gem-empty">+{hits.length - 20} more</li> : null}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
