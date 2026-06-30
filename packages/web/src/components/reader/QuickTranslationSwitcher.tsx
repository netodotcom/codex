// reader — quick translation switcher (migrated from components.jsx). Repurposes
// the display pill as a clickable affordance that opens a language-grouped
// picker; selecting one dispatches codex:set-primary.
import React from "react";
import { rw } from "./reader-window.js";
import type { Translation } from "./types.js";

const { useState, useEffect, useRef, useMemo } = React;

export function QuickTranslationSwitcher({ primary, primaryMeta }: { primary: string; primaryMeta: Translation }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const trans = rw().CODEX_DATA?.translations || [];
  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filt = needle
      ? trans.filter(
          (t) =>
            t.name.toLowerCase().includes(needle) ||
            (t.id || "").toLowerCase().includes(needle) ||
            (t.lang || "").toLowerCase().includes(needle),
        )
      : trans;
    const map = new Map<string, Translation[]>();
    filt.forEach((t) => {
      const k = t.lang || "??";
      if (!map.has(k)) map.set(k, []);
      map.get(k)?.push(t);
    });
    return [...map.entries()];
  }, [trans, filter]);
  const pick = (id: string): void => {
    try {
      window.dispatchEvent(new CustomEvent("codex:set-primary", { detail: { id } }));
    } catch {
      /* ignore */
    }
    setOpen(false);
    setFilter("");
  };
  return (
    <span className="cx-qts" ref={ref}>
      <button
        type="button"
        className={`cx-qts-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Switch translation"
        aria-label="Switch translation"
        aria-expanded={open}
      >
        <span className="cx-qts-glyph">{primaryMeta.glyph}</span>
        <span className="cx-qts-sub">
          {primaryMeta.lang} · {primaryMeta.year}
        </span>
        <span className="cx-qts-caret">▾</span>
      </button>
      {open ? (
        <div className="cx-qts-pop" role="dialog" aria-label="Pick a translation">
          <input className="cx-qts-filter" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus spellCheck={false} />
          <div className="cx-qts-list">
            {grouped.map(([lang, items]) => (
              <React.Fragment key={lang}>
                <div className="cx-qts-lang">{lang}</div>
                {items.map((t) => (
                  <button key={t.id} type="button" className={`cx-qts-row ${t.id === primary ? "is-current" : ""}`} onClick={() => pick(t.id)}>
                    <span className="cx-qts-row-glyph">{t.glyph}</span>
                    <span className="cx-qts-row-name">{t.name}</span>
                    <span className="cx-qts-row-year">{t.year}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
            {!grouped.length ? <div className="cx-qts-empty">no match</div> : null}
          </div>
        </div>
      ) : null}
    </span>
  );
}
