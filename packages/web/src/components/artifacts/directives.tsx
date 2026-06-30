// artifacts — fenced DIRECTIVE blocks (migrated VERBATIM from artifacts.jsx).
// Buttons route through the app's public doors; charts and flows are hand-rolled
// SVG (zero deps, theme tokens only, honest value labels); verse-grid renders
// live scripture cards. Unparsable directives render honest, never silent.
import React from "react";
import { aw, versesOf } from "./artifacts-window.js";
import { artSplitOnRefs } from "./refs.js";
import { artParseJSON, artRunAction, artPrimaryTranslation, type ArtAction } from "./actions.js";
import { ART_ACCENT, ART_FG, ART_DIM, ART_HUES, artNum, artFmt } from "./chart-util.js";

const { useState, useEffect, useMemo } = React;

// ── unparsable directive — honest, never silent ───────────────────────────
export function ArtBroken({ tag, code }: { tag: string; code: unknown }): React.ReactElement {
  return (
    <div className="cx-art-broken" role="note">
      <b>UNRENDERED {tag}</b> — payload was not valid JSON
      <pre className="cx-art-code">{String(code || "").slice(0, 400)}</pre>
    </div>
  );
}

interface ArtButtonItem {
  label: string;
  action: ArtAction;
}
function isButtonItem(b: unknown): b is ArtButtonItem {
  const r = b as { label?: unknown; action?: unknown } | null | undefined;
  return !!r && typeof r.label === "string" && !!r.action && typeof r.action === "object";
}

export function ArtButtons({ code }: { code: unknown }): React.ReactElement {
  const items = artParseJSON(code);
  if (!Array.isArray(items)) return <ArtBroken tag="codex:buttons" code={code} />;
  const good = (items as unknown[]).filter(isButtonItem).slice(0, 8);
  if (!good.length) return <ArtBroken tag="codex:buttons" code={code} />;
  return (
    <div className="cx-art-buttons" role="group" aria-label="Suggested actions">
      {good.map((b, i) => (
        <button
          key={i}
          type="button"
          className="cx-art-btn"
          onClick={() => artRunAction(b.action)}
          title={`${b.action.kind || "action"}${b.action.ref ? " · " + b.action.ref : ""}${b.action.id ? " · " + b.action.id : ""}${b.action.key ? ` · ${b.action.key}=${JSON.stringify(b.action.value)}` : ""}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

interface ChartDatum {
  label?: unknown;
  value?: unknown;
}
interface ChartSpec {
  type?: unknown;
  title?: unknown;
  data?: unknown;
}

export function ArtChart({ code }: { code: unknown }): React.ReactElement {
  const spec = artParseJSON(code) as ChartSpec | null | undefined;
  const data: ChartDatum[] | null =
    spec && Array.isArray(spec.data)
      ? (spec.data as ChartDatum[]).filter((d) => d && d.label !== undefined && d.value !== undefined).slice(0, 16)
      : null;
  if (!data || !data.length) return <ArtBroken tag="codex:chart" code={code} />;
  const s = spec as ChartSpec;
  const type = String(s.type || "bar").toLowerCase();
  const title = typeof s.title === "string" ? s.title : "";
  const max = Math.max(...data.map((d) => Math.abs(artNum(d.value))), 1);

  let svg: React.ReactElement | null = null;
  if (type === "line") {
    const W = 360, H = 150, padL = 16, padR = 38, padT = 16, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const pts = data.map((d, i) => ({
      x: padL + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw),
      y: padT + ih - (artNum(d.value) / max) * ih,
      d,
    }));
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label={`Line chart${title ? ": " + title : ""}`}>
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke={ART_DIM} strokeWidth="0.6" opacity="0.6" />
        <polyline fill="none" stroke={ART_ACCENT} strokeWidth="1.6" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.6" fill={ART_ACCENT} />
            <text x={p.x} y={p.y - 6} fontSize="8.5" fill={ART_FG} textAnchor="middle">{artFmt(p.d.value)}</text>
            <text x={p.x} y={H - 8} fontSize="8" fill={ART_DIM} textAnchor="middle">{String(p.d.label).slice(0, 9)}</text>
          </g>
        ))}
      </svg>
    );
  } else if (type === "radial") {
    const W = 360, H = Math.max(150, data.length * 18 + 40), cx = 86, cy = H / 2;
    const R = Math.min(64, H / 2 - 12), r0 = 26;
    const total = data.reduce((sum, d) => sum + Math.abs(artNum(d.value)), 0) || 1;
    let a = -Math.PI / 2;
    const segs = data.map((d, i) => {
      const frac = Math.abs(artNum(d.value)) / total;
      const a0 = a, a1 = a + frac * Math.PI * 2 - 0.015;
      a += frac * Math.PI * 2;
      const px = (ang: number, rad: number): [number, number] => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
      const [x0, y0] = px(a0, R), [x1, y1] = px(a1, R), [x2, y2] = px(a1, r0), [x3, y3] = px(a0, r0);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return {
        d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`,
        hue: ART_HUES[i % ART_HUES.length] as string,
        item: d,
      };
    });
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label={`Radial chart${title ? ": " + title : ""}`}>
        {segs.map((seg, i) => <path key={i} d={seg.d} fill={seg.hue} opacity="0.85" />)}
        {segs.map((seg, i) => (
          <g key={"l" + i}>
            <rect x={176} y={14 + i * 18} width="8" height="8" fill={seg.hue} />
            <text x={190} y={22 + i * 18} fontSize="9" fill={ART_FG}>
              {String(seg.item.label).slice(0, 18)} · {artFmt(seg.item.value)}
            </text>
          </g>
        ))}
      </svg>
    );
  } else {
    // bar (default)
    const rowH = 22, W = 360, padT = 6;
    const H = data.length * rowH + padT + 6;
    const labelW = 104, barMax = W - labelW - 50;
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label={`Bar chart${title ? ": " + title : ""}`}>
        {data.map((d, i) => {
          const w = Math.max(1.5, (Math.abs(artNum(d.value)) / max) * barMax);
          const y = padT + i * rowH;
          return (
            <g key={i}>
              <text x={labelW - 6} y={y + 14} fontSize="9" fill={ART_FG} textAnchor="end">{String(d.label).slice(0, 16)}</text>
              <rect x={labelW} y={y + 5} width={w} height={12} fill={ART_HUES[i % ART_HUES.length] as string} opacity="0.85" rx="1.5" />
              <text x={labelW + w + 5} y={y + 14} fontSize="9" fill={ART_FG}>{artFmt(d.value)}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <figure className="cx-art-chart">
      {title ? <figcaption className="cx-art-chart-title">{title}</figcaption> : null}
      {svg}
    </figure>
  );
}

interface FlowSpec {
  nodes?: unknown;
  edges?: unknown;
}
interface FlowNodeRaw {
  id?: unknown;
  label?: unknown;
  ref?: unknown;
}
interface FlowEdgeRaw {
  from?: unknown;
  to?: unknown;
  label?: unknown;
}
interface FlowNode {
  id: string;
  label: string;
  ref: unknown;
}

export function ArtFlow({ code }: { code: unknown }): React.ReactElement {
  const spec = artParseJSON(code) as FlowSpec | null | undefined;
  const nodes: FlowNode[] | null =
    spec && Array.isArray(spec.nodes)
      ? (spec.nodes as FlowNodeRaw[])
          .filter((n) => n && n.id !== undefined)
          .slice(0, 16)
          .map((n) => ({ id: String(n.id), label: String(n.label || n.id), ref: n.ref }))
      : null;
  if (!nodes || !nodes.length) return <ArtBroken tag="codex:flow" code={code} />;
  const s = spec as FlowSpec;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(s.edges) ? (s.edges as FlowEdgeRaw[]) : [])
    .filter((e) => e && ids.has(String(e.from)) && ids.has(String(e.to)) && String(e.from) !== String(e.to))
    .slice(0, 24)
    .map((e) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label) : "" }));

  // layered layout: layer(n) = longest path from any source (cycle-safe).
  const layer: Record<string, number> = {};
  nodes.forEach((n) => {
    layer[n.id] = 0;
  });
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const e of edges) {
      if ((layer[e.to] ?? 0) < (layer[e.from] ?? 0) + 1 && (layer[e.from] ?? 0) + 1 < nodes.length) {
        layer[e.to] = (layer[e.from] ?? 0) + 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const cols: Record<string, FlowNode[]> = {};
  nodes.forEach((n) => {
    const L = layer[n.id] ?? 0;
    (cols[L] = cols[L] || []).push(n);
  });
  const NW = 132, NH = 36, GX = 64, GY = 22;
  const nLayers = Object.keys(cols).length;
  const maxRows = Math.max(...Object.values(cols).map((c) => c.length));
  const W = nLayers * NW + (nLayers - 1) * GX + 24;
  const H = maxRows * NH + (maxRows - 1) * GY + 24;
  const posOf: Record<string, { x: number; y: number }> = {};
  Object.keys(cols)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((L) => {
      const col = cols[L] ?? [];
      const colH = col.length * NH + (col.length - 1) * GY;
      col.forEach((n, i) => {
        posOf[n.id] = { x: 12 + Number(L) * (NW + GX), y: (H - colH) / 2 + i * (NH + GY) };
      });
    });

  return (
    <figure className="cx-art-flow">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={Math.min(W, 560)}
        role="img"
        aria-label={`Flow diagram: ${nodes.map((n) => n.label).join(" → ")}`}
      >
        <defs>
          <marker id="cx-art-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={ART_ACCENT} />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = posOf[e.from]!;
          const b = posOf[e.to]!;
          const x0 = a.x + NW, y0 = a.y + NH / 2, x1 = b.x, y1 = b.y + NH / 2;
          const mx = (x0 + x1) / 2;
          const back = x1 <= x0; // same-layer / backward edge: bow around
          const d = back
            ? `M${a.x + NW / 2},${a.y + NH} C${a.x + NW / 2},${a.y + NH + 26} ${b.x + NW / 2},${b.y - 26} ${b.x + NW / 2},${b.y}`
            : `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
          return (
            <g key={"e" + i}>
              <path d={d} fill="none" stroke={ART_ACCENT} strokeWidth="1.1" opacity="0.75" markerEnd="url(#cx-art-arrow)" />
              {e.label ? (
                <text
                  x={back ? (a.x + b.x + NW) / 2 : mx}
                  y={back ? (a.y + NH + b.y) / 2 + 3 : (y0 + y1) / 2 - 4}
                  fontSize="7.5"
                  fill={ART_DIM}
                  textAnchor="middle"
                >
                  {e.label.slice(0, 22)}
                </text>
              ) : null}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = posOf[n.id]!;
          const clickable = !!n.ref;
          return (
            <g
              key={n.id}
              onClick={clickable ? () => { if (aw().codexJumpToRef) aw().codexJumpToRef?.(String(n.ref)); } : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? "button" : undefined}
              aria-label={clickable ? `Open the reader at ${n.ref}` : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (aw().codexJumpToRef) aw().codexJumpToRef?.(String(n.ref));
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={p.x}
                y={p.y}
                width={NW}
                height={NH}
                rx="5"
                fill="rgba(126,224,255,0.07)"
                stroke={clickable ? ART_ACCENT : "rgba(126,224,255,0.4)"}
                strokeWidth="1"
              />
              <text x={p.x + NW / 2} y={p.y + NH / 2 + 3} fontSize="9" fill={ART_FG} textAnchor="middle">
                {n.label.slice(0, 20)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

interface ParsedCard {
  bookId: string;
  chapter: number;
  v1?: number | null;
  v2?: number | null;
  bookName?: string;
}
interface VCardState {
  lines: Array<{ n: number; text: string }> | null;
  err: boolean;
}

export function ArtVerseCard({ refStr }: { refStr: string }): React.ReactElement {
  const [state, setState] = useState<VCardState>({ lines: null, err: false });
  const parsed = useMemo<ParsedCard | null | undefined>(() => {
    try {
      const k = aw().CODEX_KERNEL;
      if (k && k.parseRef) return k.parseRef(refStr);
    } catch {
      /* ignore */
    }
    const segs = artSplitOnRefs(refStr);
    const r = segs.find((seg) => seg.type === "ref");
    return r && r.type === "ref"
      ? { bookId: r.ref.bookId, bookName: r.ref.label, chapter: r.ref.chapter, v1: r.ref.verse, v2: r.ref.endVerse }
      : null;
  }, [refStr]);

  useEffect(() => {
    if (!parsed) {
      setState({ lines: null, err: true });
      return;
    }
    let dead = false;
    void (async () => {
      try {
        const trans = artPrimaryTranslation();
        const data = await aw().BIBLE!.loadChapter(parsed.bookId, parsed.chapter, trans);
        const verses = versesOf(data);
        const v1 = parsed.v1 || 1;
        const v2 = Math.min(parsed.v2 || v1, v1 + 3);
        const lines: Array<{ n: number; text: string }> = [];
        for (let n = v1; n <= v2; n++) {
          const v = verses.find((x) => (x.n || x.verse) === n);
          if (v) lines.push({ n, text: String(v.text || (v[trans] as string | undefined) || "").trim() });
        }
        if (!dead) setState({ lines, err: !lines.length });
      } catch {
        if (!dead) setState({ lines: null, err: true });
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faithful to legacy: depends on refStr only
  }, [refStr]);

  const jump = (): void => {
    if (parsed && aw().codexGoto) aw().codexGoto?.(parsed.bookId, parsed.chapter, parsed.v1 || 1);
    else if (aw().codexJumpToRef) aw().codexJumpToRef?.(refStr);
  };

  return (
    <button type="button" className="cx-art-vcard" onClick={jump} title={`Open the reader at ${refStr}`}>
      <span className="cx-art-vcard-ref">{refStr}</span>
      {state.err ? (
        <span className="cx-art-vcard-txt is-dim">(text unavailable here — tap to open the reader)</span>
      ) : state.lines === null ? (
        <span className="cx-art-vcard-txt is-dim">loading…</span>
      ) : (
        <span className="cx-art-vcard-txt">
          {state.lines.map((l) => (
            <span key={l.n}>
              <sup style={{ opacity: 0.6 }}>{l.n}</sup> {l.text}{" "}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export function ArtVerseGrid({ code }: { code: unknown }): React.ReactElement {
  const refs = artParseJSON(code);
  const good = Array.isArray(refs)
    ? (refs as unknown[]).filter((r): r is string => typeof r === "string" && !!r.trim()).slice(0, 12)
    : null;
  if (!good || !good.length) return <ArtBroken tag="codex:verse-grid" code={code} />;
  return (
    <div className="cx-art-vgrid">
      {good.map((r, i) => (
        <ArtVerseCard key={r + i} refStr={r.trim()} />
      ))}
    </div>
  );
}

export function artRenderFence(b: { lang: string; code: string }, key: React.Key): React.ReactElement {
  const lang = b.lang || "";
  if (lang === "codex:buttons") return <ArtButtons key={key} code={b.code} />;
  if (lang === "codex:chart") return <ArtChart key={key} code={b.code} />;
  if (lang === "codex:flow") return <ArtFlow key={key} code={b.code} />;
  if (lang === "codex:verse-grid" || lang === "codex:verses") return <ArtVerseGrid key={key} code={b.code} />;
  if (lang.startsWith("codex:")) return <ArtBroken key={key} tag={lang} code={b.code} />;
  return (
    <pre key={key} className="cx-art-code">
      {b.code}
    </pre>
  );
}
