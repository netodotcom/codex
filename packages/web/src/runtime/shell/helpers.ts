// shell — starfield and OS7-class logic (faithful port from legacy/shell.js).
//
// Module-level variables replace the IIFE closure variables; declaration order
// and initial values match the original exactly.
// NOTE: preserved from legacy — plain mutable module vars, not a class.
import type { Star, Tint } from "./types.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const STAR_COUNT = 240;
/** Normalized viewport-widths per second for the nearest depth band.
 * A full crossing takes ~10 min. */
const DRIFT = 0.0016;

// ── Module-level state (mirrors IIFE closure) ─────────────────────────────────
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let stars: Star[] | null = null;
let raf = 0;
let lastT = 0;
let running = false;
// NOTE: preserved from legacy — canvas.__dpr stored as module var (identical
// effect; canvas.__dpr in original was only ever written by sizeCanvas and read
// by draw, both of which live in this same module).
let canvasDpr = 1;
let tint: Tint = { r: 126, g: 224, b: 255 }; // fallback ≈ --cx-accent #7ee0ff

// NOTE: preserved from legacy — try/catch around matchMedia for environments
// that throw (jsdom, SSR, older browsers).
export let mqReduce: MediaQueryList | null = null;
try { mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch (_) {}

// ── Reduced-motion helper ─────────────────────────────────────────────────────
export function reduced(): boolean {
  return !!(mqReduce && mqReduce.matches);
}

// ── Mode flag — permanently on (v9.2 SHED) ───────────────────────────────────
// NOTE: preserved from legacy — always returns true. The classic-mode toggle,
// localStorage flag ("codex.os7"), and window.codexOS7() were all removed in
// v9.2 SHED. The body class cx-os7 stays because hundreds of scoped CSS rules
// ride on it. The function is preserved for any external call-site that might
// check it.
export function isOn(): boolean { return true; }

// ── Body class ────────────────────────────────────────────────────────────────
export function applyClass(): void {
  if (!document.body) return;
  document.body.classList.add("cx-os7");
  syncWall();
}

// ── Tint reader ───────────────────────────────────────────────────────────────
export function readTint(): void {
  try {
    const v = getComputedStyle(document.body).getPropertyValue("--cx-accent").trim();
    let m = v.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const hex = m[1] ?? "";
      tint = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
      return;
    }
    m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) tint = { r: +(m[1] ?? 0), g: +(m[2] ?? 0), b: +(m[3] ?? 0) };
  } catch (_) {}
}

// ── Star creation ─────────────────────────────────────────────────────────────
export function makeStars(): void {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const z = Math.random(); // 0 = far, 1 = near
    stars.push({
      x: Math.random(),             // normalized coords — survive resizes
      y: Math.random(),
      z,
      r: 0.4 + z * 1.1,             // CSS-px radius before DPR scale
      a: 0.18 + z * 0.5 + Math.random() * 0.12,
      tw: Math.random() * Math.PI * 2, // twinkle phase
      ts: 0.15 + Math.random() * 0.35, // twinkle speed (rad/s)
    });
  }
}

// ── Canvas lifecycle ──────────────────────────────────────────────────────────
export function ensureCanvas(): boolean {
  if (canvas && canvas.isConnected) return true;
  if (!document.body) return false;
  const el = document.getElementById("cx-wall");
  if (el instanceof HTMLCanvasElement) {
    canvas = el;
  } else if (el === null) {
    canvas = document.createElement("canvas");
    canvas.id = "cx-wall";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:none;";
    document.body.insertBefore(canvas, document.body.firstChild);
  }
  if (!canvas) return false;
  ctx = canvas.getContext("2d");
  return ctx !== null;
}

export function sizeCanvas(): void {
  if (!canvas) return;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  // NOTE: preserved from legacy — canvas.__dpr in original; stored as module
  // var (identical effect; only ever read by draw in this same module).
  canvasDpr = dpr;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
export function draw(t: number): void {
  if (!ctx || !stars || !canvas) return;
  const dpr = canvasDpr;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    const twinkle = reduced() ? 1 : 0.78 + 0.22 * Math.sin(s.tw + t * s.ts);
    const a = Math.min(1, s.a * twinkle);
    // Mix the accent into white by depth — near stars whiter, far stars more tinted.
    const mix = 0.35 + (1 - s.z) * 0.45;
    const r = Math.round(255 + (tint.r - 255) * mix);
    const g = Math.round(255 + (tint.g - 255) * mix);
    const b = Math.round(255 + (tint.b - 255) * mix);
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
    ctx.fill();
  }
}

// ── Animation loop ────────────────────────────────────────────────────────────
function step(now: DOMHighResTimeStamp): void {
  raf = 0;
  if (!running) return;
  const t = now / 1000;
  const dt = lastT ? Math.min(0.25, t - lastT) : 0;
  lastT = t;
  // Parallax drift — extremely slow, depth-weighted; wrap at the edges.
  if (stars) {
    for (const s of stars) {
      const v = DRIFT * (0.2 + s.z * 0.8);
      s.x += v * dt;
      s.y += v * 0.22 * dt;
      if (s.x > 1.002) s.x -= 1.004;
      if (s.y > 1.002) s.y -= 1.004;
    }
  }
  draw(t);
  raf = requestAnimationFrame(step);
}

// ── Wall start / stop ─────────────────────────────────────────────────────────
export function startWall(): void {
  if (!ensureCanvas()) return;
  readTint();
  if (!stars) makeStars();
  sizeCanvas();
  // ensureCanvas() verified canvas is non-null; guard here satisfies type flow.
  if (!canvas) return;
  canvas.style.display = "";
  if (reduced()) {
    // Static wallpaper: one frame, no loop.
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    draw(0);
    return;
  }
  if (running) return;
  running = true;
  lastT = 0;
  if (!raf) raf = requestAnimationFrame(step);
}

export function stopWall(hide: boolean): void {
  running = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  lastT = 0;
  if (hide && canvas) canvas.style.display = "none";
}

// The single gate: wall runs only when os7 is on, the tab is visible, and
// motion is allowed (otherwise a static frame stays painted).
export function syncWall(): void {
  const on = !!(document.body && document.body.classList.contains("cx-os7"));
  if (!on) { stopWall(true); return; }
  if (document.hidden) { stopWall(false); return; }
  startWall();
}

/** Handles window resize: resize the canvas and repaint the static frame if visible.
 * NOTE: preserved from legacy — keeps reduced-motion / hidden frames crisp. */
export function onResize(): void {
  if (canvas && canvas.style.display !== "none") {
    sizeCanvas();
    if (!running) draw(0);
  }
}

// ── Test utilities ────────────────────────────────────────────────────────────
/** Resets all mutable module state to initial values. For use in tests only.
 * Also removes any leftover #cx-wall canvas from the document so DOM state
 * does not bleed between tests. */
export function _resetForTest(): void {
  if (raf) {
    try { cancelAnimationFrame(raf); } catch (_) {}
    raf = 0;
  }
  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  try {
    const orphan =
      typeof document !== "undefined" ? document.getElementById("cx-wall") : null;
    if (orphan?.parentNode) orphan.parentNode.removeChild(orphan);
  } catch (_) {}
  canvas = null;
  ctx = null;
  stars = null;
  lastT = 0;
  running = false;
  canvasDpr = 1;
  tint = { r: 126, g: 224, b: 255 };
}
