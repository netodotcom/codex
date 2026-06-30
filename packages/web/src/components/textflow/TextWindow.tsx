// textflow — TextWindow: the floating Sefaria reader window.
// Faithful port from textflow.jsx. Fetches Hebrew + English from Sefaria
// live; renders inside the standard cx-win chrome (wm.js gives drag/resize
// for free via data-wm-id / data-wm-glyph).
import React from "react";
import type { SefariaSpec } from "./textflow-window.js";

const { useState, useEffect } = React;

interface TextWindowState {
  loading: boolean;
  err: string | null;
  en: unknown[];
  he: unknown[];
  title: string;
}

export interface TextWindowProps {
  win: SefariaSpec;
  onClose: (win: SefariaSpec) => void;
}

// Strip HTML tags — Sefaria returns segments with inline markup.
const strip = (h: unknown): string => String(h || "").replace(/<[^>]+>/g, "");

// Flatten up to 2 levels then remove falsy values — mirrors x.flat(2).filter(Boolean).
function sefariaArr(x: unknown): unknown[] {
  if (!Array.isArray(x)) return x ? [x] : [];
  // After Array.isArray, x is any[] in TypeScript; cast for clarity.
  const top = x as unknown[];
  const out: unknown[] = [];
  for (const item of top) {
    if (Array.isArray(item)) {
      const mid = item as unknown[];
      for (const inner of mid) {
        if (Array.isArray(inner)) {
          const bot = inner as unknown[];
          for (const leaf of bot) {
            if (leaf) out.push(leaf);
          }
        } else if (inner) {
          out.push(inner);
        }
      }
    } else if (item) {
      out.push(item);
    }
  }
  return out;
}

export function TextWindow({ win, onClose }: TextWindowProps): React.ReactElement {
  const [state, setState] = useState<TextWindowState>({
    loading: true,
    err: null,
    en: [],
    he: [],
    title: win.label,
  });

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const r = await fetch(
          `https://www.sefaria.org/api/texts/${encodeURIComponent(win.tref)}?context=0&commentary=0`,
        );
        if (!r.ok) throw new Error(`Sefaria ${r.status}`);
        const d = (await r.json()) as { text?: unknown; he?: unknown; ref?: string };
        if (dead) return;
        setState({
          loading: false,
          err: null,
          en: sefariaArr(d.text),
          he: sefariaArr(d.he),
          title: d.ref ?? win.label,
        });
      } catch (e) {
        // Faithful to original: String(e.message || e) — prefer message, fall back to String(e).
        const msg = e instanceof Error ? (e.message || String(e)) : String(e);
        if (!dead) setState((s) => ({ ...s, loading: false, err: msg }));
      }
    })();
    return () => {
      dead = true;
    };
  }, [win.tref]);

  const n = Math.max(state.en.length, state.he.length);

  return (
    <div className="cx-win-backdrop" data-wm-id={`win:text:${win.tref}`} data-wm-glyph="ℸ">
      <div className="cx-win cxt-win">
        <header className="cx-win-h">
          <span className="cx-win-h-glyph" aria-hidden={true}>ℸ</span>
          <span className="cx-win-h-title">{state.title}</span>
          <span className="cx-win-h-ctx">TALMUD</span>
          <button className="cx-win-x" onClick={() => onClose(win)} aria-label="Close" title="Close">×</button>
        </header>
        <div className="cx-win-body cxt-body">
          <div className="cxt-banner" role="note">
            ℸ LIVE FROM SEFARIA.ORG · COMMUNITY TRANSLATION · NOT BUNDLED — VERIFY AGAINST A PRINTED DAF
          </div>
          {state.loading ? (
            <div className="cxt-status">
              <span className="cxr-pulse" aria-hidden={true} />
              UNROLLING {win.label.toUpperCase()}…
            </div>
          ) : state.err ? (
            <div className="cxt-status is-err">
              <b>THE SCROLL IS SEALED</b>
              <code>{state.err}</code>
              <span>Sefaria needs a live connection — check the network and reopen.</span>
            </div>
          ) : (
            <div className="cxt-scroll">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="cxt-seg">
                  {state.he[i] ? (
                    <p className="cxt-he" dir="rtl" lang="he">{strip(state.he[i])}</p>
                  ) : null}
                  {state.en[i] ? (
                    <p className="cxt-en">{strip(state.en[i])}</p>
                  ) : null}
                </div>
              ))}
              {!n ? (
                <div className="cxt-status">
                  Sefaria returned an empty section for {win.label}.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
