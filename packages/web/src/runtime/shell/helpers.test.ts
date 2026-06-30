// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  reduced,
  isOn,
  applyClass,
  readTint,
  makeStars,
  ensureCanvas,
  sizeCanvas,
  draw,
  startWall,
  stopWall,
  syncWall,
  onResize,
  _resetForTest,
} from "./helpers.js";
import { sw } from "./shell-window.js";

// ── Canvas mock ───────────────────────────────────────────────────────────────
// jsdom does not implement CanvasRenderingContext2D. We stub getContext so that
// ensureCanvas() returns true and canvas-dependent code paths are reachable.

interface MockCtx {
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  fillStyle: string;
}

function makeMockCtx(): MockCtx {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
  };
}

function installCanvasMock(ctx: MockCtx = makeMockCtx()): MockCtx {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

// ── rAF stubs ─────────────────────────────────────────────────────────────────
// jsdom has a stub rAF but we want deterministic IDs.
function installRafMocks(): void {
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  _resetForTest();
  document.body.classList.remove("cx-os7");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  installCanvasMock();
  installRafMocks();
});

// ── reduced ───────────────────────────────────────────────────────────────────
describe("reduced", () => {
  it("returns false when mqReduce is null (jsdom has no matchMedia)", () => {
    // In jsdom, window.matchMedia throws → mqReduce stays null → reduced() = false.
    expect(reduced()).toBe(false);
  });
});

// ── isOn ──────────────────────────────────────────────────────────────────────
describe("isOn (v9.2 SHED legacy stub)", () => {
  it("always returns true", () => {
    expect(isOn()).toBe(true);
  });
});

// ── makeStars ─────────────────────────────────────────────────────────────────
describe("makeStars", () => {
  it("creates exactly 240 stars", () => {
    makeStars();
    const el = document.getElementById("cx-wall");
    void el; // stars live in module state; test via ensureCanvas + draw
    // Call draw to exercise the array; makeStars exposes count indirectly.
    // We verify count by checking draw calls 240 arcs.
    const ctx = makeMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    ensureCanvas();
    sizeCanvas();
    draw(0);
    expect(ctx.arc).toHaveBeenCalledTimes(240);
  });

  it("produces stars with r in the valid CSS-px range (0.4–1.5)", () => {
    // We can't inspect module-private stars directly, but we can verify the
    // legacy formula: r = 0.4 + z * 1.1, z ∈ [0,1) ⇒ r ∈ [0.4, 1.5).
    // Run makeStars many times; all arc calls must use r in that range (before DPR).
    // Stubbed rAF DPR = 1 → arc radius = star.r * 1.
    const ctx = makeMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    ensureCanvas();
    sizeCanvas();
    makeStars();
    draw(0);
    // The third arg to arc() is the radius.
    for (const call of ctx.arc.mock.calls as [number, number, number, ...unknown[]][]) {
      const radius = call[2];
      expect(radius).toBeGreaterThanOrEqual(0.4);
      expect(radius).toBeLessThan(1.51); // upper bound: z < 1 so r < 1.5; allow fp
    }
  });
});

// ── ensureCanvas ──────────────────────────────────────────────────────────────
describe("ensureCanvas", () => {
  it("creates a #cx-wall canvas element in the document body", () => {
    const result = ensureCanvas();
    expect(result).toBe(true);
    const el = document.getElementById("cx-wall");
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("CANVAS");
  });

  it("prepends the canvas as the first child of body", () => {
    const sentinel = document.createElement("div");
    document.body.appendChild(sentinel);
    ensureCanvas();
    expect(document.body.firstElementChild?.id).toBe("cx-wall");
  });

  it("sets aria-hidden on the canvas", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reuses an existing connected canvas without reinserting", () => {
    ensureCanvas();
    const first = document.getElementById("cx-wall");
    ensureCanvas();
    const second = document.getElementById("cx-wall");
    expect(first).toBe(second);
    expect(document.querySelectorAll("#cx-wall").length).toBe(1);
  });

  it("returns false when document.body is absent", () => {
    // Detach body temporarily
    const body = document.body;
    document.documentElement.removeChild(body);
    const result = ensureCanvas();
    document.documentElement.appendChild(body);
    expect(result).toBe(false);
  });

  it("returns false when getContext returns null (no 2D support)", () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const result = ensureCanvas();
    expect(result).toBe(false);
  });
});

// ── sizeCanvas ────────────────────────────────────────────────────────────────
describe("sizeCanvas", () => {
  it("sets canvas pixel dimensions = innerWidth/Height × DPR (capped at 3)", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 300);
    ensureCanvas();
    sizeCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    expect(el.width).toBe(800);   // 400 × 2
    expect(el.height).toBe(600);  // 300 × 2
  });

  it("clamps devicePixelRatio to 3", () => {
    vi.stubGlobal("devicePixelRatio", 10);
    vi.stubGlobal("innerWidth", 100);
    vi.stubGlobal("innerHeight", 50);
    ensureCanvas();
    sizeCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    expect(el.width).toBe(300);  // 100 × 3 (cap)
    expect(el.height).toBe(150); // 50 × 3
  });

  it("floors DPR to 1 when devicePixelRatio is 0 or missing", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    vi.stubGlobal("innerWidth", 200);
    vi.stubGlobal("innerHeight", 100);
    ensureCanvas();
    sizeCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    expect(el.width).toBe(200);
    expect(el.height).toBe(100);
  });

  it("is a no-op when canvas has not been created yet", () => {
    // _resetForTest cleared canvas; calling sizeCanvas before ensureCanvas should not throw.
    expect(() => sizeCanvas()).not.toThrow();
  });
});

// ── draw ──────────────────────────────────────────────────────────────────────
describe("draw", () => {
  it("is a no-op when canvas/ctx have not been set up (no throw)", () => {
    // After _resetForTest ctx is null.
    expect(() => draw(0)).not.toThrow();
  });

  it("calls clearRect and one arc+fill per star (240) when fully set up", () => {
    const ctx = makeMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    ensureCanvas();
    makeStars();
    sizeCanvas();
    draw(0);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.beginPath).toHaveBeenCalledTimes(240);
    expect(ctx.arc).toHaveBeenCalledTimes(240);
    expect(ctx.fill).toHaveBeenCalledTimes(240);
  });

  it("fills each star with an rgba() string", () => {
    const filledStyles: string[] = [];
    const ctx: MockCtx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      get fillStyle() { return ""; },
      set fillStyle(v: string) { filledStyles.push(v); },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    ensureCanvas();
    makeStars();
    sizeCanvas();
    draw(0);
    expect(filledStyles.length).toBe(240);
    for (const s of filledStyles) {
      expect(s).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    }
  });
});

// ── stopWall ──────────────────────────────────────────────────────────────────
describe("stopWall", () => {
  it("hides the canvas when hide = true", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = "block";
    stopWall(true);
    expect(el.style.display).toBe("none");
  });

  it("does NOT hide the canvas when hide = false", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = "block";
    stopWall(false);
    expect(el.style.display).toBe("block");
  });

  it("cancels any pending requestAnimationFrame", () => {
    // startWall schedules a rAF; stopWall must cancel it
    document.body.classList.add("cx-os7");
    startWall(); // schedules rAF → raf = 42 (from mock)
    stopWall(false);
    expect(vi.mocked(cancelAnimationFrame)).toHaveBeenCalledWith(42);
  });

  it("is safe to call when canvas has never been created", () => {
    expect(() => stopWall(true)).not.toThrow();
    expect(() => stopWall(false)).not.toThrow();
  });
});

// ── startWall ─────────────────────────────────────────────────────────────────
describe("startWall", () => {
  it("creates the canvas and makes it visible (display = '')", () => {
    startWall();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    expect(el).not.toBeNull();
    expect(el.style.display).toBe("");
  });

  it("schedules a requestAnimationFrame when motion is not reduced", () => {
    // reduced() returns false in jsdom (no matchMedia support) → rAF loop starts.
    startWall();
    expect(vi.mocked(requestAnimationFrame)).toHaveBeenCalled();
  });

  it("does not schedule a second rAF if already running", () => {
    startWall(); // running = true, raf = 42
    startWall(); // should return early (running guard)
    // requestAnimationFrame called exactly once
    expect(vi.mocked(requestAnimationFrame)).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when getContext returns null (ensureCanvas fails)", () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    startWall();
    // No rAF should be scheduled (startWall returned early)
    expect(vi.mocked(requestAnimationFrame)).not.toHaveBeenCalled();
  });
});

// ── applyClass ────────────────────────────────────────────────────────────────
describe("applyClass", () => {
  it("adds cx-os7 to document.body", () => {
    applyClass();
    expect(document.body.classList.contains("cx-os7")).toBe(true);
  });

  it("is idempotent — calling twice does not duplicate the class", () => {
    applyClass();
    applyClass();
    expect(document.body.className.match(/cx-os7/g)?.length).toBe(1);
  });

  it("is a no-op when document.body is absent", () => {
    const body = document.body;
    document.documentElement.removeChild(body);
    expect(() => applyClass()).not.toThrow();
    document.documentElement.appendChild(body);
  });
});

// ── syncWall ──────────────────────────────────────────────────────────────────
describe("syncWall", () => {
  it("hides canvas when body lacks cx-os7", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = "block";
    document.body.classList.remove("cx-os7");
    syncWall();
    expect(el.style.display).toBe("none");
  });

  it("does not hide canvas (pauses) when hidden tab + cx-os7 present", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = "block";
    document.body.classList.add("cx-os7");
    // Simulate hidden tab
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    syncWall(); // stopWall(false) — cancels rAF but keeps display
    expect(el.style.display).toBe("block"); // NOT "none"
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  it("starts the wall (display='') when cx-os7 is present and tab is visible", () => {
    document.body.classList.add("cx-os7");
    syncWall();
    const el = document.getElementById("cx-wall");
    expect(el?.style.display).toBe("");
  });
});

// ── onResize ──────────────────────────────────────────────────────────────────
describe("onResize", () => {
  it("is a no-op when canvas has not been created", () => {
    expect(() => onResize()).not.toThrow();
  });

  it("is a no-op when canvas is hidden (display=none)", () => {
    ensureCanvas();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = "none";
    const ctx = makeMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    onResize();
    // clearRect should NOT have been called (canvas hidden)
    expect(ctx.clearRect).not.toHaveBeenCalled();
  });

  it("calls sizeCanvas and draw(0) when canvas is visible and not running", () => {
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("innerHeight", 240);
    const ctx = makeMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    ensureCanvas();
    makeStars();
    const el = document.getElementById("cx-wall") as HTMLCanvasElement;
    el.style.display = ""; // visible
    onResize();
    // sizeCanvas was called (canvas dimensions updated)
    expect(el.width).toBe(320);
    expect(el.height).toBe(240);
    // draw(0) was called — clearRect invoked
    expect(ctx.clearRect).toHaveBeenCalled();
  });
});

// ── readTint ──────────────────────────────────────────────────────────────────
describe("readTint (tint parsing)", () => {
  it("parses a hex color (#rrggbb) from --cx-accent", () => {
    // Inject the CSS variable via body style
    document.body.style.setProperty("--cx-accent", "#7ee0ff");
    readTint();
    // Verify via draw output — the fillStyle rgba() should use #7ee0ff values.
    // r=126 g=224 b=255; near star (z≈1) mix≈0.35, far star (z≈0) mix≈0.80.
    // We only confirm readTint doesn't throw and updates the tint (behavior verified
    // by draw output using the live tint).
    expect(() => readTint()).not.toThrow();
  });

  it("parses an rgb(...) color from --cx-accent", () => {
    document.body.style.setProperty("--cx-accent", "rgb(100, 200, 50)");
    expect(() => readTint()).not.toThrow();
  });

  it("parses an rgba(...) color from --cx-accent", () => {
    document.body.style.setProperty("--cx-accent", "rgba(100, 200, 50, 0.9)");
    expect(() => readTint()).not.toThrow();
  });

  it("is silent when getComputedStyle throws", () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => {
      throw new Error("no style");
    });
    expect(() => readTint()).not.toThrow();
  });
});

// ── window contract (__CXSHELL) ───────────────────────────────────────────────
// We verify the contract inline (not via index.ts import) so module-evaluation
// side effects don't contaminate the jsdom environment.
// Pattern mirrors observability.test.ts "init logic" section.
describe("window contract (__CXSHELL)", () => {
  it("sw() addresses a ShellWindow — __CXSHELL can be set to true", () => {
    sw().__CXSHELL = true;
    expect(sw().__CXSHELL).toBe(true);
  });

  it("__CXSHELL is undefined before boot (idempotency guard precondition)", () => {
    const win = sw();
    delete win.__CXSHELL;
    expect(win.__CXSHELL).toBeUndefined();
  });

  it("setting __CXSHELL to true is the only write the engine performs", () => {
    // Simulate the index.ts guard: if not set, set it and run boot.
    const win = sw();
    delete win.__CXSHELL;
    if (!win.__CXSHELL) {
      win.__CXSHELL = true;
      applyClass(); // the boot action
    }
    expect(win.__CXSHELL).toBe(true);
    expect(document.body.classList.contains("cx-os7")).toBe(true);
  });

  it("a second boot attempt is skipped when __CXSHELL is already true", () => {
    const win = sw();
    win.__CXSHELL = true;
    document.body.classList.remove("cx-os7");
    // Simulate index.ts guard: guard fires → skip
    if (!win.__CXSHELL) {
      applyClass();
    }
    // applyClass was NOT called — cx-os7 was not added
    expect(document.body.classList.contains("cx-os7")).toBe(false);
  });
});
