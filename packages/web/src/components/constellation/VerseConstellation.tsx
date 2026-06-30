// CODEX — constellation (migrated from constellation.jsx). ❂ THE CONSTELLATION
// — the canon as one galaxy. Every cross-reference in the Treasury of Scripture
// Knowledge as navigable 3D space. The galaxy is the ONLY view since v9.3.
//
// Faithful TSX port: identical DOM, event listeners, side-effects, and window
// boundary. Pure graph logic lives in ./graph.ts; the runtime globals it reads
// (data, engines, the reader's navigation doors, telemetry) go through cw().
import React from "react";
import {
  constPath,
  constGalaxyLayout,
  constFamilies,
  buildCanon,
  constAggregate,
  type Canon,
  type Families,
  type AggregateResult,
} from "./graph.js";
import { cw, type CodexData, type CodexTranslation, type VerseRow, type ConstFlight } from "./constellation-window.js";
import { injectTextCSS } from "./style.js";

const { useState, useEffect, useRef } = React;

const CONST_OT_HUE = "#7ee0ff";
const CONST_NT_HUE = "#e8b465";
const CONST_GOLD = "#ffd479";
const CONST_FAMILY_HUES = ["#7ee0ff", "#e8b465", "#b88cff", "#9bd66b", "#ff8291", "#5bd0b0", "#e0a7ff", "#ffd479"];

type Phase = "loading" | "ready" | "error";
interface Progress {
  pct: number;
  threads: number;
}
interface ConstData extends AggregateResult {
  canon: Canon;
}
interface Hud {
  label: string;
  threads: number;
}
interface Row {
  idx: number;
  label: string;
  w: number;
}
interface Route {
  path: number[];
  labels: string[];
}
interface Near {
  idx: number;
  label: string;
  rows: Row[];
}
interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}
interface CamLerp {
  tx: number;
  ty: number;
  tz: number;
  dist: number;
}
interface DragState {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  moved: boolean;
}
type InfoText =
  | { state: "loading" }
  | { state: "ready"; verses: VerseRow[]; from: string }
  | { state: "none" };
interface InfoState {
  idx: number;
  label: string;
  bookId: string;
  chapter: number;
  testament: string;
  fam: number;
  degree: number;
  threads: number;
  rows: Row[];
  text: InfoText;
}

interface VerseConstellationProps {
  onClose: () => void;
}

export function VerseConstellation({ onClose }: VerseConstellationProps): React.ReactElement {
  const I = cw().CODEX_INTEL!;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("loading"); // loading | ready | error
  const [progress, setProgress] = useState<Progress>({ pct: 0, threads: 0 });
  const [err, setErr] = useState<string | null>(null);
  const dataRef = useRef<ConstData | null>(null); // { canon, pairs, adj, threads }
  const [hud, setHud] = useState<Hud | null>(null); // { label, threads } | null
  // v10 — clicking a star opens a REAL dossier, not a two-line hud:
  // { idx, label, bookId, chapter, testament, fam, degree, threads, rows }
  const [info, setInfo] = useState<InfoState | null>(null);

  // ── Graph-instrument state: query → PATH / NEAR; FAMILIES color mode ──
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState<Route | null>(null); // { path:[idx], labels:[str] } | null
  const [near, setNear] = useState<Near | null>(null); // { label, rows:[{idx,label,w}] } | null
  const [famOn, setFamOn] = useState(false);
  const famRef = useRef<Families | null>(null); // { label[], families }

  const labelOf = (idx: number): string => {
    const c = dataRef.current!.canon.chapters[idx]!;
    return `${c.bookName} ${c.ch}`;
  };

  const runQuery = (): void => {
    const d = dataRef.current;
    if (!d) return;
    const K = cw().CODEX_KERNEL;
    const text = query.trim();
    setRoute(null);
    setNear(null);
    if (!text || !K?.parseRef) return;
    const idxOf = (s: string): number => {
      const p = K?.parseRef(s.trim());
      if (!p) return -1;
      const off = d.canon.offset[p.bookId];
      return off === undefined ? -1 : off + p.chapter - 1;
    };
    const m = text.split(/\s*(?:->|→|>| to )\s*/i);
    if (m.length >= 2) {
      const a = idxOf(m[0]!),
        b = idxOf(m[1]!);
      if (a < 0 || b < 0) {
        setHud({ label: "UNREADABLE REFS", threads: 0 });
        return;
      }
      const path = constPath(d.adj, a, b);
      if (!path) {
        setHud({ label: "NO THREAD PATH", threads: 0 });
        return;
      }
      setRoute({ path, labels: path.map(labelOf) });
      // fly the camera to the route's origin so the gold thread is in view
      if (galaxyRef.current) {
        selRef.current = a;
        flyTo(a);
      }
    } else {
      const a = idxOf(text);
      if (a < 0) {
        setHud({ label: "UNREADABLE REF", threads: 0 });
        return;
      }
      const rows: Row[] = (d.adj.get(a) || [])
        .slice()
        .sort((x, y) => y[1] - x[1])
        .slice(0, 14)
        .map(([idx, w]) => ({ idx, label: labelOf(idx), w }));
      setNear({ idx: a, label: labelOf(a), rows });
      if (galaxyRef.current) {
        selRef.current = a;
        flyTo(a);
      }
    }
  };

  const toggleFamilies = (): void => {
    const d = dataRef.current;
    if (!d) return;
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    setFamOn((v) => !v);
  };

  // v10.2 — the dossier carries the Word itself: the whole chapter when it
  // fits, an honest preview when long, a pulsing orb while it travels.
  // Source resolution mirrors the reader's chain (primary first, then any
  // corpus whose declared canons cover the book) — DC stars read too.
  const inspectSeqRef = useRef(0);
  const dossierSourceChain = (bookId: string): string[] => {
    const D: CodexData = cw().CODEX_DATA || {};
    const book = (D.books || []).find((b) => b.id === bookId);
    const primary = (D.tweaks && D.tweaks.primaryTranslation) || "web";
    const canonsOf = (t: CodexTranslation): Set<string> => new Set(t.canons && t.canons.length ? t.canons : ["protestant"]);
    const covers = (t: CodexTranslation): boolean => {
      const c = canonsOf(t);
      if (!book) return c.has("protestant");
      if (book.testament === "OT") return c.has("protestant") || c.has("ot");
      if (book.testament === "NT") return c.has("protestant") || c.has("nt");
      return c.has(book.canon as string);
    };
    const all = D.translations || [];
    const chain: string[] = [];
    const cur = all.find((t) => t.id === primary);
    if (cur && covers(cur)) chain.push(primary);
    all.forEach((t) => {
      if (t.id !== primary && covers(t)) chain.push(t.id);
    });
    return chain.length ? chain : [primary];
  };

  // v10 — the star dossier. Everything the graph knows about one chapter,
  // readable and actionable: testament, family, thread mass, strongest
  // neighbors (each clickable), READ / NEAR / PATH-FROM verbs.
  const inspect = (idx: number): void => {
    const d = dataRef.current;
    if (!d || idx < 0 || idx >= d.canon.count) return;
    const c = d.canon.chapters[idx]!;
    const edges = d.adj.get(idx) || [];
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    const rows: Row[] = edges
      .slice()
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([i2, w]) => ({ idx: i2, label: labelOf(i2), w }));
    selRef.current = idx;
    setHud(null);
    setInfo({
      idx,
      label: labelOf(idx),
      bookId: c.bookId,
      chapter: c.ch,
      testament: c.testament || "DC",
      fam: famRef.current!.label[idx]!,
      degree: edges.length,
      threads: edges.reduce((s, [, w2]) => s + w2, 0),
      rows,
      text: { state: "loading" },
    });
    // fetch the chapter text — sequence-guarded so a fast second click
    // never paints a stale chapter into a fresh dossier
    const seq = ++inspectSeqRef.current;
    void (async () => {
      for (const tr of dossierSourceChain(c.bookId)) {
        try {
          const vv = await cw().BIBLE!.loadChapter(c.bookId, c.ch, tr);
          if (vv && vv.length && vv.some((v) => v.text && v.text.trim())) {
            if (inspectSeqRef.current !== seq) return;
            setInfo((prev) => (prev && prev.idx === idx ? { ...prev, text: { state: "ready", verses: vv, from: tr } } : prev));
            return;
          }
        } catch {
          /* next source */
        }
      }
      if (inspectSeqRef.current !== seq) return;
      setInfo((prev) => (prev && prev.idx === idx ? { ...prev, text: { state: "none" } } : prev));
    })();
  };
  // test + automation hook (smoke uses this — canvas pixels can't be queried)
  useEffect(() => {
    cw().codexConstInspect = (idx: number): void => {
      inspect(idx);
      if (galaxyRef.current) flyTo(idx);
    };
    return () => {
      delete cw().codexConstInspect;
    };
  });

  // ── GALAXY — the canon as navigable 3D space. The ONLY view since v9.3:
  // the 2D chord wheel is gone ("constellation only needs the galaxy").
  const [galaxyPct, setGalaxyPct] = useState(-1); // -1 idle · 0-99 laying out · 100 ready
  const galaxyRef = useRef<Float32Array | null>(null); // Float32Array positions
  const camRef = useRef<Cam>({ yaw: 0.6, pitch: 0.25, dist: 760, tx: 0, ty: 0, tz: 0 });
  const dragRef = useRef<DragState | null>(null);
  const selRef = useRef(-1); // selected node
  const rafRef = useRef(0);
  const degRef = useRef<Float32Array | null>(null); // node degree (sizes)
  const spriteRef = useRef<Record<string, HTMLCanvasElement>>({}); // hue → glow sprite canvas

  // ── v11.4 THE GALAXY FOLLOWS THE READER — true multi-display soul. ────
  // While the galaxy is open, every reader chapter-change (this window or a
  // sibling display via the codex-displays cursor bus) flies the camera OUT
  // to frame old + new focus, draws the WALKED TRAIL (gold polyline through
  // every chapter visited this session, max 12 hops), then settles on the
  // new star and refreshes the dossier. The reader controls the galaxy.
  const trailRef = useRef<number[]>([]); // [chapterIdx] — session trail
  const lastNowRef = useRef<number | null>(null); // last chapter idx handled (verse moves ignored)
  const flightRef = useRef<ConstFlight>({ flights: 0, state: "idle", lastMaxDist: 0 }); // smoke telemetry
  const flightSeqRef = useRef(0); // a newer flight cancels an older one
  const [trailTick, setTrailTick] = useState(0); // chip re-render only

  const pushTrail = (idx: number): void => {
    const t = trailRef.current;
    if (t.length && t[t.length - 1] === idx) return;
    t.push(idx);
    while (t.length > 12) t.shift(); // honest ring — max ~12 hops
    try {
      cw().__CODEX_CONST_TRAIL = t.length;
    } catch {
      /* ignore */
    }
    setTrailTick((x) => x + 1);
  };
  const clearTrail = (): void => {
    trailRef.current = [];
    try {
      cw().__CODEX_CONST_TRAIL = 0;
    } catch {
      /* ignore */
    }
    setTrailTick((x) => x + 1);
  };

  // two-phase camera: OUT to the midpoint at a distance that frames both
  // stars, then SETTLE onto the new one. Reduced motion: a hard cut.
  const flyFollow = (fromIdx: number, toIdx: number): void => {
    const p = galaxyRef.current,
      cam = camRef.current;
    const F = flightRef.current;
    if (!p) {
      selRef.current = toIdx;
      inspect(toIdx);
      return;
    }
    const seq = ++flightSeqRef.current;
    const a = fromIdx >= 0 ? fromIdx : toIdx;
    const ax = a * 3,
      bx = toIdx * 3;
    const mid: [number, number, number] = [
      (p[ax]! + p[bx]!) / 2,
      (p[ax + 1]! + p[bx + 1]!) / 2,
      (p[ax + 2]! + p[bx + 2]!) / 2,
    ];
    const gap = Math.hypot(p[bx]! - p[ax]!, p[bx + 1]! - p[ax + 1]!, p[bx + 2]! - p[ax + 2]!);
    const outDist = Math.min(2400, Math.max(cam.dist + 140, gap * 1.5 + 320));
    F.flights += 1;
    F.lastMaxDist = outDist;
    F.state = "out";
    if (I.intelReducedMotion()) {
      cam.tx = p[bx]!;
      cam.ty = p[bx + 1]!;
      cam.tz = p[bx + 2]!;
      cam.dist = 300;
      F.state = "idle";
      inspect(toIdx);
      return;
    }
    const lerpCam = (from: CamLerp, to: CamLerp, dur: number, done?: () => void): void => {
      const T0 = performance.now();
      const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
      const step = (now: number): void => {
        if (flightSeqRef.current !== seq) return; // superseded
        const t = Math.min(1, (now - T0) / dur);
        const e = ease(t);
        cam.tx = from.tx + (to.tx - from.tx) * e;
        cam.ty = from.ty + (to.ty - from.ty) * e;
        cam.tz = from.tz + (to.tz - from.tz) * e;
        cam.dist = from.dist + (to.dist - from.dist) * e;
        if (t < 1) requestAnimationFrame(step);
        else if (done) done();
      };
      requestAnimationFrame(step);
    };
    lerpCam(
      { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist },
      { tx: mid[0], ty: mid[1], tz: mid[2], dist: outDist },
      620,
      () => {
        F.state = "settle";
        inspect(toIdx); // dossier refreshes during the descent
        lerpCam(
          { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist },
          { tx: p[bx]!, ty: p[bx + 1]!, tz: p[bx + 2]!, dist: 300 },
          700,
          () => {
            F.state = "idle";
          },
        );
      },
    );
  };

  const followTo = (idx: number): void => {
    const d = dataRef.current;
    if (!d || idx < 0 || idx >= d.canon.count) return;
    const prev =
      selRef.current >= 0 ? selRef.current : trailRef.current.length ? trailRef.current[trailRef.current.length - 1]! : -1;
    pushTrail(idx);
    if (idx === prev) return; // already focused — trail only
    flyFollow(prev, idx);
  };

  // codex:now reaches satellites too (displays.js jumps the local reader,
  // which re-fires codex:now here). The BroadcastChannel bridge below is
  // belt-and-braces for a satellite whose local cursor never moves —
  // typeof-guarded, read-only: displays.js stays untouched.
  useEffect(() => {
    if (phase !== "ready") return;
    const handle = (n: { bookId?: string; chapter?: number; ref?: string } | null): void => {
      const d = dataRef.current;
      if (!d || !n) return;
      let idx = -1;
      const K = cw().CODEX_KERNEL;
      if (n.bookId != null && d.canon.offset[n.bookId] !== undefined && (n.chapter as number) >= 1) {
        idx = d.canon.offset[n.bookId]! + (n.chapter as number) - 1;
      } else if (n.ref && K && K.parseRef) {
        const p = K.parseRef(String(n.ref));
        if (p && d.canon.offset[p.bookId] !== undefined) idx = d.canon.offset[p.bookId]! + p.chapter - 1;
      }
      if (idx < 0 || idx >= d.canon.count) return;
      if (lastNowRef.current === idx) return; // same chapter — verse moves don't fly
      lastNowRef.current = idx;
      followTo(idx);
    };
    // seed: the chapter the reader was on when the galaxy opened is hop 0 —
    // the trail tells the story FROM the original constellation click.
    try {
      const n0 = cw().CODEX_NOW;
      if (n0 && n0.bookId != null) {
        const d = dataRef.current;
        const off = d && d.canon.offset[n0.bookId];
        if (off !== undefined && (n0.chapter as number) >= 1) {
          const i0 = (off as number) + (n0.chapter as number) - 1;
          if (i0 >= 0 && i0 < d!.canon.count) {
            lastNowRef.current = i0;
            pushTrail(i0);
          }
        }
      }
    } catch {
      /* ignore */
    }
    const onNow = (e: Event): void => handle((e as CustomEvent<{ bookId?: string; chapter?: number; ref?: string }>).detail || cw().CODEX_NOW || null);
    window.addEventListener("codex:now", onNow);
    let chan: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        chan = new BroadcastChannel("codex-displays");
        chan.onmessage = (ev: MessageEvent): void => {
          const m = (ev && ev.data) as { kind?: string; ref?: string } | null;
          if (m && m.kind === "now" && m.ref) handle({ ref: m.ref });
        };
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener("codex:now", onNow);
      try {
        if (chan) chan.close();
      } catch {
        /* ignore */
      }
    };
  }, [phase]);

  // telemetry mounts with the galaxy, dies with it (smoke reads these)
  useEffect(() => {
    try {
      cw().__CODEX_CONST_FLIGHT = flightRef.current;
      cw().__CODEX_CONST_TRAIL = trailRef.current.length;
    } catch {
      /* ignore */
    }
    return () => {
      try {
        delete cw().__CODEX_CONST_FLIGHT;
        delete cw().__CODEX_CONST_TRAIL;
      } catch {
        /* ignore */
      }
    };
  }, []);

  const enterGalaxy = async (): Promise<void> => {
    const d = dataRef.current;
    if (!d) return;
    if (!famRef.current) famRef.current = constFamilies(d.adj, d.canon.count);
    if (!degRef.current) {
      const deg = new Float32Array(d.canon.count);
      d.adj.forEach((edges, i) => {
        deg[i] = edges.length;
      });
      degRef.current = deg;
    }
    if (!galaxyRef.current) {
      // cached layout?
      try {
        const raw = localStorage.getItem("codex.galaxy.v1");
        if (raw) {
          const arr: unknown = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length === d.canon.count * 3) galaxyRef.current = Float32Array.from(arr as number[]);
        }
      } catch {
        /* ignore */
      }
    }
    if (!galaxyRef.current) {
      setGalaxyPct(0);
      const pos = await constGalaxyLayout(d.adj, d.pairs, d.canon.count, famRef.current!.label, setGalaxyPct);
      galaxyRef.current = pos;
      try {
        localStorage.setItem("codex.galaxy.v1", JSON.stringify(Array.from(pos).map((n) => Math.round(n))));
      } catch {
        /* ignore */
      }
    }
    setGalaxyPct(100);
  };

  const glowSprite = (hue: string): HTMLCanvasElement => {
    const cached = spriteRef.current[hue];
    if (cached) return cached;
    const s = document.createElement("canvas");
    s.width = s.height = 32;
    const c = s.getContext("2d")!;
    const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, hue);
    grad.addColorStop(0.35, hue + "99");
    grad.addColorStop(1, hue + "00");
    c.fillStyle = grad;
    c.fillRect(0, 0, 32, 32);
    spriteRef.current[hue] = s;
    return s;
  };

  // project a node → [sx, sy, scale] or null when behind the camera
  const project = (i: number, w: number, h: number): [number, number, number] | null => {
    const p = galaxyRef.current!,
      cam = camRef.current;
    const x = p[i * 3]! - cam.tx,
      y = p[i * 3 + 1]! - cam.ty,
      z = p[i * 3 + 2]! - cam.tz;
    const cy = Math.cos(cam.yaw),
      sy = Math.sin(cam.yaw);
    const cx2 = Math.cos(cam.pitch),
      sx2 = Math.sin(cam.pitch);
    const x1 = x * cy - z * sy,
      z1 = x * sy + z * cy;
    const y1 = y * cx2 - z1 * sx2,
      z2 = y * sx2 + z1 * cx2;
    const zc = z2 + cam.dist;
    if (zc < 40) return null;
    const f = 620 / zc;
    return [w / 2 + x1 * f, h / 2 + y1 * f, f];
  };

  const drawGalaxy = (): void => {
    const canvas = canvasRef.current,
      d = dataRef.current;
    if (!canvas || !d || !galaxyRef.current) return;
    const { w, h } = I.intelCanvas.fit(canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const proj: Array<[number, number, number] | null> = new Array(d.canon.count);
    for (let i = 0; i < d.canon.count; i++) proj[i] = project(i, w, h);

    // edges — top set, depth + weight faded; NEAR/selection ignites its own
    const edges = d.pairs.slice(0, 3800);
    const wMax = edges.length ? edges[0]![2] : 1;
    ctx.lineWidth = 0.6;
    for (let s = edges.length - 1; s >= 0; s--) {
      const ed = edges[s]!;
      const a = ed[0],
        b = ed[1],
        wt = ed[2];
      const pa = proj[a],
        pb = proj[b];
      if (!pa || !pb) continue;
      const depth = Math.min(pa[2], pb[2]);
      const al = (0.025 + (wt / wMax) * 0.1) * Math.min(1, depth * 1.6);
      if (al < 0.015) continue;
      const ha = hueOf(a),
        hb = hueOf(b);
      ctx.strokeStyle = ha === hb ? ha : CONST_GOLD;
      ctx.globalAlpha = al;
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }

    // ignition overlays (NEAR / selection / PATH)
    const igniteFrom = (idx: number, bright: boolean): void => {
      (d.adj.get(idx) || []).forEach(([other, wt]) => {
        const pa = proj[idx],
          pb = proj[other];
        if (!pa || !pb) return;
        ctx.strokeStyle = hueOf(other);
        ctx.globalAlpha = Math.min(0.85, (bright ? 0.3 : 0.2) + wt * 0.05);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      });
    };
    if (near) igniteFrom(near.idx, true);
    if (selRef.current >= 0) igniteFrom(selRef.current, true);
    if (route && route.path.length > 1) {
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = CONST_GOLD;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      let started = false;
      route.path.forEach((idx) => {
        const pt = proj[idx];
        if (!pt) {
          started = false;
          return;
        }
        if (!started) {
          ctx.moveTo(pt[0], pt[1]);
          started = true;
        } else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes — painter order by depth; glow sprites sized by degree
    const order: number[] = [];
    for (let i = 0; i < d.canon.count; i++) if (proj[i]) order.push(i);
    order.sort((a, b2) => proj[a]![2] - proj[b2]![2]);
    let trailSet: Set<number> | null = null;
    try {
      const stored = JSON.parse(localStorage.getItem("codex.trail") || "[]") as Array<{ ref: string }>;
      trailSet = new Set(
        stored.map((t) => {
          const p = cw().CODEX_KERNEL?.parseRef(t.ref);
          return p ? d.canon.offset[p.bookId]! + p.chapter - 1 : -1;
        }),
      );
    } catch {
      /* ignore */
    }
    const deg = degRef.current!;
    order.forEach((i) => {
      const pr = proj[i]!;
      const sx = pr[0],
        sy = pr[1],
        f = pr[2];
      const base = 2.2 + Math.sqrt(deg[i] || 1) * 0.5;
      const size = Math.max(1.6, base * f * 1.6);
      const hue = trailSet && trailSet.has(i) ? CONST_GOLD : hueOf(i);
      ctx.globalAlpha = Math.min(1, 0.35 + f);
      ctx.drawImage(glowSprite(hue), sx - size, sy - size, size * 2, size * 2);
      if (i === selRef.current) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, size + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // proximity labels — the ~14 biggest on screen
    ctx.globalAlpha = 1;
    ctx.font = "600 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    order
      .slice(-90)
      .filter((i) => proj[i]![2] > 0.85)
      .slice(-14)
      .forEach((i) => {
        const pr = proj[i]!;
        const sx = pr[0],
          sy = pr[1],
          f = pr[2];
        const c = d.canon.chapters[i]!;
        ctx.fillStyle = hueOf(i);
        ctx.fillText(`${c.bookName.toUpperCase()} ${c.ch}`, sx, sy - (3 + Math.sqrt(deg[i] || 1) * f));
      });

    // THE WALKED TRAIL — the reader's session path, gold over everything:
    // a polyline through every chapter visited since the galaxy opened,
    // beads + honest small labels at the hops. Cleared by the ⌫ TRAIL chip.
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = CONST_GOLD;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      let started = false;
      trail.forEach((idx) => {
        const pt = proj[idx];
        if (!pt) {
          started = false;
          return;
        }
        if (!started) {
          ctx.moveTo(pt[0], pt[1]);
          started = true;
        } else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
      ctx.font = "600 8px ui-monospace, monospace";
      ctx.textAlign = "left";
      trail.forEach((idx, k) => {
        const pt = proj[idx];
        if (!pt) return;
        ctx.fillStyle = CONST_GOLD;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2.3, 0, Math.PI * 2);
        ctx.fill();
        const c = d.canon.chapters[idx]!;
        ctx.globalAlpha = 0.75;
        ctx.fillText(`${k + 1}·${c.bookName.toUpperCase()} ${c.ch}`, pt[0] + 6, pt[1] - 5);
      });
      ctx.textAlign = "center";
    }
    ctx.globalAlpha = 1;
  };

  // wheel dolly — attached non-passively so the page never scroll-fights
  useEffect(() => {
    if (phase !== "ready") return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = onGalaxyPointer.wheel;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [phase, galaxyPct]);

  // galaxy render loop — slow idle orbit, stops on unmount
  useEffect(() => {
    if (phase !== "ready" || galaxyPct < 100) return;
    let live = true;
    const reduced = I.intelReducedMotion();
    const tick = (): void => {
      if (!live) return;
      if (!dragRef.current && !reduced) camRef.current.yaw += 0.0007;
      drawGalaxy();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, galaxyPct, famOn, near, route]);

  const galaxyHit = (mx: number, my: number): number => {
    const canvas = canvasRef.current,
      d = dataRef.current;
    if (!canvas || !d || !galaxyRef.current) return -1;
    const r = canvas.getBoundingClientRect();
    let best = -1,
      bestD = 14;
    for (let i = 0; i < d.canon.count; i++) {
      const p = project(i, r.width, r.height);
      if (!p) continue;
      const dx = p[0] - mx,
        dy = p[1] - my;
      const dd = Math.hypot(dx, dy);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return best;
  };

  const flyTo = (idx: number): void => {
    const p = galaxyRef.current,
      cam = camRef.current;
    if (!p) return;
    const from = { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist };
    const to = { tx: p[idx * 3]!, ty: p[idx * 3 + 1]!, tz: p[idx * 3 + 2]!, dist: 300 };
    const T0 = performance.now();
    const DUR = I.intelReducedMotion() ? 0 : 700;
    const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
    const stepFly = (now: number): void => {
      const t = DUR ? Math.min(1, (now - T0) / DUR) : 1;
      const e = ease(t);
      cam.tx = from.tx + (to.tx - from.tx) * e;
      cam.ty = from.ty + (to.ty - from.ty) * e;
      cam.tz = from.tz + (to.tz - from.tz) * e;
      cam.dist = from.dist + (to.dist - from.dist) * e;
      if (t < 1) requestAnimationFrame(stepFly);
    };
    requestAnimationFrame(stepFly);
  };

  // Touch-tuned (v12): one finger = orbit / tap = dossier (pointer events
  // unify mouse + touch), two fingers = PINCH DOLLY. While two pointers are
  // live, orbit is suppressed so the galaxy doesn't spin under a pinch.
  const pinchRef = useRef<{ pts: Map<number, { x: number; y: number }>; d0: number; dist0: number }>({
    pts: new Map(),
    d0: 0,
    dist0: 0,
  });
  const onGalaxyPointer = {
    down: (e: React.PointerEvent<HTMLCanvasElement>): void => {
      const pz = pinchRef.current;
      pz.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pz.pts.size === 2) {
        const vals = [...pz.pts.values()];
        const a = vals[0]!,
          b = vals[1]!;
        pz.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        pz.dist0 = camRef.current.dist;
        dragRef.current = null; // a pinch is not an orbit
      } else if (pz.pts.size === 1) {
        dragRef.current = { x: e.clientX, y: e.clientY, yaw: camRef.current.yaw, pitch: camRef.current.pitch, moved: false };
      }
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    move: (e: React.PointerEvent<HTMLCanvasElement>): void => {
      const pz = pinchRef.current;
      if (pz.pts.has(e.pointerId)) pz.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pz.pts.size === 2) {
        const vals = [...pz.pts.values()];
        const a = vals[0]!,
          b = vals[1]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        camRef.current.dist = Math.max(120, Math.min(2400, pz.dist0 * (pz.d0 / d)));
        return;
      }
      const dr = dragRef.current;
      if (dr) {
        const dx = e.clientX - dr.x,
          dy = e.clientY - dr.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
        camRef.current.yaw = dr.yaw + dx * 0.005;
        camRef.current.pitch = Math.max(-1.4, Math.min(1.4, dr.pitch + dy * 0.005));
      }
    },
    up: (e: React.PointerEvent<HTMLCanvasElement>): void => {
      const pz = pinchRef.current;
      const wasPinch = pz.pts.size >= 2;
      pz.pts.delete(e.pointerId);
      const dr = dragRef.current;
      dragRef.current = null;
      if (dr && !dr.moved && !wasPinch) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const hit = galaxyHit(e.clientX - rect.left, e.clientY - rect.top);
        selRef.current = hit;
        if (hit >= 0) {
          inspect(hit);
          flyTo(hit);
        } else {
          setInfo(null);
          setHud(null);
        }
      }
    },
    cancel: (e: React.PointerEvent<HTMLCanvasElement>): void => {
      pinchRef.current.pts.delete(e.pointerId);
      dragRef.current = null;
    },
    dbl: (e: React.MouseEvent<HTMLCanvasElement>): void => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const hit = galaxyHit(e.clientX - rect.left, e.clientY - rect.top);
      const w = cw();
      if (hit >= 0 && w.codexJumpToRef) {
        w.codexJumpToRef(labelOf(hit));
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `❂ ${labelOf(hit)}`, kind: "ok" } }));
        } catch {
          /* ignore */
        }
      }
    },
    wheel: (e: WheelEvent): void => {
      e.preventDefault();
      camRef.current.dist = Math.max(120, Math.min(2400, camRef.current.dist * (1 + e.deltaY * 0.0011)));
    },
  };
  // (famOn / route / near redraw via the galaxy render-loop deps above)

  // ── Load + aggregate ───────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const mods = cw().CODEX_MODULES;
        if (!mods || !mods.loadModule) throw new Error("Module loader unavailable");
        const tsk = await mods.loadModule("tsk-sample");
        if (dead) return;
        const canon = buildCanon(cw().CODEX_DATA?.books || []);
        if (!canon.count) throw new Error("Canon unavailable");
        const agg = await constAggregate(tsk, canon, (pct, threads) => {
          if (!dead) setProgress({ pct, threads });
        });
        if (dead) return;
        dataRef.current = { canon, ...agg };
        setPhase("ready");
      } catch (e) {
        if (!dead) {
          setErr(String((e as { message?: unknown }).message || e));
          setPhase("error");
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Dossier-text styles — self-injected (one tag, idempotent) instead of
  // styles.css because a parallel build owns that file right now.
  // TODO: fold into styles.css at the next quiet moment.
  useEffect(() => {
    injectTextCSS();
  }, []);

  // ── Color: testament hues, or natural families when FAMILIES is on ─────
  const hueOf = (idx: number): string => {
    if (famOn && famRef.current) {
      return CONST_FAMILY_HUES[famRef.current.label[idx]! % CONST_FAMILY_HUES.length]!;
    }
    return dataRef.current!.canon.chapters[idx]!.testament === "NT" ? CONST_NT_HUE : CONST_OT_HUE;
  };

  // the moment the canon is woven, enter the galaxy — there is no other view
  useEffect(() => {
    if (phase === "ready") void enterGalaxy();
  }, [phase]);

  const d = dataRef.current;
  const fam = famRef.current;
  const IntelBanner = cw().IntelBanner;
  return (
    <div className="cx-const-backdrop" onClick={onClose} role="dialog" aria-label="The Constellation — the canon as one body">
      <div className="cx-const" onClick={(e) => e.stopPropagation()} ref={wrapRef}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-const-h">
          <span className="cx-const-h-tag">CODEX · CONSTELLATION</span>
          <span className="cx-const-h-sub">the canon as one galaxy — every thread of the Treasury, navigable space</span>
          <button className="cx-const-x" onClick={onClose} aria-label="Close" title="Close (ESC)">
            ×
          </button>
        </header>

        {IntelBanner ? (
          <IntelBanner
            console="CONSTELLATION"
            scope="WHOLE CANON"
            note="TREASURY OF SCRIPTURE KNOWLEDGE · PUBLIC DOMAIN · AGGREGATED IN FRONT OF YOU"
          />
        ) : null}

        {phase === "loading" ? (
          <div className="cx-const-loading">
            <div className="cx-const-loading-ring" aria-hidden="true" />
            <span>INDEXING THE CANON</span>
            <span className="cx-const-loading-sub">
              {progress.pct}% · {progress.threads.toLocaleString()} threads woven
            </span>
          </div>
        ) : phase === "error" ? (
          <div className="cx-const-err">
            <b>THE LOOM IS DARK</b>
            <code>{err}</code>
            <span className="cx-const-err-hint">The Treasury module (≈5 MB) loads on first use — check your connection and reopen.</span>
          </div>
        ) : (
          <div className="cx-const-stage">
            <div className="cx-const-tools">
              <input
                className="cx-const-q"
                placeholder={'PATH: "Genesis 1 → Revelation 21" · NEAR: "Isaiah 53" · ↵'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runQuery();
                  }
                  e.stopPropagation();
                }}
                spellCheck={false}
                aria-label="Graph query — one ref for the neighborhood, two refs for a path"
              />
              <button
                className={`cx-const-fam ${famOn ? "is-on" : ""}`}
                onClick={toggleFamilies}
                title="Color the canon by its natural families (label propagation over the thread graph)"
              >
                ✦ FAMILIES{famOn && fam ? ` · ${Math.min(fam.families, CONST_FAMILY_HUES.length)}` : ""}
              </button>
              {route || near ? (
                <button
                  className="cx-const-clear"
                  onClick={() => {
                    setRoute(null);
                    setNear(null);
                    setQuery("");
                  }}
                  title="Clear query"
                >
                  ×
                </button>
              ) : null}
            </div>

            {route ? (
              <div className="cx-const-route" aria-label="Thread path">
                {route.labels.map((l, i) => (
                  <span key={i} className="cx-const-hop">
                    <button onClick={() => cw().codexJumpToRef?.(l)} title={`Read ${l}`}>
                      {l}
                    </button>
                    {i < route.labels.length - 1 ? <i aria-hidden="true">→</i> : null}
                  </span>
                ))}
                <small>
                  {route.path.length - 1} hop{route.path.length > 2 ? "s" : ""} through the strongest threads
                </small>
              </div>
            ) : null}

            {near ? (
              <div className="cx-const-near" aria-label="Strongest neighbors">
                <b>{near.label} — strongest threads</b>
                <ul>
                  {near.rows.map((r) => (
                    <li key={r.idx}>
                      <button onClick={() => cw().codexJumpToRef?.(r.label)} title={`Read ${r.label}`}>
                        {r.label}
                      </button>
                      <span>{r.w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {galaxyPct >= 0 && galaxyPct < 100 ? (
              <div className="cx-const-laying">
                <div className="cx-const-loading-ring" aria-hidden="true" />
                <span>LAYING OUT THE GALAXY · {galaxyPct}%</span>
              </div>
            ) : null}
            <canvas
              ref={canvasRef}
              className="cx-const-canvas is-galaxy"
              onPointerMove={onGalaxyPointer.move}
              onPointerDown={onGalaxyPointer.down}
              onPointerUp={onGalaxyPointer.up}
              onPointerCancel={onGalaxyPointer.cancel}
              onDoubleClick={onGalaxyPointer.dbl}
              role="img"
              aria-label="Galaxy — the canon as navigable 3D space"
            />
            <div className="cx-const-stats" aria-hidden="true">
              <span>{d ? d.canon.count.toLocaleString() : "—"} STARS</span>
              <span>{d ? d.threads.toLocaleString() : "—"} THREADS</span>
              <span>STARS SIZED BY THREAD-WEIGHT · YOUR TRAIL BURNS GOLD</span>
            </div>
            {trailRef.current.length > 1 ? (
              <button
                className="cx-const-trailchip"
                onClick={clearTrail}
                title="Clear the walked trail — the gold path of every chapter visited since the galaxy opened"
                aria-label={`Clear walked trail (${trailRef.current.length} hops)`}
                data-tick={trailTick}
              >
                ⌫ TRAIL · {trailRef.current.length}
              </button>
            ) : null}
            {info ? (
              <aside className="cx-const-info" aria-label={`${info.label} — star dossier`}>
                <header>
                  <b>{info.label.toUpperCase()}</b>
                  <button
                    className="cx-const-info-x"
                    onClick={() => {
                      setInfo(null);
                      selRef.current = -1;
                    }}
                    aria-label="Close dossier"
                  >
                    ×
                  </button>
                </header>
                <div className="cx-const-info-meta">
                  <span className={`is-${info.testament.toLowerCase()}`}>{info.testament}</span>
                  <span>FAMILY {info.fam + 1}</span>
                  <span>{info.degree} LINKS</span>
                  <span>{info.threads.toLocaleString()} THREADS</span>
                </div>
                <div className="cx-const-info-verbs">
                  <button
                    onClick={() => {
                      // READ — structured jump (bookId+chapter), so apocrypha
                      // and Greek additions open via the corpus workflow even
                      // when their display names defeat the string parser.
                      const w = cw();
                      if (w.codexGoto) w.codexGoto(info.bookId, info.chapter, 1);
                      else if (w.codexJumpToRef) w.codexJumpToRef(info.label);
                      try {
                        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `❂ ${info.label}`, kind: "ok" } }));
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    ✦ READ
                  </button>
                  <button
                    onClick={() => {
                      setQuery(info.label);
                      setRoute(null);
                      const rows = info.rows.slice(0, 14);
                      setNear({ idx: info.idx, label: info.label, rows });
                    }}
                  >
                    ◉ NEAR
                  </button>
                  <button
                    onClick={() => {
                      setQuery(`${info.label} → `);
                      setInfo(null);
                    }}
                    title="Start a PATH query from this star"
                  >
                    ⌖ PATH FROM
                  </button>
                </div>
                {/* THE WORD ITSELF — whole chapter if it fits the dossier,
                    an honest preview if long; orb while it travels. */}
                {info.text
                  ? (() => {
                      const txt = info.text;
                      if (txt.state === "loading") {
                        return (
                          <div className="cx-const-info-text is-loading" role="status" aria-label="Fetching the chapter">
                            <span className="cx-const-orb" aria-hidden="true" />
                            <span>FETCHING THE WORD…</span>
                          </div>
                        );
                      }
                      if (txt.state === "ready") {
                        const D = cw().CODEX_DATA;
                        const primary = (D && D.tweaks && D.tweaks.primaryTranslation) || "web";
                        return (
                          <div className="cx-const-info-text" aria-label={`${info.label} — text`}>
                            {(txt.verses.length <= 14 ? txt.verses : txt.verses.slice(0, 6)).map((v) => (
                              <p key={v.n}>
                                <sup>{v.n}</sup>
                                {v.text}
                              </p>
                            ))}
                            {txt.verses.length > 14 ? (
                              <p className="cx-const-info-more">⋯ {txt.verses.length - 6} more verses — ✦ READ opens the whole chapter</p>
                            ) : null}
                            {txt.from && txt.from !== primary ? (
                              <p className="cx-const-info-src">⇄ served from {String(txt.from).toUpperCase()}</p>
                            ) : null}
                          </div>
                        );
                      }
                      if (txt.state === "none") {
                        return <p className="cx-const-info-none">No source carries this chapter yet — the corpus is still growing.</p>;
                      }
                      return null;
                    })()
                  : null}
                {info.rows.length ? (
                  <ul className="cx-const-info-rows">
                    {info.rows.map((r) => (
                      <li key={r.idx}>
                        <button
                          onClick={() => {
                            inspect(r.idx);
                            flyTo(r.idx);
                          }}
                          title={`Inspect ${r.label}`}
                        >
                          {r.label}
                        </button>
                        <span>{r.w}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cx-const-info-none">No Treasury threads touch this chapter — it sits outside the 66-book TSK web. ✦ READ still opens it.</p>
                )}
              </aside>
            ) : hud ? (
              <div className="cx-const-hud">
                <b>{hud.label}</b>
                <span>{hud.threads.toLocaleString()} threads · double-click to read</span>
              </div>
            ) : (
              <div className="cx-const-hud is-idle">
                <span>drag to orbit · scroll to dive · click a star for its dossier · double-click to read · your trail burns gold</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
