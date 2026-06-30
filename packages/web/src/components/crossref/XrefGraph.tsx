// crossref — the canvas instrument (migrated from crossref.jsx). Static radial
// ego-graph. All hot state lives in refs; React only feeds it nodes + center
// and receives gestures back. Imperative (pointer + RAF + ResizeObserver),
// DPR-aware, prefers-reduced-motion → snap.
import React from "react";
import { rgba, cssFg, SEAM_C, SERIF_FONT, MONO_FONT } from "./helpers.js";
import type { XrefNode, Pt, ProbeRef } from "./crossref-window.js";

const { useEffect, useMemo, useRef } = React;

interface XrefGraphProps {
  nodes: XrefNode[];
  centerKey: string;
  centerLabel: string;
  centerColor: string;
  probeRef: React.MutableRefObject<ProbeRef>;
  onRecenter: (key: string) => void;
  onReaderJump: (key: string) => void;
  onCenterTap: () => void;
  onHoverNode: (key: string) => void;
}

interface EngineState {
  w: number;
  h: number;
  dpr: number;
  cx: number;
  cy: number;
  pos: Record<string, Pt>;
  targets: Record<string, Pt>;
  from: Record<string, Pt>;
  t0: number;
  raf: number;
  hover: string | null;
}
type Hit = { node: XrefNode } | { center: boolean } | null;
interface Engine {
  layout: (immediate: boolean) => void;
  draw: () => void;
  hit: (mx: number, my: number) => Hit;
  st: EngineState;
}

interface CenterRef {
  key: string;
  label: string;
  color: string;
}
interface Callbacks {
  onRecenter: (key: string) => void;
  onReaderJump: (key: string) => void;
  onCenterTap: () => void;
  onHoverNode: (key: string) => void;
}

export function XrefGraph({
  nodes,
  centerKey,
  centerLabel,
  centerColor,
  probeRef,
  onRecenter,
  onReaderJump,
  onCenterTap,
  onHoverNode,
}: XrefGraphProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const clickT = useRef<number>(0);

  // Latest props readable from the imperative engine.
  const nodesRef = useRef<XrefNode[]>(nodes);
  nodesRef.current = nodes;
  const centerRef = useRef<CenterRef | null>(null);
  centerRef.current = { key: centerKey, label: centerLabel, color: centerColor };
  const cbRef = useRef<Callbacks | null>(null);
  cbRef.current = { onRecenter, onReaderJump, onCenterTap, onHoverNode };

  useEffect(() => {
    const canvas = canvasRef.current,
      wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx2 = canvas.getContext("2d")!;
    const st: EngineState = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, pos: {}, targets: {}, from: {}, t0: 0, raf: 0, hover: null };

    const reduced = (): boolean => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    };

    // Ring-ordered radial layout (canonical order). If a module carries
    // per-ref strength (votes/weights), distance becomes ∝ 1/strength.
    function computeTargets(): { targets: Record<string, Pt>; cx: number; cy: number } {
      const cx = st.w / 2,
        cy = st.h / 2;
      const list = nodesRef.current;
      const n = list.length;
      const maxR = Math.max(40, Math.min(st.w, st.h) / 2 - 30);
      const targets: Record<string, Pt> = {};
      const hasStrength = list.some((nd) => Number.isFinite(nd.strength));
      const maxS = hasStrength ? Math.max(1, ...list.map((nd) => nd.strength || 1)) : 1;
      list.forEach((nd, i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
        let r: number;
        if (hasStrength) {
          const s = Math.max(0, Math.min(1, (nd.strength || 1) / maxS));
          r = maxR * (1 - 0.55 * s); // strong link = close orbit
        } else {
          // gentle 3-step radius stagger keeps crowded rings legible
          r = n <= 16 ? maxR * 0.82 : maxR * (0.68 + (0.16 * (i % 3)) / 2);
        }
        targets[nd.key] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
      return { targets, cx, cy };
    }

    function draw(): void {
      ctx2.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx2.clearRect(0, 0, st.w, st.h);
      const list = nodesRef.current;
      const C = centerRef.current!;
      const many = list.length > 24;
      // edges first
      list.forEach((nd) => {
        const p = st.pos[nd.key];
        if (!p) return;
        const hov = st.hover === nd.key;
        ctx2.strokeStyle = rgba(nd.seam ? SEAM_C : nd.color, hov ? 0.9 : 0.26);
        ctx2.lineWidth = hov ? 1.6 : 1;
        ctx2.beginPath();
        ctx2.moveTo(st.cx, st.cy);
        ctx2.lineTo(p.x, p.y);
        ctx2.stroke();
      });
      // orbit nodes + labels
      list.forEach((nd) => {
        const p = st.pos[nd.key];
        if (!p) return;
        const hov = st.hover === nd.key;
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, hov ? 6 : 4.2, 0, Math.PI * 2);
        ctx2.fillStyle = rgba(nd.color, hov ? 1 : 0.92);
        ctx2.fill();
        if (!many || hov) {
          ctx2.font = (hov ? "600 " : "") + "8.5px " + MONO_FONT;
          const dx = p.x - st.cx,
            dy = p.y - st.cy,
            dl = Math.hypot(dx, dy) || 1;
          ctx2.textAlign = Math.abs(dx) < dl * 0.35 ? "center" : dx > 0 ? "left" : "right";
          ctx2.textBaseline = dy > dl * 0.35 ? "top" : dy < -dl * 0.35 ? "bottom" : "middle";
          ctx2.fillStyle = rgba(nd.color, hov ? 1 : 0.7);
          ctx2.fillText(nd.label, p.x + (dx / dl) * 9, p.y + (dy / dl) * 9);
        }
      });
      // the center — current verse, serif label (law 7: the Word is serif)
      ctx2.beginPath();
      ctx2.arc(st.cx, st.cy, 8, 0, Math.PI * 2);
      ctx2.fillStyle = C.color;
      ctx2.fill();
      ctx2.beginPath();
      ctx2.arc(st.cx, st.cy, 11.5, 0, Math.PI * 2);
      ctx2.strokeStyle = rgba(C.color, 0.45);
      ctx2.lineWidth = 1;
      ctx2.stroke();
      ctx2.font = "600 13px " + SERIF_FONT;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "top";
      ctx2.fillStyle = cssFg();
      ctx2.fillText(C.label, st.cx, st.cy + 16);
    }

    function layout(immediate: boolean): void {
      const { targets, cx, cy } = computeTargets();
      st.cx = cx;
      st.cy = cy;
      st.targets = targets;
      if (probeRef) probeRef.current = { pos: targets, cx, cy };
      cancelAnimationFrame(st.raf);
      if (immediate || reduced()) {
        st.pos = Object.assign({}, targets);
        draw();
        return;
      }
      st.from = {};
      Object.keys(targets).forEach((k) => {
        st.from[k] = st.pos[k] || { x: cx, y: cy };
      });
      st.t0 = performance.now();
      const tick = (): void => {
        const t = Math.min(1, (performance.now() - st.t0) / 300);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const pos: Record<string, Pt> = {};
        Object.keys(st.targets).forEach((k) => {
          const a = st.from[k]!,
            b = st.targets[k]!;
          pos[k] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
        });
        st.pos = pos;
        draw();
        if (t < 1) st.raf = requestAnimationFrame(tick);
      };
      st.raf = requestAnimationFrame(tick);
    }

    function resize(): void {
      if (!wrap || !canvas) return;
      const r = wrap.getBoundingClientRect();
      st.w = Math.max(80, r.width);
      st.h = Math.max(80, r.height);
      st.dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(st.w * st.dpr);
      canvas.height = Math.round(st.h * st.dpr);
      layout(true);
    }

    function hit(mx: number, my: number): Hit {
      let best: XrefNode | null = null,
        bd = 13;
      nodesRef.current.forEach((nd) => {
        const p = st.pos[nd.key];
        if (!p) return;
        const d = Math.hypot(mx - p.x, my - p.y);
        if (d < bd) {
          bd = d;
          best = nd;
        }
      });
      if (best) return { node: best };
      if (Math.hypot(mx - st.cx, my - st.cy) < 16) return { center: true };
      return null;
    }

    engineRef.current = { layout, draw, hit, st };
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    resize();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(st.raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-layout (eased) when the node set or the center changes.
  const sig = useMemo(() => centerKey + "::" + nodes.map((n) => n.key).join("|"), [nodes, centerKey]);
  useEffect(() => {
    if (engineRef.current) engineRef.current.layout(false);
  }, [sig]);

  const evPos = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const handleMove = (e: React.PointerEvent): void => {
    const eng = engineRef.current;
    if (!eng) return;
    const { x, y } = evPos(e);
    const h = eng.hit(x, y);
    const key = h && "node" in h ? h.node.key : null;
    canvasRef.current!.style.cursor = h ? "pointer" : "";
    if (key !== eng.st.hover) {
      eng.st.hover = key;
      eng.draw();
      if (key) cbRef.current!.onHoverNode(key);
    }
  };
  const handleLeave = (): void => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.st.hover) {
      eng.st.hover = null;
      eng.draw();
    }
  };
  // click = recenter (or center-tap → text); double-click = open in reader.
  // Double detection is self-reliant (two clicks on the same target within
  // 350ms, or a native detail>=2): headless Chrome and most touch browsers
  // never synthesize `dblclick`, so we don't depend on it.
  const lastClick = useRef<{ t: number; key: string | null }>({ t: 0, key: null });
  const handleClick = (e: React.MouseEvent): void => {
    const eng = engineRef.current;
    if (!eng) return;
    const { x, y } = evPos(e);
    const h = eng.hit(x, y);
    const now = performance.now();
    const key = h ? ("center" in h ? "__center__" : h.node.key) : null;
    const isDbl =
      !!key && (e.detail >= 2 || (key === lastClick.current.key && now - lastClick.current.t < 350));
    lastClick.current = { t: now, key };
    if (clickT.current) {
      clearTimeout(clickT.current);
      clickT.current = 0;
    }
    if (!h) return;
    if (isDbl) {
      if ("node" in h) cbRef.current!.onReaderJump(h.node.key);
      else cbRef.current!.onCenterTap();
      return;
    }
    clickT.current = window.setTimeout(() => {
      clickT.current = 0;
      if ("center" in h) cbRef.current!.onCenterTap();
      else cbRef.current!.onRecenter(h.node.key);
    }, 280);
  };

  return (
    <div ref={wrapRef} className="cx-xrefg-stage">
      <canvas
        ref={canvasRef}
        className="cx-xrefg-canvas"
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onClick={handleClick}
        aria-hidden="true"
      />
    </div>
  );
}
