// mobile — pure helpers + DOM drag utilities (migrated faithful from
// mobile.jsx v12 THE PALM). No React; everything here is unit-testable.
import { mw } from "./mobile-window.js";
import type { PluginPanelInfo } from "./mobile-window.js";

export const MOB_ORB_KEY = "codex.mobile.orb.v1";
export const MOB_FREQ_KEY = "codex.cmd.freq.v1"; // shared with the omnibar's learner

// ── Frequency tracking ────────────────────────────────────────────────────
export interface FreqEntry {
  n: number;
  last: number;
}
export type FreqMap = Record<string, FreqEntry>;

// ── Learned usage — same store + shape the omnibar writes ({n, last}). ──
export function mobFreqLoad(): FreqMap {
  try { return (JSON.parse(localStorage.getItem(MOB_FREQ_KEY) || "{}") as FreqMap) || {}; }
  catch { return {}; }
}

export function mobFreqRecord(id: string | null | undefined): void {
  if (!id) return;
  try {
    const m = mobFreqLoad();
    const existing = m[id];
    const e: FreqEntry = existing ? { n: existing.n, last: existing.last } : { n: 0, last: 0 };
    e.n += 1; e.last = Date.now();
    m[id] = e;
    localStorage.setItem(MOB_FREQ_KEY, JSON.stringify(m));
  } catch { /* private mode — learning is a luxury, never a crash */ }
}

export function mobFreqScore(e: FreqEntry | undefined): number {
  if (!e || !e.n) return 0;
  const days = Math.max(0, (Date.now() - (e.last || 0)) / 86400000);
  return e.n * Math.pow(0.97, days);
}

// ── Streak — alive means lastDate is today or yesterday. ──────────────────
export function mobIso(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function mobStreak(): number {
  try {
    const engage = mw().CODEX_ENGAGE;
    const sk = engage && engage.loadStreak && engage.loadStreak();
    if (!sk || !sk.current || !sk.lastDate) return 0;
    const today = new Date();
    const yest = new Date(Date.now() - 86400000);
    return (sk.lastDate === mobIso(today) || sk.lastDate === mobIso(yest)) ? sk.current : 0;
  } catch { return 0; }
}

export function mobTrailRef(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem("codex.trail") || "[]") as Array<{ ref?: unknown }>;
    const last = t.length ? t[t.length - 1] : null;
    return (last && last.ref) ? String(last.ref) : null;
  } catch { return null; }
}

export function mobOrbPos(): "left" | "right" | "center" {
  try {
    const p = localStorage.getItem(MOB_ORB_KEY);
    return (p === "left" || p === "right") ? p : "center";
  } catch { return "center"; }
}

// Resolve "plugin:<pid>:<panel>" against the live registry.
export function mobResolvePanel(id: string | null | undefined): PluginPanelInfo | null {
  if (!id || id.indexOf("plugin:") !== 0) return null;
  const parts = id.split(":");
  const api = mw().CODEX_PLUGINS_API;
  if (!api || !api.getPanels) return null;
  try {
    return (api.getPanels() || []).find(p => p.pluginId === parts[1] && p.id === parts.slice(2).join(":")) ?? null;
  } catch { return null; }
}

// ── Sheet drag mechanics ──────────────────────────────────────────────────
// Header drag → translate down → past 110px (or a flick) dismisses.
export function mobSheetDrag(el: HTMLElement | null, headEl: HTMLElement | null, onDismiss: () => void): () => void {
  if (!el || !headEl) return () => {};
  let y0 = 0, last = 0, t0 = 0, lastT = 0, on = false;
  const start = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    on = true; y0 = last = t.clientY; t0 = lastT = performance.now();
    el.style.transition = "none";
  };
  const move = (e: TouchEvent): void => {
    if (!on) return;
    const t = e.touches[0]; if (!t) return;
    const dy = Math.max(0, t.clientY - y0);
    el.style.transform = `translateY(${dy}px)`;
    last = t.clientY; lastT = performance.now();
  };
  const end = (): void => {
    if (!on) return;
    on = false;
    const dy = Math.max(0, last - y0);
    const vel = dy / Math.max(1, lastT - t0);
    el.style.transition = "";
    el.style.transform = "";
    if (dy > 110 || vel > 0.55) { try { onDismiss(); } catch {} }
  };
  headEl.addEventListener("touchstart", start, { passive: true });
  headEl.addEventListener("touchmove", move, { passive: true });
  headEl.addEventListener("touchend", end);
  headEl.addEventListener("touchcancel", end);
  return () => {
    headEl.removeEventListener("touchstart", start);
    headEl.removeEventListener("touchmove", move);
    headEl.removeEventListener("touchend", end);
    headEl.removeEventListener("touchcancel", end);
  };
}

// Left-edge swipe-back on a full-screen sheet body.
export function mobEdgeBack(el: HTMLElement | null, onBack: () => void): () => void {
  if (!el) return () => {};
  let x0: number | null = null, y0 = 0, fired = false;
  const start = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    x0 = t.clientX <= 28 ? t.clientX : null;
    y0 = t.clientY;
    fired = false;
  };
  const move = (e: TouchEvent): void => {
    if (x0 == null || fired) return;
    const t = e.touches[0]; if (!t) return;
    const dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
    if (dx > 70 && dx > dy * 1.4) { fired = true; try { onBack(); } catch {} }
  };
  const end = (): void => { x0 = null; fired = false; };
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchmove", move, { passive: true });
  el.addEventListener("touchend", end, { passive: true });
  return () => {
    el.removeEventListener("touchstart", start);
    el.removeEventListener("touchmove", move);
    el.removeEventListener("touchend", end);
  };
}

// Pull-down-from-top on the Word = the omnibar. Only fires when the reader's
// scroller is already at the very top, the pull is long and decidedly vertical,
// and no sheet/palm sits above the Word.
export function mobPullToOmni(wrapEl: HTMLElement | null, isFree: () => boolean): () => void {
  if (!wrapEl) return () => {};
  let y0 = 0, x0 = 0, armed = false, fired = false;
  const scroller = (): Element | null => wrapEl.querySelector(".cxr-scroll");
  const start = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!t || e.touches.length > 1) { armed = false; return; }
    const sc = scroller();
    armed = !!(sc && (sc as HTMLElement).scrollTop <= 0 && isFree());
    fired = false;
    y0 = t.clientY; x0 = t.clientX;
  };
  const move = (e: TouchEvent): void => {
    if (!armed || fired) return;
    const t = e.touches[0]; if (!t) return;
    const dy = t.clientY - y0, dx = Math.abs(t.clientX - x0);
    if (dy < -8) { armed = false; return; } // scrolling down — not a pull
    if (dy > 96 && dy > dx * 2) {
      fired = true; armed = false;
      try { if (mw().codexOpenOmni) mw().codexOpenOmni?.(); } catch {}
    }
  };
  const end = (): void => { armed = false; fired = false; };
  wrapEl.addEventListener("touchstart", start, { passive: true });
  wrapEl.addEventListener("touchmove", move, { passive: true });
  wrapEl.addEventListener("touchend", end, { passive: true });
  wrapEl.addEventListener("touchcancel", end, { passive: true });
  return () => {
    wrapEl.removeEventListener("touchstart", start);
    wrapEl.removeEventListener("touchmove", move);
    wrapEl.removeEventListener("touchend", end);
    wrapEl.removeEventListener("touchcancel", end);
  };
}
