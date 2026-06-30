// CODEX — Omnibar (migrated from omnibar.jsx). ⌘K — the one door.
//
//   "For now we see through a glass, darkly; but then face to face."
//                                                       — 1 Cor 13:12
//
// Type, and the bar UNDERSTANDS: a bare reference previews live and jumps the
// reader; "<verb> <ref>" fires a console; a question becomes a kernel mission;
// "weave" opens the Loom; free text streams full-text hits; "/" is the whole
// command palette ranked by the user's own habits. The empty bar TEACHES, the
// input FORGIVES typos, and no keystroke ever ends in nothing.
import React from "react";
import {
  OMNI_VERBS,
  omniWords,
  type OmniRow,
  type CatalogRow,
} from "./data.js";
import {
  omniParseRef,
  omniFuzzyRef,
  omniCatalogRows,
  omniGuideRows,
  omniFallbackRows,
  omniIndexRows,
  omniLooseRows,
  omniFreqRecord,
} from "./helpers.js";
import { omniInjectGuideCss } from "./style.js";
import { ow, type VerseRow } from "./omnibar-window.js";

const { useState, useEffect, useRef } = React;

export interface OmnibarProps {
  onClose: () => void;
  seed?: string;
}

export function Omnibar({ onClose, seed }: OmnibarProps): React.ReactElement {
  // `seed` — optional initial query (the verse menu's '⌘ more…' passes its
  // ref, e.g. "John 1:14 ") so the bar opens already aimed at the verse.
  const [q, setQ] = useState<string>(() => seed || "");
  const [items, setItems] = useState<OmniRow[]>([]);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<{ ref: string; text: string } | null>(null); // { ref, text } | null
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);
  // first-ever open → one serif line of welcome; dies after first execution
  const [firstRun] = useState<boolean>(() => {
    try { return !localStorage.getItem("codex.omni.guided.v1"); } catch { return false; }
  });
  // the "/" catalog is also the loose-match haystack — build once per open
  // (freq only changes on exec), so the hot path stays free of JSON parses
  const catalogRef = useRef<CatalogRow[] | null>(null);

  useEffect(() => { inputRef.current?.focus(); omniInjectGuideCss(); }, []);

  // bind the inline-search fallback — needs setItems, so it lives here.
  // Replaces the list with real hits (or an honest "0 hits" + kernel row);
  // the bar stays open: a fallback may never itself dead-end.
  const bindFallbacks = (rows: OmniRow[], text: string): OmniRow[] => rows.map((r) => {
    if (r.id !== "fb-search") return r;
    return {
      ...r,
      action: async () => {
        try {
          const search = ow().CODEX_SEARCH;
          const hits = search?.search ? await search.search(text, { limit: 12 }) : [];
          const hitRows: OmniRow[] = (Array.isArray(hits) ? hits : []).map((h, i) => ({
            id: "fbhit-" + i, icon: "Α", title: String(h.ref || h.id || ""),
            sub: String(h.text || h.snippet || "").trim().slice(0, 110),
            action: () => { const f = ow().codexJumpToRef; if (f) f(String(h.ref || h.id || "")); },
          }));
          setItems(hitRows.length ? hitRows : [{
            id: "fb-none", icon: "❖", title: `no hits for “${text}” — ask the kernel instead`,
            sub: "it searches deeper: themes, paraphrases, connections",
            action: () => { const f = ow().codexOpenOps; if (f) f(text); },
          }]);
          setSel(0);
        } catch {}
      },
    };
  });

  // ── Understand the query → build rows (debounced; async results race-guarded)
  useEffect(() => {
    const seq = ++seqRef.current;
    const text = q.trim();
    setSel(0);

    const fill = (s: string): void => { setQ(s); };
    const catalog = (): CatalogRow[] => catalogRef.current || (catalogRef.current = omniCatalogRows(fill));

    // ── EMPTY BAR TEACHES — living examples, least-used capabilities first.
    if (!text) { setItems(omniGuideRows(fill)); setPreview(null); return; }

    // ── "/" — the full command palette, ranked by the user's own habits.
    // Every command in the OS, each with a plain-words description; the
    // filter reads ids, titles, descriptions AND hidden keywords, so
    // "/connect" finds cross-refs + the constellation even if you don't
    // know their names.
    if (text[0] === "/") {
      setPreview(null);
      const all = catalog();
      const queryWords = omniWords(text.slice(1)).split(" ").filter(Boolean);
      const filtered = queryWords.length
        ? all.filter((r) => queryWords.every((w) => r.hay.indexOf(w) !== -1))
        : all;
      // never an empty list — even a catalog miss offers the three doors
      setItems(filtered.length ? filtered.slice(0, 18) : bindFallbacks(omniFallbackRows(text.slice(1).trim() || text), text.slice(1).trim() || text));
      return;
    }

    const rows: OmniRow[] = [];
    const finish = (extra?: OmniRow[]): void => {
      if (seqRef.current !== seq) return;
      setItems([...rows, ...(extra || [])]);
    };

    // 1 — verb form: "<verb> <rest>"
    const vm = text.match(/^(\w+)\s+(.+)$/);
    const verb = vm && OMNI_VERBS[vm[1]!.toLowerCase()];
    if (verb) {
      const rest = vm![2]!.trim();
      if (verb.kind === "ops") {
        rows.push({
          id: "verb-ops", icon: "❖", title: `Mission: ${rest}`,
          sub: "the kernel plans, calls the app's tools, writes a cited artifact",
          action: () => { const f = ow().codexOpenOps; if (f) f(rest); },
        });
      } else {
        // exact parse first; then the forgiving parser — "sword Jhon 1:1"
        // and "go to psalms" still land where the user meant.
        const p = omniParseRef(rest);
        const fz = p ? null : omniFuzzyRef(rest);
        const hit = p || fz;
        if (hit) {
          const refStr = `${hit.bookName} ${hit.chapter}:${hit.v1 || 1}`;
          rows.push({
            id: "verb-" + vm![1], icon: verb.icon, title: `${verb.label}`,
            sub: fz && fz.dist > 0 ? `did you mean ${refStr}?` : refStr,
            action: verb.kind === "go"
              ? () => { const f = ow().codexJumpToRef; if (f) f(refStr); }
              : () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: vm![1]!.toLowerCase(), ref: refStr } })); },
          });
        } else {
          rows.push({ id: "verb-bad", icon: verb.icon, title: verb.label, sub: `couldn't read "${rest}" as a reference`, action: null });
          rows.push(...bindFallbacks(omniFallbackRows(text), text));
        }
      }
      setPreview(null);
      finish();
      return;
    }

    // 2 — bare reference: live preview + the full verb fan
    const p = omniParseRef(text);
    if (p) {
      const refStr = `${p.bookName} ${p.chapter}${p.v1 ? ":" + p.v1 : ""}`;
      rows.push({
        id: "ref-go", icon: "→", title: `Open ${refStr}`, sub: "jump the reader", primary: true,
        action: () => { const f = ow().codexJumpToRef; if (f) f(refStr); },
      });
      ["sword", "mirror", "map", "art", "compare"].forEach((k) => {
        const v = OMNI_VERBS[k]!;
        rows.push({
          id: "ref-" + k, icon: v.icon, title: v.label, sub: `on ${p.bookName} ${p.chapter}:${p.v1 || 1}`,
          action: () => { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind: k, ref: `${p.bookName} ${p.chapter}:${p.v1 || 1}` } })); },
        });
      });
      finish();
      // the dim glass becomes clear: show the verse BEFORE the jump
      const t = setTimeout(async () => {
        try {
          const bible = ow().BIBLE;
          const data = await bible!.loadChapter(p.bookId, p.chapter, ow().CODEX_DATA?.tweaks?.primary || "web");
          if (seqRef.current !== seq) return;
          const d = data as { verses?: VerseRow[] } | VerseRow[] | null | undefined;
          const verses = d && !Array.isArray(d) ? d.verses : undefined;
          const vs: VerseRow[] | { verses?: VerseRow[] } = verses || d || [];
          const pick = Array.isArray(vs)
            ? vs.filter((v) => { const n = v.verse || v.n; return p.v1 ? (n != null && n >= p.v1 && n <= (p.v2 || p.v1)) : (n != null && n <= 3); })
            : [];
          const textOut = pick.map((v) => `${v.verse || v.n}. ${String(v.text || "").trim()}`).join("  ");
          setPreview(textOut ? { ref: refStr, text: textOut.slice(0, 420) } : null);
        } catch { if (seqRef.current === seq) setPreview(null); }
      }, 140);
      return () => clearTimeout(t);
    }

    // 3 — loom / weave
    if (/^(weave|loom)\b/i.test(text)) {
      rows.push({
        id: "loom", icon: "⟐", title: "Weave the session — the Loom",
        sub: "your reading trail becomes one cited study",
        action: () => {
          const f = ow().codexOpenOps;
          if (f) f("Weave my session: call session_trail to see what I have been reading, name the thread that connects it, and build a short cited study that ties it together.");
        },
      });
      setPreview(null);
      finish();
      return;
    }

    // 4 — free text: forgiving ref, generous commands, live search hits,
    // mission escape hatch — and NEVER an empty list at the end of it.
    setPreview(null);
    const isQuestion = /\?|^(how|why|what|where|when|who|trace|compare|build|study)\b/i.test(text);
    // 4a — the forgiving parser: typos + natural phrases become a ref row
    const fz = omniFuzzyRef(text);
    if (fz) {
      rows.push({
        id: "fuzzy-go", icon: "→", primary: !isQuestion,
        title: fz.dist > 0 ? `Did you mean ${fz.refStr}?` : `Open ${fz.refStr}`,
        sub: "jump the reader",
        action: () => { const f = ow().codexJumpToRef; if (f) f(fz.refStr); },
      });
    }
    const missionRow: OmniRow = {
      id: "ops-free", icon: "❖", title: `Mission: ${text}`,
      sub: "task the kernel — plan, gather, write a cited artifact",
      primary: isQuestion,
      action: () => { const f = ow().codexOpenOps; if (f) f(text); },
    };
    if (isQuestion) rows.push(missionRow);
    // universal index (name prefixes) + loose haystack matches ("open the
    // map", "turn on dark mode") — strong matches sit above search hits
    const idx = omniIndexRows(text);
    const seen = new Set(rows.map((r) => r.id));
    // loose rows capped at 2 here — generous, but search hits stay near the top
    [...idx.strong, ...omniLooseRows(text, catalog()).slice(0, 2)].forEach((r) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      rows.push(r);
    });
    const matchedAny = !!fz || rows.some((r) => r.id !== "ops-free");
    // assemble the tail: hits + weak index rows, then either the mission
    // escape hatch (something matched) or the three fallback doors (nothing did)
    const assemble = (hitRows?: OmniRow[]): void => {
      const tail = [...(hitRows || []), ...idx.weak.filter((r) => !seen.has(r.id))];
      if (matchedAny || tail.length) {
        finish([...tail, ...(isQuestion ? [] : [missionRow])]);
      } else {
        const fb = bindFallbacks(omniFallbackRows(text), text)
          .filter((r) => !(isQuestion && r.id === "fb-kernel")); // mission row already is the kernel door
        finish(fb);
      }
    };
    finish();
    if (text.length >= 2 && ow().CODEX_SEARCH?.search) {
      const t = setTimeout(async () => {
        try {
          const search = ow().CODEX_SEARCH;
          const hits = await search!.search!(text, { limit: 6 });
          if (seqRef.current !== seq) return;
          const fmt = (ref: string): string => {
            // dotted keys ("gen.1.15") → canonical ("Genesis 1:15")
            try {
              const X = ow().CODEX_CrossRefLookup;
              if (X && X.formatRef && /^[a-z0-9]+\.\d+\.\d+/i.test(ref)) return X.formatRef(ref);
            } catch {}
            return ref;
          };
          const hitRows: OmniRow[] = (Array.isArray(hits) ? hits : []).slice(0, 6).map((h, i) => {
            const ref = h.ref || h.id || "";
            return {
              id: "hit-" + i, icon: "Α", title: fmt(ref),
              sub: String(h.text || h.snippet || "").trim().slice(0, 110),
              action: () => { const f = ow().codexJumpToRef; if (f) f(fmt(ref)); },
            };
          });
          assemble(hitRows);
        } catch { assemble([]); /* search failed — fallbacks still answer */ }
      }, 200);
      return () => clearTimeout(t);
    } else {
      assemble([]);
    }
  }, [q]);

  const exec = (row?: OmniRow): void => {
    if (!row || !row.action) return;
    omniFreqRecord(row.id); // learn the user's habits — "/" ranks by this
    try { localStorage.setItem("codex.omni.guided.v1", "1"); } catch {} // first-run line dies forever
    catalogRef.current = null; // freq changed — next catalog build re-ranks
    row.action();
    if (row.stay) { inputRef.current?.focus(); return; } // verb rows refill the bar
    onClose();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); exec(items[sel]); return; }
  };

  return (
    <div className="cx-omni-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cx-omni" role="dialog" aria-modal="true" aria-label="Omnibar — one door to everything">
        <div className="cx-omni-bar">
          <span className="cx-omni-sigil" aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            className="cx-omni-input"
            placeholder="ref · word · sword John 1:1 · a question for the kernel · weave"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            aria-label="Omnibar input"
          />
          <kbd className="cx-omni-esc">esc</kbd>
        </div>

        {preview ? (
          <div className="cx-omni-preview">
            <span className="cx-omni-preview-ref">{preview.ref}</span>
            <p>{preview.text}</p>
          </div>
        ) : null}

        {items.length ? (
          <>
            {!q.trim() && items[0] && items[0].guide ? (
              <>
                {firstRun ? (
                  <div className="cx-omni-firstline">type anything — a verse, a question, a word</div>
                ) : null}
                <div className="cx-omni-guide-cap" aria-hidden="true">try one — every row really runs</div>
              </>
            ) : null}
          <ul className="cx-omni-list" role="listbox">
            {items.map((row, i) => (
              <li
                key={row.id}
                role="option"
                aria-selected={i === sel}
                className={`cx-omni-row ${i === sel ? "is-sel" : ""} ${row.primary ? "is-primary" : ""} ${!row.action ? "is-dead" : ""} ${row.guide ? "is-guide" : ""}`}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => { e.preventDefault(); exec(row); }}
              >
                <i className="cx-omni-row-icon" aria-hidden="true">{row.icon}</i>
                <div className="cx-omni-row-txt">
                  <b>{row.title}</b>
                  {row.sub ? <span>{row.sub}</span> : null}
                </div>
                {i === sel && row.action ? <kbd>↵</kbd> : null}
              </li>
            ))}
          </ul>
          </>
        ) : (
          <div className="cx-omni-idle">
            <div className="cx-omni-idle-rows" aria-hidden="true">
              <span><i>→</i> John 3:16</span>
              <span><i>⚔</i> sword John 1:1</span>
              <span><i>Α</i> shepherd</span>
              <span><i>❖</i> how do the prophets use fire?</span>
              <span><i>⟐</i> weave</span>
              <span><i>▤</i> plans · timeline · strong's…</span>
              <span><i>/</i> all commands</span>
            </div>
            <p className="cx-omni-epigraph">“For now we see through a glass, darkly; but then face to face.” — 1 Cor 13:12</p>
          </div>
        )}
      </div>
    </div>
  );
}
