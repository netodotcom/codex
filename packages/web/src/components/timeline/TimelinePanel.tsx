// timeline — THE LIVING RIVER (migrated from timeline.jsx). The axis itself is
// the instrument: continuous wheel/pinch zoom centred on the cursor, drag-pan
// with inertia, era strata behind, events sized by significance, dense runs
// folded into +N clusters, a NOW-READING gold marker (≈), and a draggable
// minimap. Imperative (pointer + RAF); verified by the integration probe.
import React from "react";
import { ERAS, ERA_LOOKUP, CATEGORIES, CAT_LOOKUP, loadEvents, cachedEvents, type TimelineEvent } from "./data.js";
import { yearLabel, parseScriptureRef, gotoRef, eventMatchesPassage, sigOf, pickTickInterval, reduceMotion, clamp, easeInOut } from "./helpers.js";
import { injectCSS } from "./style.js";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

interface View {
  center: number;
  span: number;
}
interface PanelCtx {
  bookId?: string;
  chapter?: number;
  passage?: { bookId?: string; chapter?: number };
}
interface PassageState {
  bookId: string | null;
  chapter: number | null;
  ref: string | null;
}
type RiverNode =
  | { kind: "cluster"; year: number; lo: number; hi: number; list: TimelineEvent[]; lane?: number }
  | { kind: "event"; ev: TimelineEvent; lane: number };

interface TLWindow {
  CODEX_NOW?: { bookId?: string; chapter?: number; ref?: string };
  CODEX_AI_BUSY?: { begin(label: string): unknown; end(id: unknown): void };
  IntelBanner?: React.ComponentType<{ console?: string; scope?: string; note?: string }>;
  __CODEX_TL_VIEW?: { center: number; span: number } | null;
}
function tlw(): TLWindow {
  return window as unknown as TLWindow;
}

export function TimelinePanel(ctx: PanelCtx): React.ReactElement {
  injectCSS();
  const [events, setEvents] = useState<TimelineEvent[] | null>(cachedEvents());
  const [filterCats, setFilterCats] = useState<Set<string>>(() => new Set(CATEGORIES.map((c) => c.id)));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const [passage, setPassage] = useState<PassageState>(() => {
    const now = tlw().CODEX_NOW || {};
    return {
      bookId: ctx?.bookId || ctx?.passage?.bookId || now.bookId || null,
      chapter: ctx?.chapter || ctx?.passage?.chapter || now.chapter || null,
      ref: now.ref || null,
    };
  });
  const [W, setW] = useState(900);
  const [H, setH] = useState(260);

  const [view, setViewState] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const setView = useCallback((next: View | null | ((v: View | null) => View | null)): void => {
    const v = typeof next === "function" ? next(viewRef.current) : next;
    viewRef.current = v;
    try {
      tlw().__CODEX_TL_VIEW = v ? { center: v.center, span: v.span } : null;
    } catch {
      /* ignore */
    }
    setViewState(v);
  }, []);

  const riverRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const panSuppressClick = useRef(false);

  // ── Data load (in-surface pulsing orb while resolving) ───────────────
  useEffect(() => {
    let alive = true;
    if (!events) {
      let busyId: unknown = null;
      try {
        const bus = tlw().CODEX_AI_BUSY;
        if (bus && typeof bus.begin === "function") busyId = bus.begin("TIMELINE · chronology");
      } catch {
        /* ignore */
      }
      loadEvents()
        .then((es) => {
          if (alive) setEvents(es);
        })
        .finally(() => {
          try {
            if (busyId != null) tlw().CODEX_AI_BUSY?.end(busyId);
          } catch {
            /* ignore */
          }
        });
    }
    return () => {
      alive = false;
    };
  }, []);

  // ── Passage follows the reader: host props + codex:now + codex:navigate
  useEffect(() => {
    const bid = ctx?.bookId || null;
    const ch = ctx?.chapter || null;
    if (!bid) return;
    setPassage((p) => (p.bookId === bid && p.chapter === ch ? p : { bookId: bid, chapter: ch, ref: p.ref }));
  }, [ctx?.bookId, ctx?.chapter]);
  useEffect(() => {
    const onNow = (e: Event): void => {
      const d = (e as CustomEvent<{ bookId?: string; chapter?: number; ref?: string }>).detail || tlw().CODEX_NOW || {};
      if (!d.bookId) return;
      setPassage({ bookId: d.bookId, chapter: d.chapter || null, ref: d.ref || null });
    };
    const onNav = (e: Event): void => {
      const d = (e as CustomEvent<{ bookId?: string; chapter?: number }>).detail || {};
      if (!d.bookId) return;
      setPassage((p) => ({ bookId: d.bookId ?? null, chapter: d.chapter || null, ref: p.ref }));
    };
    window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:navigate", onNav);
    return () => {
      window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:navigate", onNav);
    };
  }, []);

  const ready = !!(events && view);

  // ── Geometry ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = riverRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const ent of entries) {
        if (ent.contentRect.width > 0) {
          setW(ent.contentRect.width);
          setH(ent.contentRect.height);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // ── Filter pipeline ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (!filterCats.has(ev.category)) return false;
      if (q && !(ev.title.toLowerCase().includes(q) || (ev.summary || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [events, filterCats, search]);

  const full = useMemo(() => {
    const first = events?.[0];
    const last = events?.[events.length - 1];
    if (!first || !last) return { lo: -4100, hi: 150 };
    const lo = first.year;
    const hi = last.year;
    const pad = Math.max(40, (hi - lo) * 0.03);
    return { lo: lo - pad, hi: hi + pad };
  }, [events]);
  const fullSpan = full.hi - full.lo;

  useEffect(() => {
    if (events && events.length && !viewRef.current) {
      setView({ center: (full.lo + full.hi) / 2, span: fullSpan });
    }
  }, [events, full.lo, full.hi]);

  const clampView = useCallback(
    (center: number, span: number): View => {
      const s = clamp(span, 4, fullSpan * 1.25);
      const c = clamp(center, full.lo - s * 0.25, full.hi + s * 0.25);
      return { center: c, span: s };
    },
    [full.lo, full.hi, fullSpan],
  );

  const xOf = useCallback(
    (y: number): number => {
      const v = viewRef.current;
      if (!v) return 0;
      return ((y - v.center) / v.span) * W + W / 2;
    },
    [W],
  );
  const yearAtX = useCallback(
    (px: number): number => {
      const v = viewRef.current;
      if (!v) return 0;
      return v.center + ((px - W / 2) * v.span) / W;
    },
    [W],
  );

  const animateTo = useCallback(
    (center: number, span: number, ms = 520): void => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const from = viewRef.current;
      const target = clampView(center, span);
      if (!from || reduceMotion()) {
        setView(target);
        return;
      }
      const t0 = performance.now();
      const step = (t: number): void => {
        const k = clamp((t - t0) / ms, 0, 1);
        const e = easeInOut(k);
        setView({
          center: from.center + (target.center - from.center) * e,
          span: from.span + (target.span - from.span) * e,
        });
        if (k < 1) animRef.current = requestAnimationFrame(step);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [clampView, setView],
  );
  useEffect(
    () => () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    },
    [],
  );

  // ── Wheel zoom, centered on cursor (passive:false — React can't) ─────
  useEffect(() => {
    const el = riverRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!viewRef.current) return;
      e.preventDefault();
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const v = viewRef.current;
      const yearAt = v.center + ((px - rect.width / 2) * v.span) / rect.width;
      const f = Math.exp(e.deltaY * 0.0016);
      const span = clamp(v.span * f, 4, fullSpan * 1.25);
      const center = yearAt - ((px - rect.width / 2) * span) / rect.width;
      setView(clampView(center, span));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fullSpan, clampView, setView, ready]);

  // ── Drag-pan with inertia + two-pointer pinch ────────────────────────
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    const el = riverRef.current;
    if (!el) return;
    const ptrs = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    let startX = 0;
    let pinchSpan = 0;
    let pinchDist = 0;
    let pinchMidYear = 0;
    let inertiaRaf: number | null = null;

    const stopInertia = (): void => {
      if (inertiaRaf) {
        cancelAnimationFrame(inertiaRaf);
        inertiaRaf = null;
      }
    };

    const down = (e: PointerEvent): void => {
      if (!viewRef.current) return;
      stopInertia();
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        if (!a || !b) return;
        pinchDist = Math.max(12, Math.abs(a.x - b.x));
        pinchSpan = viewRef.current.span;
        const rect = el.getBoundingClientRect();
        pinchMidYear = yearAtX((a.x + b.x) / 2 - rect.left);
        dragging = false;
      } else {
        startX = lastX = e.clientX;
        lastT = performance.now();
        vel = 0;
        dragging = false;
      }
    };
    const move = (e: PointerEvent): void => {
      if (!ptrs.has(e.pointerId) || !viewRef.current) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = el.getBoundingClientRect();
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        if (!a || !b) return;
        const d = Math.max(12, Math.abs(a.x - b.x));
        const span = clamp(pinchSpan * (pinchDist / d), 4, fullSpan * 1.25);
        const midPx = (a.x + b.x) / 2 - rect.left;
        const center = pinchMidYear - ((midPx - rect.width / 2) * span) / rect.width;
        setView(clampView(center, span));
        return;
      }
      const dxTotal = e.clientX - startX;
      if (!dragging && Math.abs(dxTotal) > 4) {
        dragging = true;
        panSuppressClick.current = true;
        setPanning(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vel = 0.8 * vel + 0.2 * (dx / dt);
      lastX = e.clientX;
      lastT = now;
      const v = viewRef.current;
      setView(clampView(v.center - (dx * v.span) / rect.width, v.span));
    };
    const up = (e: PointerEvent): void => {
      ptrs.delete(e.pointerId);
      if (ptrs.size > 0) return;
      const wasDragging = dragging;
      dragging = false;
      setPanning(false);
      setTimeout(() => {
        panSuppressClick.current = false;
      }, 0);
      if (!wasDragging || reduceMotion()) return;
      let v0 = vel;
      const rect = el.getBoundingClientRect();
      const step = (): void => {
        v0 *= 0.93;
        if (Math.abs(v0) < 0.02) {
          inertiaRaf = null;
          return;
        }
        const v = viewRef.current;
        if (!v) return;
        setView(clampView(v.center - (v0 * 16 * v.span) / rect.width, v.span));
        inertiaRaf = requestAnimationFrame(step);
      };
      inertiaRaf = requestAnimationFrame(step);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      stopInertia();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [fullSpan, clampView, setView, yearAtX, ready]);

  // ── Minimap drag ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = miniRef.current;
    if (!el) return;
    let active = false;
    const yearAtMini = (clientX: number): number => {
      const rect = el.getBoundingClientRect();
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      return full.lo + t * fullSpan;
    };
    const down = (e: PointerEvent): void => {
      active = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const v = viewRef.current;
      if (!v) return;
      setView(clampView(yearAtMini(e.clientX), v.span));
    };
    const move = (e: PointerEvent): void => {
      if (!active) return;
      const v = viewRef.current;
      if (!v) return;
      setView(clampView(yearAtMini(e.clientX), v.span));
    };
    const up = (): void => {
      active = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [full.lo, fullSpan, clampView, setView, ready]);

  // ── Layout: visible nodes, dense runs folded into +N clusters ────────
  const nodes = useMemo<RiverNode[]>(() => {
    if (!view || !filtered.length) return [];
    const pxPerYear = W / view.span;
    const vis = filtered.filter((e) => {
      const x = (e.year - view.center) * pxPerYear + W / 2;
      return x > -80 && x < W + 80;
    });
    const out: RiverNode[] = [];
    let run: TimelineEvent[] = [];
    const flush = (): void => {
      if (!run.length) return;
      if (run.length >= 3) {
        const lo = run[0]!.year;
        const hi = run[run.length - 1]!.year;
        out.push({ kind: "cluster", year: (lo + hi) / 2, lo, hi, list: run });
      } else {
        run.forEach((e) => out.push({ kind: "event", ev: e, lane: 0 }));
      }
      run = [];
    };
    for (const e of vis) {
      const last = run[run.length - 1];
      if (!run.length || !last || (e.year - last.year) * pxPerYear < 26) run.push(e);
      else {
        flush();
        run = [e];
      }
    }
    flush();
    let i = 0;
    for (const n of out) {
      if (n.kind === "event") {
        n.lane = i % 4;
        i++;
      }
    }
    return out;
  }, [filtered, view, W]);

  const strata = useMemo(() => {
    if (!events || !events.length) return [];
    const bands: Array<{ era: (typeof ERAS)[number]; lo: number; hi: number }> = [];
    for (const era of ERAS) {
      const inEra = events.filter((e) => e.era === era.id);
      if (!inEra.length) continue;
      const lo = Math.min(...inEra.map((e) => (e.year_range ? e.year_range[0] : e.year)));
      const hi = Math.max(...inEra.map((e) => (e.year_range ? e.year_range[1] : e.year)));
      bands.push({ era, lo, hi });
    }
    return bands;
  }, [events]);

  const ticks = useMemo(() => {
    if (!view) return [];
    const pxPerYear = W / view.span;
    const interval = pickTickInterval(view.span, pxPerYear);
    const lo = view.center - view.span / 2;
    const hi = view.center + view.span / 2;
    const start = Math.ceil(lo / interval) * interval;
    const out: number[] = [];
    for (let y = start; y <= hi; y += interval) out.push(y);
    return out;
  }, [view, W]);

  const nowMark = useMemo(() => {
    if (!events || !events.length || !passage.bookId) return null;
    let ev = events.find((e) => eventMatchesPassage(e, passage.bookId, passage.chapter));
    const exactCh = !!ev;
    if (!ev) ev = events.find((e) => eventMatchesPassage(e, passage.bookId, null));
    if (!ev) return null;
    const ref = passage.ref || `${parseScriptureRef(`${String(passage.bookId).toLowerCase()}.${passage.chapter || 1}`)?.display || ""}`.trim();
    return { year: ev.year, ref, exactCh };
  }, [events, passage]);

  const toggleCat = useCallback((id: string): void => {
    setFilterCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return new Set(CATEGORIES.map((c) => c.id));
      return next;
    });
  }, []);

  const onEventClick = useCallback(
    (e: TimelineEvent): void => {
      if (panSuppressClick.current) return;
      setSelected(e);
      const v = viewRef.current;
      if (v) animateTo(e.year, v.span);
    },
    [animateTo],
  );

  const onEventDouble = useCallback((e: TimelineEvent): void => {
    if (e.scripture && e.scripture.length && e.scripture[0]) gotoRef(e.scripture[0]);
  }, []);

  const onClusterClick = useCallback(
    (c: { year: number; lo: number; hi: number }): void => {
      if (panSuppressClick.current) return;
      const v = viewRef.current;
      if (!v) return;
      const span = clamp(Math.max((c.hi - c.lo) * 2.4, 6), 4, v.span * 0.5);
      animateTo(c.year, span);
    },
    [animateTo],
  );

  const fmtSpan = (s: number): string => (s >= 1000 ? `${(s / 1000).toFixed(1)}K yrs` : `${Math.round(s)} yrs`);

  // ── Render ────────────────────────────────────────────────────────────
  if (!events || !view) {
    return (
      <div className="cx-tl2-root">
        <div className="cx-tl2-loading">
          <span className="cx-tl2-orb" /> RESOLVING CHRONOLOGY…
        </div>
      </div>
    );
  }

  const pxPerYear = W / view.span;
  const axisTop = H * 0.58;
  const LANE_Y = [axisTop - 46, axisTop + 42, axisTop - 84, axisTop + 80];
  const showLabels = pxPerYear > 0.14;
  const IB = tlw().IntelBanner;

  return (
    <div className="cx-tl2-root">
      <div className="cx-tl2-head">
        <span className="cx-tl2-title">⏳ THE RIVER</span>
        <span className="cx-tl2-meta">
          {filtered.length} events · {yearLabel(Math.round(view.center - view.span / 2))} ⟷ {yearLabel(Math.round(view.center + view.span / 2))}
        </span>
        <span className="cx-tl2-span-ro">VIEW {fmtSpan(view.span)}</span>
        <input className="cx-tl2-search" type="search" placeholder="search events…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search timeline events" />
      </div>

      {IB ? <IB console="TIMELINE" scope="CHRONOLOGY" note="datings follow conventional chronology · all years approximate · contested" /> : null}

      <div className="cx-tl2-chips">
        {CATEGORIES.map((c) => {
          const on = filterCats.has(c.id);
          return (
            <button key={c.id} className={"cx-tl2-chip" + (on ? " is-on" : "")} onClick={() => toggleCat(c.id)} aria-pressed={on} title={c.label}>
              {c.glyph} {c.label}
            </button>
          );
        })}
      </div>

      <div className={"cx-tl2-river" + (panning ? " is-panning" : "")} ref={riverRef} role="application" aria-label="Biblical timeline river — drag to pan, scroll to zoom">
        {strata.map((b) => {
          const x0 = xOf(b.lo);
          const x1 = xOf(b.hi);
          if (x1 < -40 || x0 > W + 40) return null;
          return (
            <div
              key={b.era.id}
              className="cx-tl2-strata"
              style={{
                left: Math.max(-2, x0) + "px",
                width: Math.max(6, Math.min(W + 4, x1) - Math.max(-2, x0)) + "px",
                background: `linear-gradient(180deg, ${b.era.tint}26, ${b.era.tint}08 55%, ${b.era.tint}1d)`,
                borderLeftColor: `${b.era.tint}55`,
              }}
            >
              <span className="cx-tl2-strata-lbl" style={{ color: b.era.tint }}>
                {b.era.label}
              </span>
            </div>
          );
        })}

        <div className="cx-tl2-axis" />

        {ticks.map((y) => (
          <div key={y} className="cx-tl2-tick" style={{ left: xOf(y) + "px" }}>
            <span className="cx-tl2-tick-lbl">{yearLabel(y)}</span>
          </div>
        ))}

        {nowMark
          ? (() => {
              const x = xOf(nowMark.year);
              const inView = x >= 0 && x <= W;
              const tagStyle: React.CSSProperties = inView ? { left: clamp(x, 70, W - 70) + "px" } : x < 0 ? { left: "6px" } : { right: "6px" };
              return (
                <>
                  {inView ? <div className="cx-tl2-now" style={{ left: x + "px" }} /> : null}
                  <div className={"cx-tl2-now-tag" + (inView ? "" : " is-edge")} style={tagStyle}>
                    {inView ? "" : x < 0 ? "◂ " : ""}◈ NOW ≈ {nowMark.ref}
                    {inView ? "" : x < 0 ? "" : " ▸"}
                  </div>
                </>
              );
            })()
          : null}

        {nodes.map((n, i) => {
          if (n.kind === "cluster") {
            const size = clamp(26 + n.list.length * 1.6, 28, 44);
            return (
              <button
                key={"c" + i}
                className="cx-tl2-cluster"
                style={{ left: xOf(n.year) + "px", top: axisTop + "px" }}
                onClick={() => onClusterClick(n)}
                title={`${n.list.length} events · ${yearLabel(Math.round(n.lo))} – ${yearLabel(Math.round(n.hi))} — click to unfold`}
                aria-label={`${n.list.length} folded events between ${yearLabel(Math.round(n.lo))} and ${yearLabel(Math.round(n.hi))}`}
              >
                <span className="cx-tl2-cluster-core" style={{ width: size + "px", height: size + "px" }}>
                  +{n.list.length}
                </span>
              </button>
            );
          }
          const e = n.ev;
          const era = ERA_LOOKUP[e.era];
          const cat = CAT_LOOKUP[e.category];
          const sig = sigOf(e);
          const d = Math.round(9 + sig * 2.6);
          const y = LANE_Y[n.lane] ?? axisTop;
          const isSel = selected && selected.id === e.id;
          const isHere = passage.bookId && eventMatchesPassage(e, passage.bookId, passage.chapter);
          const tint = era ? era.tint : "var(--cx-fg-dim)";
          const stemTop = Math.min(y, axisTop);
          const stemH = Math.abs(axisTop - y);
          return (
            <button
              key={e.id}
              className={"cx-tl2-ev" + (isSel ? " is-sel" : "") + (isHere ? " is-here" : "")}
              style={{ left: xOf(e.year) + "px", top: y + "px" }}
              onClick={() => onEventClick(e)}
              onDoubleClick={() => onEventDouble(e)}
              title={`${e.title} · c. ${yearLabel(e.year)} — click to inspect, double-click to read`}
              aria-label={`${e.title} (c. ${yearLabel(e.year)})`}
            >
              <span className="cx-tl2-ev-stem" style={{ top: stemTop - y + d / 2 + 10 + "px", height: Math.max(0, stemH - d / 2 - 10) + "px", left: "50%", background: tint, opacity: 0.4 }} />
              <span className="cx-tl2-ev-dot" style={{ width: d + "px", height: d + "px", background: tint, borderColor: tint, boxShadow: `0 0 ${4 + sig * 3}px ${tint}66` }}>
                {d >= 14 && cat ? cat.glyph : ""}
              </span>
              {showLabels ? <span className="cx-tl2-ev-lbl">{e.title}</span> : null}
              {showLabels && pxPerYear > 0.4 ? <span className="cx-tl2-ev-yr">c. {yearLabel(e.year)}</span> : null}
            </button>
          );
        })}

        {selected
          ? (() => {
              const era = ERA_LOOKUP[selected.era];
              const cat = CAT_LOOKUP[selected.category];
              const cardX = clamp(xOf(selected.year), Math.min(180, W / 2), Math.max(W - 180, W / 2));
              return (
                <div className="cx-tl2-card" style={{ left: cardX + "px" }} onPointerDown={(e) => e.stopPropagation()} role="region" aria-label={`Event detail: ${selected.title}`}>
                  <div className="cx-tl2-card-head">
                    <span className="cx-tl2-card-era" style={{ color: era ? era.tint : undefined, borderColor: (era ? era.tint : "#888") + "88", background: (era ? era.tint : "#888") + "22" }}>
                      {(era || { label: selected.era }).label}
                    </span>
                    <span className="cx-tl2-card-cat">
                      {cat ? cat.glyph : ""} {(cat || { label: selected.category }).label}
                    </span>
                    <button className="cx-tl2-card-x" onClick={() => setSelected(null)} aria-label="Close event detail">
                      ✕
                    </button>
                  </div>
                  <h3 className="cx-tl2-card-title">{selected.title}</h3>
                  <div className="cx-tl2-card-year">
                    c. {yearLabel(selected.year)}
                    {selected.year_range && selected.year_range[0] !== selected.year_range[1] ? ` · range ${yearLabel(selected.year_range[0])} – ${yearLabel(selected.year_range[1])}` : ""}
                  </div>
                  <p className="cx-tl2-card-sum">{selected.summary}</p>
                  {selected.scripture && selected.scripture.length ? (
                    <div className="cx-tl2-card-refs">
                      {selected.scripture.map((r, j) => {
                        const p = parseScriptureRef(r);
                        if (!p) return null;
                        return (
                          <button key={j} className="cx-tl2-refchip" data-osis={r} onClick={() => gotoRef(r)} title={`Open the reader at ${p.display}`}>
                            ✦ READ {p.display}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {selected.people && selected.people.length ? <div className="cx-tl2-card-meta">PEOPLE · {selected.people.join(", ")}</div> : null}
                  {selected.places && selected.places.length ? <div className="cx-tl2-card-meta">PLACES · {selected.places.join(", ")}</div> : null}
                  <div className="cx-tl2-card-honest">scholarly survey · dating conventional, not settled</div>
                </div>
              );
            })()
          : null}
      </div>

      <div
        className="cx-tl2-mini"
        ref={miniRef}
        role="slider"
        aria-label="Timeline minimap — drag to move the view"
        aria-valuemin={Math.round(full.lo)}
        aria-valuemax={Math.round(full.hi)}
        aria-valuenow={Math.round(view.center)}
        tabIndex={0}
        onKeyDown={(e) => {
          const stepY = view.span * 0.2;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            animateTo(view.center - stepY, view.span, 200);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            animateTo(view.center + stepY, view.span, 200);
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            animateTo(view.center, view.span * 0.6, 200);
          } else if (e.key === "-") {
            e.preventDefault();
            animateTo(view.center, view.span * 1.6, 200);
          }
        }}
      >
        {strata.map((b) => (
          <div
            key={b.era.id}
            className="cx-tl2-mini-band"
            style={{ left: ((b.lo - full.lo) / fullSpan) * 100 + "%", width: Math.max(0.4, ((b.hi - b.lo) / fullSpan) * 100) + "%", background: b.era.tint + "44" }}
          />
        ))}
        {filtered.map((e) => (
          <span key={e.id} className="cx-tl2-mini-dot" style={{ left: ((e.year - full.lo) / fullSpan) * 100 + "%", height: 3 + sigOf(e) * 2 + "px" }} />
        ))}
        {nowMark ? <span className="cx-tl2-mini-now" style={{ left: ((nowMark.year - full.lo) / fullSpan) * 100 + "%" }} /> : null}
        <div className="cx-tl2-mini-win" style={{ left: clamp(((view.center - view.span / 2 - full.lo) / fullSpan) * 100, 0, 100) + "%", width: clamp((view.span / fullSpan) * 100, 0.5, 100) + "%" }} />
      </div>

      <div className="cx-tl2-hint">wheel / pinch = zoom · drag = pan · click = inspect · double-click = read · gold ≈ where you are reading</div>
    </div>
  );
}
