// crossref — THE THREAD WEB (migrated faithfully from crossref.jsx). The TSK
// ego-graph panel: a center verse, its cross-references orbiting on the canvas
// (XrefGraph), a walked-chain breadcrumb (the panel's soul), the center verse's
// prose summoned on demand, a hover readout with the compare + AI-resonance
// affordances, and a visually-hidden keyboard mirror. Behaviour, DOM, classes,
// events, and side-effects are unchanged from v1.
import React from "react";
import { XrefGraph } from "./XrefGraph.js";
import { injectCSS } from "./style.js";
import { loadTsk } from "./data.js";
import { emitDepth, hasAiKey, fetchResonance } from "./resonance.js";
import {
  OT_C,
  NT_C,
  SEAM_C,
  parseVerseKey,
  formatRef,
  shortRef,
  normalizeKey,
  bookMeta,
  themeColor,
  snippetFor,
  chapterVerses,
} from "./helpers.js";
import { xw } from "./crossref-window.js";
import type {
  TskModule,
  TskRef,
  TskRefObject,
  XrefNode,
  Pt,
  ProbeRef,
  CrossRefPanelProps,
} from "./crossref-window.js";

const { useState, useEffect, useMemo, useCallback, useRef } = React;

interface VerseTextState {
  key: string;
  state: "loading" | "done";
  text: string | null;
}

// ── The panel component ───────────────────────────────────────────────────
export function CrossRefPanel({ bookId, chapter, verse, translation }: CrossRefPanelProps): React.ReactElement {
  const [mod, setMod] = useState<TskModule | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Thread-web styles — self-injected (one tag, idempotent) instead of
  // styles.css because a parallel build owns that file right now.
  // TODO: fold into styles.css at the next quiet moment.
  useEffect(() => {
    injectCSS();
  }, []);

  // The host verse key — the web's base when no chain has been walked.
  const hostKey = `${bookId}.${chapter}.${verse || 1}`;

  // The walked chain (the panel's soul). The panel owns it: single-click
  // recenters the graph WITHOUT dragging the reader along (reading is the
  // deliberate double-click). External codex:xref-jump/back still land
  // here so other surfaces keep working unchanged.
  const [chain, setChain] = useState<string[]>([]);
  const currentKey = chain.length ? chain[chain.length - 1]! : hostKey;

  const chainRef = useRef<string[]>(chain);
  chainRef.current = chain;
  const currentKeyRef = useRef<string>(currentKey);
  currentKeyRef.current = currentKey;

  const pushChain = useCallback((key: string) => {
    setChain((c) => (c.length && c[c.length - 1] === key ? c : [...c, key]));
  }, []);

  // Recenter = the primary gesture. Emits the frozen depth contract.
  const recenter = useCallback(
    (key: string) => {
      const k = String(key || "").toLowerCase();
      if (!k || k === currentKeyRef.current) return;
      const hops = chainRef.current.length + 1;
      if (hops >= 3) emitDepth("crossref-chain", k, 5);
      else emitDepth("crossref-follow", k, 1);
      pushChain(k);
    },
    [pushChain],
  );

  // External bus — keep the canonical events working (app.jsx untouched:
  // it still navigates + pushes its thread on codex:xref-jump and
  // re-broadcasts codex:xref-thread; here the graph follows along).
  useEffect(() => {
    const onJump = (e: Event): void => {
      const detail = (e as CustomEvent<{ key?: unknown }>).detail;
      const k = e && detail && detail.key;
      if (k) pushChain(String(k).toLowerCase());
    };
    const onBack = (): void => setChain((c) => c.slice(0, -1));
    window.addEventListener("codex:xref-jump", onJump);
    window.addEventListener("codex:xref-back", onBack);
    return () => {
      window.removeEventListener("codex:xref-jump", onJump);
      window.removeEventListener("codex:xref-back", onBack);
    };
  }, [pushChain]);

  // Double-click → jump the reader (prose is deliberate, law 3/4).
  const openInReader = useCallback((key: string) => {
    const p = parseVerseKey(key);
    if (!p) return;
    try {
      const w = xw();
      if (typeof w.codexGoto === "function") w.codexGoto(p.bookId, p.chapter, p.verse || 1);
      else if (typeof w.codexJumpToRef === "function") w.codexJumpToRef(formatRef(key));
    } catch (e) {}
  }, []);

  // Module load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTsk().then(
      (m) => {
        if (!cancelled) {
          setMod(m);
          setLoading(false);
        }
      },
      (e: unknown) => {
        if (!cancelled) {
          const er = e as { message?: string };
          setErr(er.message || String(e));
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Refs for the current center (chapter fallback preserved from v1).
  const refs = useMemo<TskRef[]>(() => {
    if (!mod || !mod.verses) return [];
    const direct = mod.verses[currentKey] || [];
    if (direct.length) return direct;
    const p = parseVerseKey(currentKey);
    if (!p) return [];
    const sameChapter = Object.keys(mod.verses).filter((k) => k.startsWith(`${p.bookId}.${p.chapter}.`));
    return sameChapter.length === 1 ? mod.verses[sameChapter[0]!] || [] : [];
  }, [mod, currentKey]);

  // Normalise: full TSK stores plain strings; the earlier sample stored
  // objects { ref, theme }. Support both, dedupe, sort canonically.
  const normRefs = useMemo<TskRefObject[]>(() => {
    return refs.map((r) => (typeof r === "string" ? { ref: r } : r));
  }, [refs]);

  const centerP = parseVerseKey(currentKey);
  const centerMeta = bookMeta(centerP ? centerP.bookId : "");
  const centerColor = centerMeta.testament === "NT" ? NT_C : OT_C;

  const nodes = useMemo<XrefNode[]>(() => {
    const seen = new Set<string>();
    const out: XrefNode[] = [];
    normRefs.forEach((r) => {
      const key = String(r.ref || "").toLowerCase();
      if (!key || seen.has(key) || key === currentKey) return;
      const p = parseVerseKey(key);
      if (!p) return;
      seen.add(key);
      const m = bookMeta(p.bookId);
      const theme = r.theme || null;
      out.push({
        key,
        theme,
        note: r.note || null,
        testament: m.testament,
        seam: !!(m.testament && centerMeta.testament && m.testament !== centerMeta.testament),
        strength: Number.isFinite(r.votes) ? r.votes! : Number.isFinite(r.w) ? r.w! : null,
        color: theme ? themeColor(theme) : m.testament === "NT" ? NT_C : OT_C,
        label: shortRef(key),
        order: (m.index < 0 ? 999 : m.index) * 1e6 + p.chapter * 1e3 + (p.verse || 0),
      });
    });
    out.sort((a, b) => a.order - b.order);
    return out;
  }, [normRefs, currentKey, centerMeta.testament]);
  const nodesRef = useRef<XrefNode[]>(nodes);
  nodesRef.current = nodes;

  // Hover readout — sticky (survives pointer leaving the canvas) so the
  // compare affordance is reachable. Cleared on recenter.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [expandedCompareKey, setExpandedCompareKey] = useState<string | null>(null);
  const [resonance, setResonance] = useState<Record<string, string | null>>({}); // targetKey -> string|null
  const aiEnabled = useMemo(() => hasAiKey(), [mod]);
  useEffect(() => {
    setFocusKey(null);
    setExpandedCompareKey(null);
  }, [currentKey]);

  const onToggleCompare = useCallback(
    (targetKey: string) => {
      setExpandedCompareKey((cur) => {
        const next = cur === targetKey ? null : targetKey;
        if (next && aiEnabled && !(targetKey in resonance)) {
          setResonance((r) => ({ ...r, [targetKey]: null }));
          fetchResonance(currentKey, targetKey, translation).then((note) => {
            setResonance((r) => ({ ...r, [targetKey]: note || "" }));
          });
        }
        return next;
      });
    },
    [aiEnabled, resonance, currentKey, translation],
  );

  // THE TEXT IS THE ZOOM-IN — tap the center (or ¶) and the verse's prose
  // unfolds beneath the canvas. Follows the center as you walk the web.
  const [textOpen, setTextOpen] = useState(false);
  const [verseText, setVerseText] = useState<VerseTextState | null>(null); // { key, state, text }
  useEffect(() => {
    if (!textOpen) return;
    let on = true;
    const key = currentKey;
    const p = parseVerseKey(key);
    if (!p) return;
    setVerseText({ key, state: "loading", text: null });
    const tr = translation || "web";
    Promise.resolve()
      .then(() => {
        const bible = xw().BIBLE;
        return bible && typeof bible.loadChapter === "function" ? bible.loadChapter(p.bookId, p.chapter, tr) : null;
      })
      .then((ch) => {
        if (!on) return;
        const v = chapterVerses(ch).find((x) => x && x.n === (p.verse || 1));
        const text = v ? String(v[tr] || v.text || "").trim() : "";
        setVerseText({ key, state: "done", text: text || null });
      })
      .catch(() => {
        if (on) setVerseText({ key, state: "done", text: null });
      });
    return () => {
      on = false;
    };
  }, [textOpen, currentKey, translation]);

  // Automation hooks (the codexConstInspect pattern) + canvas probe.
  const probeRef = useRef<ProbeRef>({ pos: {}, cx: 0, cy: 0 });
  useEffect(() => {
    const w = xw();
    w.codexXrefCenter = (ref) => {
      const k = normalizeKey(ref);
      if (k) recenter(k);
      return k || null;
    };
    w.codexXrefState = () => {
      const pb = probeRef.current || { pos: {}, cx: 0, cy: 0 };
      const list = nodesRef.current || [];
      return {
        center: currentKeyRef.current,
        chain: chainRef.current.slice(),
        count: list.length,
        nodes: list.map((nd) => {
          const p: Partial<Pt> = pb.pos[nd.key] || {};
          return { key: nd.key, x: p.x, y: p.y };
        }),
      };
    };
    return () => {
      delete w.codexXrefCenter;
      delete w.codexXrefState;
    };
  }, [recenter]);

  // The walked trail: [host, ...chain]; crumb i clicked → chain.slice(0, i).
  const crumbs = [hostKey, ...chain];
  const focusNode = focusKey ? nodes.find((n) => n.key === focusKey) : null;
  const focusSnip = focusNode ? snippetFor(focusNode.key, translation) : null;
  const note = focusNode ? resonance[focusNode.key] : undefined;

  return (
    <div className="cx-xrefg">
      <header className="cx-xrefg-head">
        <span className="cx-xrefg-counts">
          {loading
            ? "Treasury of Scripture Knowledge"
            : `${nodes.length} cross-reference${nodes.length === 1 ? "" : "s"} · Treasury of Scripture Knowledge`}
        </span>
      </header>

      {loading ? (
        <div style={statusStyle}>Loading TSK…</div>
      ) : err ? (
        <div style={{ ...statusStyle, color: "var(--cx-warn, #ffc46b)" }}>Couldn't load cross-references: {err}</div>
      ) : (
        <div>
          <XrefGraph
            nodes={nodes}
            centerKey={currentKey}
            centerLabel={formatRef(currentKey)}
            centerColor={centerColor}
            probeRef={probeRef}
            onRecenter={recenter}
            onReaderJump={openInReader}
            onCenterTap={() => setTextOpen((v) => !v)}
            onHoverNode={(k) => setFocusKey(k)}
          />
          {nodes.length === 0 ? (
            <div style={statusStyle}>
              No cross-references for <b>{formatRef(currentKey)}</b>.
            </div>
          ) : null}

          {/* the walked trail — each crumb re-centers back */}
          <nav className="cx-xrefg-trail" aria-label="Walked cross-reference trail">
            {chain.length > 0 ? (
              <button className="cx-xrefg-chip" onClick={() => setChain((c) => c.slice(0, -1))} title="Step back">
                ← back
              </button>
            ) : null}
            {crumbs.map((k, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {i > 0 ? <span className="cx-xrefg-crumb-sep">→</span> : null}
                <button
                  className={"cx-xrefg-chip cx-xrefg-crumb" + (i === crumbs.length - 1 ? " is-current" : "")}
                  onClick={() => {
                    if (i < crumbs.length - 1) setChain((c) => c.slice(0, i));
                  }}
                  aria-current={i === crumbs.length - 1 ? "true" : undefined}
                  title={i === crumbs.length - 1 ? "Current center" : `Re-center on ${formatRef(k)}`}
                >
                  {shortRef(k)}
                </button>
              </span>
            ))}
            <button
              className="cx-xrefg-chip"
              onClick={() => setTextOpen((v) => !v)}
              aria-pressed={textOpen}
              title="Unfold the center verse's text"
            >
              ¶ text
            </button>
          </nav>

          {/* the zoom-in: the center verse's prose, summoned */}
          {textOpen ? (
            <div className="cx-xrefg-text">
              {!verseText || verseText.state === "loading" ? (
                <span style={{ opacity: 0.55 }}>summoning…</span>
              ) : verseText.text ? (
                <p style={{ margin: 0 }}>
                  <sup>{parseVerseKey(verseText.key)?.verse || 1}</sup>
                  {verseText.text}
                </p>
              ) : (
                <span style={{ opacity: 0.55 }}>Text unavailable offline for {formatRef(currentKey)}.</span>
              )}
            </div>
          ) : null}

          {/* hover readout + the compare affordance */}
          <div className="cx-xrefg-readout">
            {focusNode ? (
              <div>
                <div className="cx-xrefg-ro-line">
                  <span className="cx-xrefg-ro-ref" style={{ color: focusNode.color }}>
                    {formatRef(focusNode.key)}
                  </span>
                  {focusNode.theme ? (
                    <span className="cx-xrefg-ro-theme" style={{ color: focusNode.color }}>
                      {focusNode.theme}
                    </span>
                  ) : null}
                  <button
                    className="cx-xrefg-chip"
                    style={
                      expandedCompareKey === focusNode.key
                        ? { color: "var(--cx-accent, #7ee0ff)", borderColor: "var(--cx-accent, #7ee0ff)" }
                        : undefined
                    }
                    onClick={() => onToggleCompare(focusNode.key)}
                    aria-expanded={expandedCompareKey === focusNode.key}
                    title="Compare side by side"
                  >
                    {expandedCompareKey === focusNode.key ? "× close" : "▦ compare"}
                  </button>
                  <button
                    className="cx-xrefg-chip"
                    onClick={() => openInReader(focusNode.key)}
                    title={`Open ${formatRef(focusNode.key)} in reader`}
                  >
                    open ↗
                  </button>
                </div>
                {focusNode.note ? <div className="cx-xrefg-ro-snip">{focusNode.note}</div> : null}
                {focusSnip ? (
                  <div className="cx-xrefg-ro-snip">
                    {focusSnip.length > 180 ? focusSnip.slice(0, 177) + "…" : focusSnip}
                  </div>
                ) : null}
                {expandedCompareKey === focusNode.key ? (
                  <div style={compareWrapStyle}>
                    <div style={compareColsStyle}>
                      <div style={compareColStyle}>
                        <div style={compareHeadStyle}>{formatRef(currentKey)}</div>
                        <div style={compareTextStyle}>
                          {snippetFor(currentKey, translation) || <span style={{ opacity: 0.55 }}>Text not cached.</span>}
                        </div>
                      </div>
                      <div style={compareColStyle}>
                        <div style={compareHeadStyle}>{formatRef(focusNode.key)}</div>
                        <div style={compareTextStyle}>
                          {focusSnip || <span style={{ opacity: 0.55 }}>Text not cached.</span>}
                        </div>
                      </div>
                    </div>
                    {aiEnabled && (note === null || (typeof note === "string" && note)) ? (
                      <div style={resonanceStyle}>
                        <span style={resonanceLabelStyle}>resonance</span>{" "}
                        {note === null ? <span style={{ opacity: 0.6 }}>reading…</span> : note}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : nodes.length ? (
              <div className="cx-xrefg-hint">
                hover a thread · click re-centers · double-click opens the reader · tap the center for text
              </div>
            ) : null}
          </div>

          {/* keyboard/screen-reader mirror — real buttons, Enter re-centers */}
          <ul
            className="cx-xrefg-alist"
            role="list"
            aria-label={`Cross-references of ${formatRef(currentKey)} — Enter re-centers the web`}
          >
            {nodes.map((nd) => (
              <li key={nd.key} role="listitem">
                <button className="cx-xrefg-chip" onClick={() => recenter(nd.key)} onFocus={() => setFocusKey(nd.key)}>
                  {formatRef(nd.key)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="cx-xrefg-foot">
        <span>
          R. A. Torrey, Treasury of Scripture Knowledge · public domain
          {mod && mod.meta && mod.meta.totalRefs ? ` · ${Number(mod.meta.totalRefs).toLocaleString()} refs corpus-wide` : ""}
        </span>
        <span>
          OT <span style={{ color: OT_C }}>●</span> · NT <span style={{ color: NT_C }}>●</span> · seam{" "}
          <span style={{ color: SEAM_C }}>—</span>
        </span>
      </footer>
    </div>
  );
}

// Inline styles for the bits shared with v1 (compare block, statuses).
const statusStyle: React.CSSProperties = { padding: "16px 4px", opacity: 0.8 };
const compareWrapStyle: React.CSSProperties = {
  margin: "8px 0 2px",
  padding: "8px",
  border: "1px solid var(--cx-rule, rgba(126,224,255,0.18))",
  borderRadius: 4,
  background: "var(--cx-panel, rgba(255,255,255,0.03))",
};
const compareColsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};
const compareColStyle: React.CSSProperties = { minWidth: 0 };
const compareHeadStyle: React.CSSProperties = {
  fontFamily: "var(--cx-font-mono, ui-monospace, JetBrains Mono, monospace)",
  color: "var(--cx-accent, #7ee0ff)",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
};
const compareTextStyle: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, opacity: 0.92 };
const resonanceStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 6,
  borderTop: "1px dotted var(--cx-rule, rgba(126,224,255,0.18))",
  fontSize: 12,
  lineHeight: 1.5,
  fontStyle: "italic",
  opacity: 0.9,
};
const resonanceLabelStyle: React.CSSProperties = {
  fontStyle: "normal",
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  opacity: 0.55,
  fontFamily: "var(--cx-font-mono, ui-monospace, monospace)",
};
