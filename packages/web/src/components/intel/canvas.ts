// intel — canvas helpers (migrated verbatim from intel.jsx). Pure — no React,
// no side-effects, no module-load globals. Used by the Mirror cascade and the
// crossref link-analysis canvas. All methods take a 2d ctx and plain numbers.

export interface IntelCanvasArcOpts {
  color?: string;
  width?: number;
  glow?: number;
  bow?: number;
  alpha?: number;
  /** 0–1 draws a partial arc for animated sweep-in */
  t?: number;
}

export interface IntelCanvasNodeOpts {
  color?: string;
  /** 0–100; scales the node radius */
  weight?: number;
  ring?: boolean;
  alpha?: number;
}

export interface IntelCanvasDims {
  w: number;
  h: number;
}

export const intelCanvas = {
  // Resize a canvas to its CSS box at device-pixel ratio. Returns {w,h}.
  fit(canvas: HTMLCanvasElement): IntelCanvasDims {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      // getContext("2d") is non-null on a real HTMLCanvasElement
      canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h };
  },

  // Quadratic glow arc from (x1,y1) to (x2,y2), bowing by `bow` px.
  // t ∈ [0,1] draws a partial arc (for animated sweep-in).
  arc(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    { color = "#7cf", width = 1, glow = 6, bow = -40, alpha = 0.8, t = 1 }: IntelCanvasArcOpts = {},
  ): void {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bow;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    if (t >= 1) {
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
    } else {
      // subdivide the quadratic and draw the first t of it
      const n = Math.max(2, Math.floor(40 * t));
      ctx.moveTo(x1, y1);
      for (let i = 1; i <= n; i++) {
        const u = i / 40;
        if (u > t) break;
        const a = 1 - u;
        ctx.lineTo(
          a * a * x1 + 2 * a * u * mx + u * u * x2,
          a * a * y1 + 2 * a * u * my + u * u * y2,
        );
      }
    }
    ctx.stroke();
    ctx.restore();
  },

  // Glowing node with halo ring. r scales with `weight` 0-100.
  node(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    { color = "#7cf", weight = 50, ring = true, alpha = 1 }: IntelCanvasNodeOpts = {},
  ): number {
    const r = 2.5 + (Math.max(0, Math.min(100, weight)) / 100) * 4.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (ring) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    return r;
  },

  // Read the app accent color so canvases match the active theme.
  accent(): string {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cx-accent").trim();
      return v || "#7cf";
    } catch { return "#7cf"; }
  },
};
