// wm — window/desk manager logic (faithful port from legacy/wm.js).
//
// Module-level variables replace the IIFE closure variables; declaration order
// and initial values match the original exactly.
// NOTE: preserved from legacy — plain mutable module vars, not a class.
import type { Geo, LayoutRect, WinSpec, DockEntry, DockRegEntry, SavedLayout } from "./types.js";
import { ww } from "./wm-window.js";

// ── Media query ───────────────────────────────────────────────────────────────
// NOTE: preserved from legacy — try/catch around matchMedia for environments
// that throw (jsdom, SSR, older browsers).
export let MQ: MediaQueryList | null = null;
try {
  MQ = window.matchMedia("(min-width: 881px) and (pointer: fine)");
} catch (_) {}

export function active(): boolean {
  return !!(MQ && MQ.matches);
}

// ── Console registry ──────────────────────────────────────────────────────────
// backdrop holds the stacking layer, card is the window, head is the drag
// handle. min is [w, h].
export const SPECS: ReadonlyArray<WinSpec> = [
  { id: "mirror", backdrop: "cx-mirror-backdrop", card: ".cx-mirror", head: ".cx-mirror-h", min: [600, 420] },
  { id: "map",    backdrop: "cx-map-backdrop",    card: ".cx-map",    head: ".cx-map-h",    min: [600, 440] },
  { id: "art",    backdrop: "cx-art-backdrop",    card: ".cx-art",    head: ".cx-art-h",    min: [500, 380] },
  { id: "cmp",    backdrop: "cx-cmp-backdrop",    card: ".cx-cmp",    head: ".cx-cmp-h",    min: [500, 340] },
  { id: "sword",  backdrop: "cx-sword-backdrop",  card: ".cx-sword",  head: ".cx-sword-h",  min: [640, 460] },
  { id: "ops",    backdrop: "cx-ops-backdrop",    card: ".cx-ops",    head: ".cx-ops-h",    min: [720, 480] },
  { id: "const",  backdrop: "cx-const-backdrop",  card: ".cx-const",  head: ".cx-const-h",  min: [720, 600] },
  // v8 MONAD — the generic window class (winhost.jsx): any plugin panel
  // floats here; instance identity rides data-wm-id on the backdrop.
  { id: "win",    backdrop: "cx-win-backdrop",    card: ".cx-win",    head: ".cx-win-h",    min: [380, 320] },
] as const;

// ── Dock glyph map (fallback unicode runes) ──────────────────────────────────
const DOCK_GLYPH: Record<string, string> = {
  mirror: "⌬", map: "◎", art: "▦", cmp: "≡", sword: "⚔", ops: "❖", const: "❂",
};

// ── v11.5 LINE ICONS — every dock chip wears a tiny inline-SVG line glyph ───
// instead of a cryptic Unicode rune. Stroke = currentColor so themes +
// hover + is-focus light them for free; 18×18 viewBox, 1.6 stroke, round
// caps — one elegant visual language that reads at a glance WITHOUT a
// tutorial. Tokens only (no fills, no color literals). Keyed by chip id;
// ids without an icon fall back to their text glyph.
function svg(paths: string): string {
  return '<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
}

const DOCK_ICON: Record<string, string> = {
  // reader — an open book
  reader:  svg('<path d="M9 4.5C7.5 3.5 5 3.3 3 4v9.5c2-.7 4.5-.5 6 .5"/><path d="M9 4.5c1.5-1 4-1.2 6-.5v9.5c-2-.7-4.5-.5-6 .5z"/>'),
  // library — stacked book spines
  library: svg('<rect x="3" y="3" width="3.2" height="12" rx="0.6"/><rect x="7.4" y="3" width="3.2" height="12" rx="0.6"/><path d="M12.2 4.2l2.9.8-2.4 11-2.9-.8"/>'),
  // oracle — eye / lens
  oracle:  svg('<path d="M1.8 9S4.5 4 9 4s7.2 5 7.2 5-2.7 5-7.2 5S1.8 9 1.8 9z"/><circle cx="9" cy="9" r="2.1"/>'),
  // marks — bookmark
  marks:   svg('<path d="M5 3h8v12l-4-2.8L5 15z"/>'),
  // translations — two speech glyphs / A↔文
  trans:   svg('<path d="M3 5h6"/><path d="M6 5v2.5c0 2.5-1.4 4-3 4.7"/><path d="M5 9.5c.8 1.4 2.2 2.3 4 2.8"/><path d="M10.5 15l2.8-7 2.7 7"/><path d="M11.4 13h3.8"/>'),
  talmud:  svg('<path d="M9 4v11"/><path d="M9 5.2C7.8 4.3 5.6 4.1 4 4.6v9.2c1.6-.5 3.8-.3 5 .6"/><path d="M9 5.2c1.2-.9 3.4-1.1 5-.6v9.2c-1.6-.5-3.8-.3-5 .6"/>'),
  comm:    svg('<path d="M3 4.5h12v7.5H8.5L5 15v-3H3z"/><path d="M6 7.5h6"/><path d="M6 9.6h4"/>'),
  gem:     svg('<path d="M5.5 3h7l3 4-6.5 8L2.5 7z"/><path d="M2.5 7h13"/><path d="M6.5 3 9 15l2.5-12"/>'),
  gnosis:  svg('<circle cx="9" cy="9" r="6"/><path d="M9 3v12"/><path d="M9 9l4.2 4.2"/><path d="M9 9 4.8 13.2"/>'),
  disarm:  svg('<path d="M5 13.5 13 5.5"/><path d="M11.5 4 14 6.5"/><path d="M3.5 11.5 6 14"/><path d="M5 13.5l-1.6 1.6"/><path d="M13 5.5 14.6 3.9"/>'),
  exeg:    svg('<path d="M11.5 3.5 14.5 6.5 6 15H3v-3z"/><path d="M10 5 13 8"/>'),
  txan:    svg('<path d="M3 9h12"/><path d="M5.5 6.5 3 9l2.5 2.5"/><path d="M12.5 6.5 15 9l-2.5 2.5"/>'),
  omni:    svg('<circle cx="8" cy="8" r="4.5"/><path d="M11.5 11.5 15 15"/>'),
  canon:   svg('<circle cx="9" cy="9" r="1.4"/><circle cx="3.5" cy="5" r="1"/><circle cx="14.5" cy="5.5" r="1"/><circle cx="5" cy="14" r="1"/><circle cx="13.5" cy="13" r="1"/><path d="M8 8 4.3 5.4M10 8.2 13.7 6M8.2 10.2 5.6 13.2M10 10.1 12.8 12.3"/>'),
  sword:   svg('<path d="M13.5 3.5 7 10l1.5 1.5L15 5z"/><path d="M7 10l-3.5.5L4 14l.5.5L8 14 9.5 12.5"/><path d="M3.5 14.5 6 12"/>'),
  displays: svg('<rect x="2.5" y="3.5" width="9" height="7" rx="1"/><rect x="9" y="8" width="6.5" height="5" rx="1"/><path d="M6 12.5h3"/>'),
  arrange: svg('<rect x="3" y="3" width="5" height="5" rx="0.8"/><rect x="10" y="3" width="5" height="5" rx="0.8"/><rect x="3" y="10" width="5" height="5" rx="0.8"/><rect x="10" y="10" width="5" height="5" rx="0.8"/>'),
  edit:    svg('<path d="M3 9h12"/><circle cx="6.5" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M3 5h12"/><circle cx="11" cy="5" r="1.6" fill="currentColor" stroke="none"/><path d="M3 13h12"/><circle cx="8.5" cy="13" r="1.6" fill="currentColor" stroke="none"/>'),
  continue: svg('<path d="M9 3a6 6 0 1 0 6 6"/><path d="M15 3v3.5h-3.5"/>'),
  // window-header controls
  min:     svg('<path d="M4 13h10"/>'),
  popout:  svg('<path d="M7 4H4v10h10v-3"/><path d="M10 4h4v4"/><path d="M8.5 9.5 14 4"/>'),
  close:   svg('<path d="M5 5l8 8"/><path d="M13 5l-8 8"/>'),
};

function chipGlyphHTML(id: string, fallbackGlyph?: string): string {
  return DOCK_ICON[id] ?? ('<span class="cx-wm-glyph-txt">' + (fallbackGlyph ?? "▣") + "</span>");
}

// ── Dock state ─────────────────────────────────────────────────────────────────
let dockEl: HTMLElement | null = null;
export let dockWins: DockEntry[] = []; // exported for tests

// ── OS·7 helper ───────────────────────────────────────────────────────────────
function os7on(): boolean {
  return !!(document.body && document.body.classList.contains("cx-os7"));
}

// DOCK_LAUNCH — kept for API stability; only rendered when os7 is on.
// NOTE: preserved from legacy — defined but superseded by DOCK_VERBS in v3.
const DOCK_LAUNCH = [
  { glyph: "⌘", label: "OMNI", title: "Omnibar (⌘K)", run: function (): void {
    if (typeof ww().codexOpenOmni === "function") ww().codexOpenOmni!();
  } },
  { glyph: "❖", label: "OPS", title: "Open OPS console", run: function (): void {
    if (typeof ww().codexOpenOps === "function") ww().codexOpenOps!("");
  } },
  { glyph: "❂", label: "CANON", title: "Open canon constellation", run: function (): void {
    if (typeof ww().codexOpenConstellation === "function") ww().codexOpenConstellation!();
  } },
  { glyph: "◬", label: "ORACLE", title: "Open library · Oracle", run: function (): void {
    try {
      window.dispatchEvent(new CustomEvent("codex:open-library"));
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action: "toggle-oracle" } }));
    } catch (_) {}
  } },
] as const;
// suppress unused-variable lint (DOCK_LAUNCH is part of the public contract)
void DOCK_LAUNCH;

// ── Dock v3 (OS·7 ACTION) ─────────────────────────────────────────────────────
function dockNow(): { ref?: string } | null {
  try {
    const n = ww().CODEX_NOW;
    return (n && n.ref) ? n : null;
  } catch (_) { return null; }
}

function dockTrailRef(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem("codex.trail") ?? "[]") as unknown;
    if (!Array.isArray(t)) return null;
    const last = t[t.length - 1] as unknown;
    if (last && typeof last === "object" && "ref" in last && typeof (last as Record<string, unknown>)["ref"] === "string") {
      return String((last as Record<string, unknown>)["ref"]);
    }
    return null;
  } catch (_) { return null; }
}

// NOTE: preserved from legacy — DOCK_VERBS defined but superseded by DOCK_REG.
const DOCK_VERBS = [
  { glyph: "⚔", label: "SWORD",  name: "Sword",  kind: "sword" },
  { glyph: "⌬", label: "MIRROR", name: "Mirror", kind: "mirror" },
  { glyph: "◎", label: "MAP",    name: "Map",    kind: "map" },
] as const;
void DOCK_VERBS;

// ── Dock v4 (v10 REBIRTH) — customizable dock ─────────────────────────────────
function deskOpen(k: string): boolean {
  const d = ww().codexDesk;
  if (d && d.on && d.on()) { d.open(k); return true; }
  return false;
}

function verbRun(kind: string): void {
  const n = dockNow();
  const r = (n && n.ref) || dockTrailRef();
  if (!r) return;
  try { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind, ref: r } })); } catch (_) {}
}

function panelRun(id: string): () => void {
  return function (): void {
    if (typeof ww().codexOpenPanel === "function") ww().codexOpenPanel!(id);
  };
}

const DOCK_REG: ReadonlyArray<DockRegEntry> = [
  { id: "reader",   glyph: "✦", label: "READER",  title: "The Reader — the main plugin", locked: true,
    run: function (): void { deskOpen("reader"); } },
  { id: "library",  glyph: "☰", label: "LIB",     title: "The Shelves — every canon (O was oracle; this is books)",
    run: function (): void { if (!deskOpen("library")) try { window.dispatchEvent(new CustomEvent("codex:open-library")); } catch (_) {} } },
  { id: "oracle",   glyph: "◬", label: "ORACLE",  title: "The Oracle — AI companion bound to the reader (O)",
    run: function (): void { deskOpen("oracle"); } },
  { id: "marks",    glyph: "⌖", label: "MARKS",   title: "The Marks — your trail through the text (B)",
    run: function (): void { deskOpen("marks"); } },
  { id: "trans",    glyph: "Α/Ω", label: "TRANS", title: "Translations — its own window (T)", run: panelRun("trans") },
  { id: "talmud",   glyph: "ת", label: "TALMUD",  title: "Talmud — its own window",           run: panelRun("talmud") },
  { id: "comm",     glyph: "§", label: "COMM",    title: "Commentary — its own window",       run: panelRun("comm") },
  { id: "gem",      glyph: "Σn", label: "GEM",    title: "Gematria — its own window",         run: panelRun("gem") },
  { id: "gnosis",   glyph: "⟁", label: "GNOSIS",  title: "Gnosis — its own window",           run: panelRun("gnosis") },
  { id: "disarm",   glyph: "⚔", label: "DISARM",  title: "Disarm — its own window",           run: panelRun("disarm") },
  { id: "exeg",     glyph: "✎", label: "EXEG",    title: "Exegesis — its own window",         run: panelRun("exeg") },
  { id: "txan",     glyph: "⟷", label: "WORDS",   title: "Word analysis — its own window",    run: panelRun("txan") },
  { id: "omni",     glyph: "⌘", label: "OMNI",    title: "Omnibar (⌘K)",
    run: function (): void { if (typeof ww().codexOpenOmni === "function") ww().codexOpenOmni!(); } },
  { id: "canon",    glyph: "❂", label: "GALAXY",  title: "The canon as one galaxy",
    run: function (): void { if (typeof ww().codexOpenConstellation === "function") ww().codexOpenConstellation!(); } },
  { id: "sword",    glyph: "⚔", label: "SWORD",   title: "Sword — cleave the current verse",
    run: function (): void { verbRun("sword"); } },
  { id: "mirror",   glyph: "⌬", label: "MIRROR",  title: "Mirror — the current verse across translations",
    run: function (): void { verbRun("mirror"); } },
  { id: "map",      glyph: "◎", label: "MAP",     title: "Map — where the current verse happens",
    run: function (): void { verbRun("map"); } },
  { id: "displays", glyph: "⧉", label: "DISPLAYS", title: "Throw a surface onto another monitor",
    run: function (anchor?: HTMLElement): void { dockDisplaysMenu(anchor); } },
] as const;

const DOCK_PIN_KEY = "codex.dock.v2";
// v11 default pins; "study" ids are filtered out by dockPins since they left
// the registry.
const DOCK_DEFAULT = ["reader", "library", "oracle", "marks", "trans", "omni", "displays"];

function dockPins(): string[] {
  let pins: unknown = null;
  try { pins = JSON.parse(localStorage.getItem(DOCK_PIN_KEY) ?? "null"); } catch (_) {}
  let arr: string[] = Array.isArray(pins) && (pins as unknown[]).length
    ? (pins as unknown[]).filter((x): x is string => typeof x === "string")
    : DOCK_DEFAULT.slice();
  // the law: reader first, always.
  arr = arr.filter((id, i) => id !== "reader" && arr.indexOf(id) === i && DOCK_REG.some((c) => c.id === id));
  arr.unshift("reader");
  return arr;
}

function dockSavePins(pins: string[]): void {
  try { localStorage.setItem(DOCK_PIN_KEY, JSON.stringify(pins)); } catch (_) {}
  dockRender();
}

// ── Small WM-owned popovers (editor + displays) ──────────────────────────────
// Plain DOM — never React.
let dockPop: HTMLElement | null = null;

function dockPopClose(): void {
  if (dockPop) { dockPop.remove(); dockPop = null; }
}

function dockPopOpen(): HTMLElement {
  dockPopClose();
  dockPop = document.createElement("div");
  dockPop.className = "cx-wm-dockpop";
  document.body.appendChild(dockPop);
  setTimeout(function (): void {
    const away = function (e: Event): void {
      if (dockPop && e.target instanceof Node && !dockPop.contains(e.target)) {
        dockPopClose();
        document.removeEventListener("pointerdown", away, true);
      }
    };
    document.addEventListener("pointerdown", away, true);
  }, 0);
  return dockPop;
}

function dockDisplaysMenu(_anchor?: HTMLElement): void {
  const pop = dockPopOpen();
  const h = document.createElement("b");
  h.textContent = "⧉ SECOND DISPLAY — open as its own window, drag to any monitor";
  pop.appendChild(h);
  const D = ww().codexDisplays;
  (D ? D.surfaces : []).forEach(function (s) {
    const b = document.createElement("button");
    b.textContent = s.toUpperCase();
    b.addEventListener("click", function (): void { D!.open(s); dockPopClose(); });
    pop.appendChild(b);
  });
  const note = document.createElement("span");
  note.textContent = "every window shares one reading cursor";
  pop.appendChild(note);
}

function dockEditMenu(): void {
  const pop = dockPopOpen();
  const h = document.createElement("b");
  h.textContent = "✎ DOCK — pick your chips · the reader is law";
  pop.appendChild(h);
  const pins = dockPins();
  DOCK_REG.forEach(function (c) {
    const row = document.createElement("label");
    row.className = "cx-wm-dockpop-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = pins.indexOf(c.id) >= 0;
    cb.disabled = !!c.locked;
    cb.addEventListener("change", function (): void {
      const cur = dockPins().filter((id) => id !== c.id);
      if (cb.checked) cur.push(c.id);
      dockSavePins(cur);
    });
    const t = document.createElement("span");
    t.textContent = c.glyph + " " + c.label + (c.locked ? " · FIRST, ALWAYS" : "");
    row.appendChild(cb); row.appendChild(t);
    pop.appendChild(row);
  });
  const reset = document.createElement("button");
  reset.textContent = "RESET TO DEFAULT";
  reset.addEventListener("click", function (): void { dockSavePins(DOCK_DEFAULT.slice()); dockPopClose(); });
  pop.appendChild(reset);
}

// ── DRAG-TO-REORDER dock chips ────────────────────────────────────────────────
// Grab a launcher chip and drag it left/right; the pinned order persists
// in codex.dock.v2. The reader is law: it never moves and nothing crosses
// in front of it. Plain pointer-driven reorder — no HTML5 DnD.
function makeChipReorderable(chip: HTMLButtonElement, id: string): void {
  if (id === "reader") return; // law: first, always, immovable
  chip.addEventListener("pointerdown", function (e: PointerEvent): void {
    if (e.button !== 0) return;
    let startX = e.clientX;
    let moved = false;
    let raf = 0;
    let sibs: HTMLElement[] = [];
    let selfRect: DOMRect = chip.getBoundingClientRect();

    function begin(): void {
      chip.classList.add("cx-wm-chip-dragging");
      sibs = Array.from(
        chip.parentNode?.querySelectorAll<HTMLElement>(".cx-wm-dock-act[data-dock-id]") ?? [],
      ).filter((s) => s.getAttribute("data-dock-id") !== "reader");
      selfRect = chip.getBoundingClientRect();
      void selfRect; // used implicitly via closure in legacy; preserved
    }

    function move(ev: PointerEvent): void {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; begin(); }
      if (raf) return;
      raf = requestAnimationFrame(function (): void {
        raf = 0;
        chip.style.transform = "translateX(" + dx + "px)";
        chip.style.zIndex = "5";
      });
    }

    function up(ev: PointerEvent): void {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      chip.classList.remove("cx-wm-chip-dragging");
      chip.style.transform = "";
      chip.style.zIndex = "";
      if (!moved) return;
      // where did we land? compute target index among reorderable sibs.
      const cx = ev.clientX;
      const order = dockPins(); // [reader, ...rest]
      const rest = order.filter((x) => x !== "reader");
      const from = rest.indexOf(id);
      if (from < 0) return;
      // build current on-screen x-centers of reorderable chips (sans self)
      const targets = sibs
        .filter((s) => s !== chip)
        .map((s) => {
          const r = s.getBoundingClientRect();
          return { id: s.getAttribute("data-dock-id") ?? "", mid: r.left + r.width / 2 };
        });
      const toIdx = targets.findIndex((tgt) => cx < tgt.mid);
      const to = toIdx >= 0 ? toIdx : targets.length;
      rest.splice(from, 1);
      // clamp to (the index already accounts for removal when to > from)
      rest.splice(Math.min(to, rest.length), 0, id);
      dockSavePins(["reader", ...rest]);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    startX = startX; // satisfy closure lint
  });
}

// ── ⊞ ARRANGE — layouts + SAVED STUDY SETUPS ─────────────────────────────────
const LAYOUTS_KEY = "codex.layouts.v1";

export function liveWindows(): DockEntry[] {
  // visible, connected, non-minimized; ordered by z (front last).
  return dockWins
    .filter((w) => w.backdrop.isConnected && w.backdrop.style.display !== "none")
    .sort((a, b) =>
      (parseInt(a.backdrop.style.zIndex || "0", 10)) -
      (parseInt(b.backdrop.style.zIndex || "0", 10)),
    );
}

function animateGeo(card: HTMLElement, g: Geo): void {
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) {}
  if (!reduce) {
    card.classList.add("cx-wm-snapping");
    setTimeout(function (): void { card.classList.remove("cx-wm-snapping"); }, 240);
  }
  card.style.left = g.x + "px"; card.style.top = g.y + "px";
  card.style.width = g.w + "px"; card.style.height = g.h + "px";
}

function placeWindow(w: DockEntry, g: Geo): void {
  const clamped = clampGeo({ x: g.x, y: g.y, w: g.w, h: g.h }, w.min);
  animateGeo(w.card, clamped);
  // NOTE: preserved from legacy — setGeo is always defined on DockEntry;
  // the `else saveGeo(w.id, clamped)` branch in the original was unreachable.
  w.setGeo(clamped);
}

function computeLayout(kind: string, n: number): LayoutRect[] {
  // NOTE: preserved from legacy — local aliases P and GAP mirror the original `var P = PAD, GAP = 8`.
  const P = PAD;
  const GAP = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const H = vh - P * 2;
  let rects: LayoutRect[] = [];

  function col(i: number, cols: number): LayoutRect {
    const cw = Math.floor((vw - P * 2 - GAP * (cols - 1)) / cols);
    return { x: P + i * (cw + GAP), y: P, w: cw, h: H };
  }

  if (kind === "halves" || (kind === "auto" && n === 2)) {
    // NOTE: preserved from legacy — first loop result is thrown away by rects = []; quirk kept exactly.
    for (let i = 0; i < n; i++) rects.push(col(i % 2, 2));
    rects = [];
    for (let a = 0; a < n; a++) rects.push(col(a < Math.ceil(n / 2) ? 0 : 1, 2));
  } else if (kind === "thirds") {
    for (let t = 0; t < n; t++) rects.push(col(t % 3, 3));
  } else if (kind === "quad") {
    const cw = Math.floor((vw - P * 2 - GAP) / 2);
    const ch = Math.floor((vh - P * 2 - GAP) / 2);
    const slots = [
      [P, P] as const,
      [P + cw + GAP, P] as const,
      [P, P + ch + GAP] as const,
      [P + cw + GAP, P + ch + GAP] as const,
    ] as const;
    for (let q = 0; q < n; q++) {
      const s = slots[q % 4];
      if (!s) continue; // NOTE: preserved from legacy — index is always valid; guard for noUncheckedIndexedAccess
      rects.push({ x: s[0], y: s[1], w: cw, h: ch });
    }
  } else if (kind === "reader") {
    // reader centered, others flank. center column ~50%, side columns split.
    const side = Math.max(0, n - 1);
    const cwC = Math.floor(vw * (side ? 0.48 : 0.7));
    const cx = Math.floor((vw - cwC) / 2);
    rects.push({ x: cx, y: P, w: cwC, h: H, __center: true });
    if (side) {
      const sw = Math.floor(cx - P - GAP);
      const leftN = Math.ceil(side / 2);
      const rightN = side - leftN;
      let li = 0;
      let ri = 0;
      for (let k = 0; k < side; k++) {
        if (k % 2 === 0 && li < leftN) {
          const lh = Math.floor((H - GAP * (leftN - 1)) / leftN);
          rects.push({ x: P, y: P + li * (lh + GAP), w: sw, h: lh }); li++;
        } else {
          const rn = Math.max(1, rightN);
          const rh = Math.floor((H - GAP * (rn - 1)) / rn);
          rects.push({ x: vw - P - sw, y: P + ri * (rh + GAP), w: sw, h: rh }); ri++;
        }
      }
    }
  } else {
    // single / fallback: maximize the front one
    rects.push({ x: P, y: P, w: vw - P * 2, h: H });
  }
  return rects;
}

export function applyLayout(kind: string): void {
  const wins = liveWindows();
  if (!wins.length) return;
  if (kind === "reader") {
    // put the reader (or front) in the center slot.
    const readerIdx = wins.findIndex((w) => w.id === "win:sys:reader");
    if (readerIdx > 0) { const rw = wins.splice(readerIdx, 1)[0]; if (rw) wins.unshift(rw); }
  }
  const rects = computeLayout(kind, wins.length);
  wins.forEach(function (w, i): void {
    const r = rects[Math.min(i, rects.length - 1)];
    if (r) placeWindow(w, r);
  });
  pokeLayout();
}

export function loadLayouts(): SavedLayout[] {
  try {
    const a = JSON.parse(localStorage.getItem(LAYOUTS_KEY) ?? "[]") as unknown;
    return Array.isArray(a) ? (a as SavedLayout[]) : [];
  } catch (_) { return []; }
}

function saveLayouts(a: SavedLayout[]): void {
  try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(a.slice(0, 6))); } catch (_) {}
}

export function captureSetup(name: string): void {
  const wins = liveWindows();
  const snap = wins.map(function (w): { id: string; glyph: string; geo: Geo } {
    const r = w.card.getBoundingClientRect();
    return { id: w.id, glyph: w.glyph, geo: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  const all = loadLayouts().filter((s) => s.name !== name);
  all.unshift({ name, ts: Date.now(), wins: snap });
  saveLayouts(all);
}

// Open a window by its WM id, routing through the right door.
function openWid(wid: string): void {
  try {
    if (wid === "win:sys:reader" || wid === "win:sys:library" || wid === "win:sys:oracle" || wid === "win:sys:marks") {
      const k = wid.split(":")[2];
      if (k && ww().codexDesk?.open) ww().codexDesk!.open(k);
    } else if (/^win:builtin:/.test(wid)) {
      if (ww().codexOpenPanel) ww().codexOpenPanel!(wid.replace("win:builtin:", ""));
    } else if (wid === "const") {
      if (ww().codexOpenConstellation) ww().codexOpenConstellation!();
    } else if (/^win:plugin:/.test(wid)) {
      // plugin windows: ask app.jsx to reopen via codexOpenWindow if possible
      if (ww().codexOpenWindow) ww().codexOpenWindow!({ id: wid.replace(/^win:/, "") });
    }
  } catch (_) {}
}

export function recallSetup(name: string): void {
  const setup = loadLayouts().find((s) => s.name === name);
  if (!setup) return;
  // open any missing windows first
  const have: Record<string, true> = {};
  liveWindows().forEach((w) => { have[w.id] = true; });
  setup.wins.forEach((s) => { if (!have[s.id]) openWid(s.id); });
  // apply geometry once windows have mounted (retry a few times).
  let tries = 0;
  const t = setInterval(function (): void {
    tries++;
    const idx: Record<string, DockEntry> = {};
    dockWins.forEach((w) => { if (w.backdrop.isConnected) idx[w.id] = w; });
    const allHere = setup.wins.every((s) => idx[s.id] !== undefined);
    if (allHere || tries > 16) {
      clearInterval(t);
      setup.wins.forEach(function (s): void {
        const w = idx[s.id];
        if (w) {
          if (w.backdrop.style.display === "none") w.backdrop.style.display = "";
          placeWindow(w, s.geo);
        }
      });
      pokeLayout();
    }
  }, 120);
}

function arrangeMenu(anchor: HTMLElement): void {
  const pop = dockPopOpen();
  pop.classList.add("cx-wm-arrangepop");
  const h = document.createElement("b");
  h.textContent = "⊞ ARRANGE — tile the open windows";
  pop.appendChild(h);
  const grid = document.createElement("div");
  grid.className = "cx-wm-arrange-grid";
  [
    { k: "halves", label: "Side by side", icon: '<rect x="2" y="3" width="6" height="12" rx="1"/><rect x="10" y="3" width="6" height="12" rx="1"/>' },
    { k: "thirds", label: "Thirds", icon: '<rect x="1.5" y="3" width="4.5" height="12" rx="1"/><rect x="6.75" y="3" width="4.5" height="12" rx="1"/><rect x="12" y="3" width="4.5" height="12" rx="1"/>' },
    { k: "quad", label: "Quad 2×2", icon: '<rect x="2" y="3" width="6" height="5.5" rx="1"/><rect x="10" y="3" width="6" height="5.5" rx="1"/><rect x="2" y="9.5" width="6" height="5.5" rx="1"/><rect x="10" y="9.5" width="6" height="5.5" rx="1"/>' },
    { k: "reader", label: "Reader-centered", icon: '<rect x="6" y="3" width="6" height="12" rx="1"/><rect x="1.5" y="4.5" width="3" height="9" rx="0.8"/><rect x="13.5" y="4.5" width="3" height="9" rx="0.8"/>' },
    { k: "single", label: "Maximize front", icon: '<rect x="2.5" y="3.5" width="13" height="11" rx="1.2"/>' },
  ].forEach(function (L) {
    const b = document.createElement("button");
    b.className = "cx-wm-arrange-opt";
    b.innerHTML = '<span class="cx-wm-arrange-ico">' + svg(L.icon) + "</span><span>" + L.label + "</span>";
    b.title = L.label;
    b.addEventListener("click", function (): void { applyLayout(L.k); dockPopClose(); });
    grid.appendChild(b);
  });
  pop.appendChild(grid);

  // ── Saved study setups ──
  const sh = document.createElement("b");
  sh.textContent = "SAVED STUDY SETUPS";
  sh.style.marginTop = "4px";
  pop.appendChild(sh);
  const layouts = loadLayouts();
  if (!layouts.length) {
    const none = document.createElement("span");
    none.textContent = "none yet — arrange your windows, then save below";
    pop.appendChild(none);
  }
  layouts.forEach(function (s) {
    const row = document.createElement("div");
    row.className = "cx-wm-setup-row";
    const open = document.createElement("button");
    open.className = "cx-wm-setup-open";
    open.innerHTML = "<i>" + chipGlyphHTML("arrange") + "</i><span>" + s.name + "</span><em>" + s.wins.length + " win</em>";
    open.title = "Recall " + s.name;
    open.addEventListener("click", function (): void { recallSetup(s.name); dockPopClose(); });
    const del = document.createElement("button");
    del.className = "cx-wm-setup-del";
    del.innerHTML = chipGlyphHTML("close");
    del.title = "Delete " + s.name;
    del.addEventListener("click", function (e: Event): void {
      e.stopPropagation();
      saveLayouts(loadLayouts().filter((x) => x.name !== s.name));
      row.remove();
    });
    row.appendChild(open); row.appendChild(del);
    pop.appendChild(row);
  });
  if (layouts.length < 6) {
    const save = document.createElement("button");
    save.className = "cx-wm-setup-save";
    save.innerHTML = "<i>+</i><span>Save current arrangement</span>";
    save.addEventListener("click", function (): void {
      const name = prompt("Name this study setup:", "Setup " + (loadLayouts().length + 1));
      if (name && name.trim()) { captureSetup(name.trim().slice(0, 24)); arrangeMenu(anchor); }
    });
    pop.appendChild(save);
  }
}

// ── Dock chip builder ─────────────────────────────────────────────────────────
function dockChip(
  cls: string,
  glyph: string,
  label: string,
  title: string,
  run: (chip: HTMLButtonElement) => void,
  iconId?: string,
): HTMLButtonElement {
  const chip = document.createElement("button");
  chip.className = cls;
  const gid = iconId ?? glyph;
  chip.innerHTML = "<i>" + chipGlyphHTML(gid, glyph) + "</i><span>" + label + "</span>";
  chip.title = title;                       // native tooltip (delayed)
  chip.setAttribute("data-tip", title);     // instant tooltip (CSS)
  chip.setAttribute("aria-label", title);
  chip.addEventListener("click", function (): void { try { run(chip); } catch (_) {} });
  return chip;
}

function dockSep(): HTMLSpanElement {
  const div = document.createElement("span");
  div.className = "cx-wm-dock-sep";
  div.setAttribute("aria-hidden", "true");
  div.style.cssText = "align-self:stretch;width:1px;margin:4px 4px;background:currentColor;opacity:.18;";
  return div;
}

function dockActionChips(el: HTMLElement): void {
  const now = dockNow();
  const trailRef = dockTrailRef();
  const ACT = "cx-wm-dock-chip cx-wm-dock-launch cx-wm-dock-act";
  const ds = (ww().codexDesk?.on?.() ? ww().codexDesk!.state() : null);
  const openPanels: string[] = (ww().codexDeskPanels?.on?.() ? ww().codexDeskPanels!.list() : []);
  const BUILTIN_CHIPS = ["trans", "talmud", "comm", "gem", "gnosis", "disarm", "exeg", "txan"];
  dockPins().forEach(function (id): void {
    const c = DOCK_REG.find((r) => r.id === id);
    if (!c) return;
    let cls = ACT + (c.id === "reader" ? " cx-wm-dock-reader" : "");
    if (ds && (c.id === "reader" || c.id === "library" || c.id === "oracle" || c.id === "marks") && ds[c.id]) {
      cls += " is-open"; // already on the desk — chip shows it lit
    }
    if (BUILTIN_CHIPS.indexOf(c.id) >= 0 && openPanels.indexOf(c.id) >= 0) {
      cls += " is-open"; // that panel's window is on the desk
    }
    const ref = (now && now.ref) || trailRef;
    const title = c.title + (ref && (c.id === "sword" || c.id === "mirror" || c.id === "map") ? " — " + ref : "");
    const chip = dockChip(cls, c.glyph, c.label, title, function (): void { c.run(chip); }, c.id);
    chip.setAttribute("data-dock-id", c.id);
    makeChipReorderable(chip, c.id);
    el.appendChild(chip);
  });
  if (trailRef) {
    el.appendChild(dockChip(ACT + " cx-wm-dock-continue", "⟳", "CONTINUE", "Continue — " + trailRef, function (): void {
      const r = dockTrailRef();
      if (r && typeof ww().codexJumpToRef === "function") {
        try { ww().codexJumpToRef!(r); } catch (_) {}
      }
    }, "continue"));
  }
  // ⊞ ARRANGE — one-tap layouts + saved study setups over the open windows.
  el.appendChild(dockChip(ACT + " cx-wm-dock-arrange", "⊞", "", "Arrange the open windows — layouts & saved setups",
    function (anchor: HTMLButtonElement): void { arrangeMenu(anchor); }, "arrange"));
  // the customizer — the dock is the user's
  el.appendChild(dockChip(ACT + " cx-wm-dock-edit", "✎", "", "Customize the dock", function (): void { dockEditMenu(); }, "edit"));
}

// ── First-ever desk boot wink ─────────────────────────────────────────────────
// The chips breathe once — a single ~2s glow sweep. A wink, not a tutorial.
// Persisted so it happens exactly once per profile; reduced-motion users get
// nothing (the keyframe is disabled in CSS).
const WINK_KEY = "codex.dock.winked.v1";

function maybeWink(el: HTMLElement): void {
  try {
    if (localStorage.getItem(WINK_KEY)) return;
    localStorage.setItem(WINK_KEY, "1");
  } catch (_) { return; }
  setTimeout(function (): void {
    if (!el.isConnected) return;
    el.classList.add("cx-wm-wink");
    setTimeout(function (): void { el.classList.remove("cx-wm-wink"); }, 2600);
  }, 700);
}

// ── Dock render ───────────────────────────────────────────────────────────────
export function dockRender(): void {
  dockWins = dockWins.filter((w) => w.backdrop.isConnected);
  const launcher = os7on() && active();
  if (!dockWins.length && !launcher) { if (dockEl) { dockEl.remove(); dockEl = null; } return; }
  if (!dockEl || !dockEl.isConnected) {
    dockEl = document.createElement("div");
    dockEl.className = "cx-wm-dock";
    dockEl.setAttribute("role", "toolbar");
    dockEl.setAttribute("aria-label", "Open windows");
    document.body.appendChild(dockEl);
    maybeWink(dockEl);
  }
  dockEl.textContent = "";
  if (launcher) {
    dockActionChips(dockEl);
    if (dockWins.length) dockEl.appendChild(dockSep());
  }
  dockWins.forEach(function (w): void {
    const chip = document.createElement("button");
    const minimized = w.backdrop.style.display === "none";
    const focused = w.card.classList.contains("cx-wm-focus");
    chip.className = "cx-wm-dock-chip cx-wm-dock-running" + (minimized ? " is-min" : "") + (focused && !minimized ? " is-focus" : "");
    const label = String(w.label || w.id).toUpperCase().slice(0, 12);
    const iconId = w.iconId || w.id;
    chip.innerHTML = "<i>" + chipGlyphHTML(iconId, w.glyph || DOCK_GLYPH[w.id] || "▣") + "</i><span>" + label + "</span>";
    const tip = minimized ? "Restore " + label : (focused ? "Minimize " + label : "Focus " + label);
    chip.title = tip;
    chip.setAttribute("data-tip", tip);
    chip.setAttribute("aria-label", tip);
    chip.addEventListener("click", function (): void {
      if (w.backdrop.style.display === "none") {
        w.backdrop.style.display = "";
        w.front();
      } else if (w.card.classList.contains("cx-wm-focus")) {
        w.backdrop.style.display = "none";
      } else {
        w.front();
      }
      dockRender();
    });
    // right-click / long-press → LIVE PREVIEW CARD of the actual window.
    chip.addEventListener("contextmenu", function (e: Event): void { e.preventDefault(); previewCard(chip, w); });
    attachLongPress(chip, function (): void { previewCard(chip, w); });
    dockEl!.appendChild(chip);
  });
}

// ── LIVE PREVIEW CARD ────────────────────────────────────────────────────────
// Right-click / long-press a running-window chip → a hovering card with
// the window's title, its bound ref/context, a scaled CSS-transform
// SNAPSHOT of the real window node, and actions (focus · minimize · close ·
// pop-out). The snapshot is a clone of the live card scaled to fit.
let previewEl: HTMLElement | null = null;

function previewClose(): void { if (previewEl) { previewEl.remove(); previewEl = null; } }

function previewCard(anchor: HTMLElement, w: DockEntry): void {
  previewClose();
  const card = w.card;
  const ctx = card.querySelector<HTMLElement>(".cx-win-h-ctx")?.textContent ?? "";
  const title = String(w.label || w.id);
  const box = document.createElement("div");
  box.className = "cx-wm-prevcard";
  const head = document.createElement("div");
  head.className = "cx-wm-prevcard-h";
  head.innerHTML = "<b>" + title.toUpperCase() + "</b>" + (ctx ? "<span>" + ctx + "</span>" : "");
  box.appendChild(head);
  // scaled snapshot
  const stage = document.createElement("div");
  stage.className = "cx-wm-prevcard-stage";
  const r = card.getBoundingClientRect();
  const SW = 230;
  const scale = Math.min(SW / Math.max(1, r.width), 1);
  const shotH = Math.min(160, Math.max(80, Math.round(r.height * scale)));
  stage.style.height = shotH + "px";
  const clone = card.cloneNode(true) as HTMLElement;
  // strip WM-owned chrome that would look odd in a thumbnail
  Array.from(clone.querySelectorAll(".cx-wm-rs, .cx-wm-ctl")).forEach((n) => { n.remove(); });
  clone.style.cssText = "position:absolute;left:0;top:0;margin:0;transform:scale(" + scale + ");transform-origin:top left;width:" + Math.round(r.width) + "px;height:" + Math.round(r.height) + "px;pointer-events:none;box-shadow:none;border-radius:0;";
  clone.classList.remove("cx-wm-focus");
  stage.appendChild(clone);
  box.appendChild(stage);
  // actions
  const acts = document.createElement("div");
  acts.className = "cx-wm-prevcard-acts";
  function act(label: string, iconId: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.innerHTML = "<i>" + chipGlyphHTML(iconId) + "</i><span>" + label + "</span>";
    b.title = label; b.setAttribute("aria-label", label);
    b.addEventListener("click", function (): void { try { fn(); } catch (_) {} previewClose(); });
    return b;
  }
  acts.appendChild(act("Focus", "oracle", function (): void { w.backdrop.style.display = ""; w.front(); dockRender(); }));
  acts.appendChild(act("Min", "min", function (): void { w.backdrop.style.display = "none"; dockRender(); }));
  const disp = ww().codexDisplays;
  const surf = disp?.surfaceForWid?.(w.id);
  if (surf) acts.appendChild(act("Pop-out", "popout", function (): void { ww().codexDisplays!.open(surf); }));
  acts.appendChild(act("Close", "close", function (): void { wmCloseWindow(w); }));
  box.appendChild(acts);
  document.body.appendChild(box);
  // position above the chip, clamped to viewport
  const ab = anchor.getBoundingClientRect();
  const bw = box.getBoundingClientRect();
  let x = Math.round(ab.left + ab.width / 2 - bw.width / 2);
  x = Math.max(8, Math.min(x, window.innerWidth - bw.width - 8));
  let y = Math.round(ab.top - bw.height - 10);
  if (y < 8) y = Math.round(ab.bottom + 10);
  box.style.left = x + "px";
  box.style.top = y + "px";
  setTimeout(function (): void {
    const away = function (e: Event): void {
      if (previewEl && e.target instanceof Node && !previewEl.contains(e.target) && e.target !== anchor) {
        previewClose();
        document.removeEventListener("pointerdown", away, true);
      }
    };
    document.addEventListener("pointerdown", away, true);
  }, 0);
  previewEl = box;
}

// ── Long-press helper (touch / pen) ──────────────────────────────────────────
// fires fn after 480ms of a still press.
function attachLongPress(el: HTMLElement, fn: () => void): void {
  let t = 0;
  let sx = 0;
  let sy = 0;
  el.addEventListener("pointerdown", function (e: PointerEvent): void {
    if (e.pointerType === "mouse") return; // mouse uses contextmenu
    sx = e.clientX; sy = e.clientY;
    t = window.setTimeout(fn, 480);
  });
  const cancel = function (e?: PointerEvent): void {
    if (e && (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8)) {
      clearTimeout(t);
    } else if (!e) {
      clearTimeout(t);
    }
  };
  el.addEventListener("pointermove", cancel);
  el.addEventListener("pointerup", function (): void { clearTimeout(t); });
  el.addEventListener("pointercancel", function (): void { clearTimeout(t); });
}

// ── Close a running window ────────────────────────────────────────────────────
// Click the console/window's × so React unmounts it. The WM never owns lifecycle.
function wmCloseWindow(w: DockEntry): void {
  const x = w.card.querySelector<HTMLElement>(
    ".cx-win-x, .cx-mirror-x, .cx-map-x, .cx-art-x, .cx-cmp-x, .cx-sword-x, .cx-ops-x, .cx-const-x, [data-cx-close]",
  );
  if (x) { x.click(); return; }
  // last resort: hide the backdrop (keeps the contract: never unmount).
  w.backdrop.style.display = "none";
  dockRender();
}

// ── WM core constants ─────────────────────────────────────────────────────────
let zTop = 9500;          // shared z ladder across all WM windows
const SNAP = 14;          // px from a viewport edge that arms snapping
const PAD = 8;            // viewport padding for clamps
let snapPreview: HTMLElement | null = null; // shared snap-preview element
let resizeTimer = 0;

// ── Geometry persistence ──────────────────────────────────────────────────────
function geoKey(id: string): string { return "cx-wm-geo:" + id; }

export function loadGeo(id: string): Geo | null {
  try { return JSON.parse(localStorage.getItem(geoKey(id)) ?? "null") as Geo | null; } catch (_) { return null; }
}

function saveGeo(id: string, g: Geo): void {
  try { localStorage.setItem(geoKey(id), JSON.stringify(g)); } catch (_) {}
}

export function clampGeo(g: Geo, min: readonly [number, number]): Geo {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(min[0], Math.min(g.w, vw - PAD * 2));
  const h = Math.max(min[1], Math.min(g.h, vh - PAD * 2));
  const x = Math.max(PAD - w + 120, Math.min(g.x, vw - 120)); // keep ≥120px of header reachable
  const y = Math.max(PAD, Math.min(g.y, vh - 48));
  return { x, y, w, h };
}

// ── Poke layout ───────────────────────────────────────────────────────────────
// Leaflet + the mirror cascade canvas both relayout on window resize; fire
// one (debounced) after geometry changes so content tracks the frame.
function pokeLayout(): void {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(function (): void {
    try { window.dispatchEvent(new Event("resize")); } catch (_) {}
  }, 120);
}

// ── Snap preview ─────────────────────────────────────────────────────────────
function ensurePreview(): HTMLElement {
  if (snapPreview && snapPreview.isConnected) return snapPreview;
  snapPreview = document.createElement("div");
  snapPreview.className = "cx-wm-preview";
  snapPreview.style.display = "none";
  document.body.appendChild(snapPreview);
  return snapPreview;
}

function showPreview(x: number, y: number, w: number, h: number): void {
  const p = ensurePreview();
  p.style.display = "block";
  p.style.left = x + "px"; p.style.top = y + "px";
  p.style.width = w + "px"; p.style.height = h + "px";
}

function hidePreview(): void { if (snapPreview) snapPreview.style.display = "none"; }

interface SnapZone { kind: "max" | "left" | "right"; x: number; y: number; w: number; h: number }

function snapZone(cx: number, cy: number): SnapZone | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (cy <= SNAP) return { kind: "max", x: PAD, y: PAD, w: vw - PAD * 2, h: vh - PAD * 2 };
  if (cx <= SNAP) return { kind: "left", x: PAD, y: PAD, w: Math.floor(vw / 2) - PAD - 4, h: vh - PAD * 2 };
  if (cx >= vw - SNAP) {
    const w = Math.floor(vw / 2) - PAD - 4;
    return { kind: "right", x: vw - PAD - w, y: PAD, w, h: vh - PAD * 2 };
  }
  return null;
}

// ── Per-element metadata (replaces inline __cxwm / __cxwmCleanup props) ──────
let ENHANCED = new WeakSet<HTMLElement>();
let CLEANUP_MAP = new WeakMap<HTMLElement, () => void>();

// ── enhance — turns a backdrop+card into a real workspace window ──────────────
export function enhance(backdrop: HTMLElement, spec: WinSpec): void {
  if (ENHANCED.has(backdrop) || !active()) return;
  const cardOrNull = backdrop.querySelector<HTMLElement>(spec.card);
  if (!cardOrNull) return;
  // NOTE: preserved from legacy — `card` is never reassigned after this
  // guard (mirrors `var card = ...; if (!card) return;` in legacy/wm.js),
  // so it's safe for the rest of the function, including nested closures
  // (drag/resize/timeout handlers) that run later. Rebinding to an
  // explicitly non-null type here (rather than 11 scattered `card!`
  // assertions) is the single guard TS's closure narrowing can't infer on
  // its own — it does not change which object `card` refers to.
  const card: HTMLElement = cardOrNull;
  ENHANCED.add(backdrop);

  const head = card.querySelector<HTMLElement>(spec.head);
  // v8 MONAD: generic windows carry their instance identity on the
  // backdrop (data-wm-id) so each persists its own geometry + dock chip;
  // classic consoles fall through to the spec id unchanged.
  const wid = backdrop.getAttribute("data-wm-id") ?? spec.id;
  const wglyph = backdrop.getAttribute("data-wm-glyph") ?? DOCK_GLYPH[spec.id] ?? "▣";
  const state = {
    id: wid,
    min: spec.min,
    maximized: false,
    restore: null as Geo | null,
    geo: { x: 0, y: 0, w: 0, h: 0 } as Geo, // set immediately by apply() below
  };

  // Measure the natural (CSS-centered) rect BEFORE window-mode classes
  // change the card's positioning — this is the first-open geometry.
  const rect = card.getBoundingClientRect();

  backdrop.classList.add("cx-wm-backdrop");
  card.classList.add("cx-wm-win");
  if (head) {
    head.classList.add("cx-wm-head");
    if (!head.title) {
      head.title = "Drag to move · double-click to maximize · drag to a screen edge to snap";
    }
  }

  // ── v11.5 HEADER CONTROLS — inject a minimize · arrange · pop-out
  // cluster into EVERY window header (consoles get it too, since this runs
  // in enhance() not in any one component's JSX). Idempotent. The cluster
  // sits just before the card's own × so close stays where users expect.
  if (head && !head.querySelector(".cx-wm-ctl")) {
    const ctl = document.createElement("div");
    ctl.className = "cx-wm-ctl";
    ctl.setAttribute("aria-hidden", "false");

    function ctlBtn(cls: string, iconId: string, tip: string, fn: () => void): HTMLButtonElement {
      const b = document.createElement("button");
      b.className = "cx-wm-ctl-btn " + cls;
      b.type = "button";
      b.innerHTML = chipGlyphHTML(iconId);
      b.title = tip; b.setAttribute("aria-label", tip); b.setAttribute("data-tip", tip);
      b.addEventListener("click", function (e: Event): void { e.stopPropagation(); try { fn(); } catch (_) {} });
      // never let the head's drag detector see these as drag starts
      b.addEventListener("pointerdown", function (e: Event): void { e.stopPropagation(); });
      return b;
    }

    ctl.appendChild(ctlBtn("cx-wm-ctl-arrange", "arrange", "Arrange windows", function (): void { arrangeMenu(ctl); }));
    const disp = ww().codexDisplays;
    const surf = disp?.surfaceForWid?.(wid);
    if (surf) {
      ctl.appendChild(ctlBtn("cx-wm-ctl-pop", "popout", "Pop out to another monitor", function (): void {
        ww().codexDisplays!.open(surf);
      }));
    }
    ctl.appendChild(ctlBtn("cx-wm-ctl-min", "min", "Minimize — restore from the dock", function (): void {
      backdrop.style.display = "none";
      dockRender();
    }));
    // Find the card's own close button and slot the cluster just before it
    // so order reads: …arrange pop-out minimize × .
    const closeBtn = head.querySelector<HTMLElement>(
      ".cx-win-x, .cx-mirror-x, .cx-map-x, .cx-art-x, .cx-cmp-x, .cx-sword-x, .cx-ops-x, .cx-const-x",
    );
    if (closeBtn && closeBtn.parentNode === head) head.insertBefore(ctl, closeBtn);
    else head.appendChild(ctl);
  }

  function apply(g: Geo): void {
    card.style.left = g.x + "px";
    card.style.top = g.y + "px";
    card.style.width = g.w + "px";
    card.style.height = g.h + "px";
    state.geo = g;
  }

  function front(): void {
    zTop += 1;
    backdrop.style.zIndex = String(zTop);
    Array.from(document.querySelectorAll<HTMLElement>(".cx-wm-win.cx-wm-focus"))
      .forEach((el) => { el.classList.remove("cx-wm-focus"); });
    card.classList.add("cx-wm-focus");
  }

  // ── Initial geometry: saved → clamped; else derive from the card's
  //    natural (CSS-centered) rect so the first open looks identical.
  const saved = loadGeo(wid);
  const geo = saved
    ? clampGeo({ x: saved.x, y: saved.y, w: saved.w, h: saved.h }, spec.min)
    : clampGeo({ x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }, spec.min);
  apply(geo);
  front();

  card.addEventListener("pointerdown", front, true);

  // ── Drag ──────────────────────────────────────────────────────────────────
  interface DragState { px: number; py: number; gx: number; gy: number; cx: number; cy: number; moved?: boolean }
  let drag: DragState | null = null;
  let raf = 0;

  function onDragMove(e: PointerEvent): void {
    if (!drag) return;
    drag.cx = e.clientX; drag.cy = e.clientY;
    // A click is not a drag — require real movement before geometry moves.
    // (Otherwise a double-click's down/up cycle corrupts maximize state.)
    if (!drag.moved && Math.abs(drag.cx - drag.px) + Math.abs(drag.cy - drag.py) < 4) return;
    drag.moved = true;
    if (!raf) raf = requestAnimationFrame(function (): void {
      raf = 0;
      if (!drag) return;
      const g = clampGeo({ x: drag.gx + drag.cx - drag.px, y: drag.gy + drag.cy - drag.py, w: state.geo.w, h: state.geo.h }, state.min);
      apply(g);
      const z = snapZone(drag.cx, drag.cy);
      if (z) showPreview(z.x, z.y, z.w, z.h); else hidePreview();
    });
  }

  function onDragEnd(e: PointerEvent): void {
    if (!drag) return;
    const moved = drag.moved;
    card.classList.remove("cx-wm-dragging");
    hidePreview();
    if (!moved) {
      drag = null;
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
      return;
    }
    const z = snapZone(e.clientX, e.clientY);
    if (z) {
      state.restore = { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h };
      state.maximized = (z.kind === "max");
      card.classList.add("cx-wm-snapping");
      apply({ x: z.x, y: z.y, w: z.w, h: z.h });
      setTimeout(function (): void { card.classList.remove("cx-wm-snapping"); }, 220);
    } else {
      state.maximized = false;
    }
    saveGeo(wid, state.geo);
    pokeLayout();
    drag = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  }

  let lastDown = 0;
  let lastDownX = 0;
  let lastDownY = 0;

  if (head) {
    head.addEventListener("pointerdown", function (e: PointerEvent): void {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement | null)?.closest("button, a, input, select, textarea, [role='button']")) return;
      // Manual double-press detection — robust regardless of whether the
      // browser synthesizes a dblclick from this pointer sequence.
      const now = Date.now();
      if (now - lastDown < 400 && Math.abs(e.clientX - lastDownX) < 6 && Math.abs(e.clientY - lastDownY) < 6) {
        lastDown = 0;
        toggleMax();
        return;
      }
      lastDown = now; lastDownX = e.clientX; lastDownY = e.clientY;
      // No preventDefault here — cancelling pointerdown would suppress the
      // compatibility mouse events and kill dblclick-to-maximize. The head
      // already has user-select:none / touch-action:none in CSS.
      drag = { px: e.clientX, py: e.clientY, gx: state.geo.x, gy: state.geo.y, cx: e.clientX, cy: e.clientY };
      card.classList.add("cx-wm-dragging");
      front();
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
    });
  }

  function toggleMax(): void {
    card.classList.add("cx-wm-snapping");
    if (state.maximized && state.restore) {
      apply(clampGeo(state.restore, state.min));
      state.maximized = false;
    } else {
      state.restore = { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h };
      apply({ x: PAD, y: PAD, w: window.innerWidth - PAD * 2, h: window.innerHeight - PAD * 2 });
      state.maximized = true;
    }
    setTimeout(function (): void { card.classList.remove("cx-wm-snapping"); }, 220);
    saveGeo(wid, state.geo);
    pokeLayout();
  }

  // ── Resize — 8 handles ────────────────────────────────────────────────────
  const DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
  DIRS.forEach(function (dir): void {
    const handle = document.createElement("div");
    handle.className = "cx-wm-rs cx-wm-rs-" + dir;
    handle.setAttribute("aria-hidden", "true");
    card.appendChild(handle);

    interface ResizeState { px: number; py: number; g: Geo; cx: number; cy: number }
    let rs: ResizeState | null = null;
    let rraf = 0;

    function onMove(e: PointerEvent): void {
      if (!rs) return;
      rs.cx = e.clientX; rs.cy = e.clientY;
      if (!rraf) rraf = requestAnimationFrame(function (): void {
        rraf = 0;
        if (!rs) return;
        const dx = rs.cx - rs.px;
        const dy = rs.cy - rs.py;
        const g: Geo = { x: rs.g.x, y: rs.g.y, w: rs.g.w, h: rs.g.h };
        if (dir.indexOf("e") >= 0) g.w = rs.g.w + dx;
        if (dir.indexOf("s") >= 0) g.h = rs.g.h + dy;
        if (dir.indexOf("w") >= 0) { g.w = rs.g.w - dx; g.x = rs.g.x + dx; }
        if (dir.indexOf("n") >= 0) { g.h = rs.g.h - dy; g.y = rs.g.y + dy; }
        if (g.w < state.min[0]) { if (dir.indexOf("w") >= 0) g.x -= (state.min[0] - g.w); g.w = state.min[0]; }
        if (g.h < state.min[1]) { if (dir.indexOf("n") >= 0) g.y -= (state.min[1] - g.h); g.h = state.min[1]; }
        apply(clampGeo(g, state.min));
      });
    }

    function onUp(): void {
      if (!rs) return;
      rs = null;
      card.classList.remove("cx-wm-resizing");
      state.maximized = false;
      saveGeo(wid, state.geo);
      pokeLayout();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    handle.addEventListener("pointerdown", function (e: PointerEvent): void {
      if (e.button !== 0) return;
      rs = { px: e.clientX, py: e.clientY, g: { x: state.geo.x, y: state.geo.y, w: state.geo.w, h: state.geo.h }, cx: e.clientX, cy: e.clientY };
      card.classList.add("cx-wm-resizing");
      front();
      e.preventDefault();
      e.stopPropagation();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  });

  // ── Keep windows on-screen when the viewport shrinks ──────────────────────
  const onWinResize = function (): void {
    if (!card.isConnected) { window.removeEventListener("resize", onWinResize); return; }
    if (state.maximized) {
      apply({ x: PAD, y: PAD, w: window.innerWidth - PAD * 2, h: window.innerHeight - PAD * 2 });
    } else {
      apply(clampGeo(state.geo, state.min));
    }
  };
  window.addEventListener("resize", onWinResize);

  // Resolve a line-icon id for this window so the dock chip + preview wear
  // the same elegant glyph language: console → spec.id; desk window →
  // sys:<k>; builtin panel → its id; else fall back to the unicode glyph.
  let iconId = spec.id;
  const bm = /^win:sys:(\w+)$/.exec(wid);
  if (bm) { const g = bm[1]; if (g) iconId = g; }
  const pm = /^win:builtin:(\w+)$/.exec(wid);
  if (pm) { const g = pm[1]; if (g) iconId = g; }

  // setGeo lets the arrange engine drive geometry through the window's own
  // state (so a later drag/resize/maximize starts from the right place).
  const setGeo = function (g: Geo): void {
    state.geo = { x: g.x, y: g.y, w: g.w, h: g.h };
    state.maximized = false;
    saveGeo(wid, state.geo);
  };

  // Register with the dock; chips re-render on focus so the active chip
  // tracks the focused window.
  const dockEntry: DockEntry = {
    key: wid + ":" + Date.now(),
    id: wid,
    glyph: wglyph,
    iconId,
    min: spec.min,
    setGeo,
    backdrop,
    card,
    front,
    label: backdrop.querySelector<HTMLElement>(".cx-win-h-title")?.textContent ?? wid.replace(/^win:plugin:[^:]+:/, ""),
  };
  dockWins.push(dockEntry);
  card.addEventListener("pointerdown", function (): void { dockRender(); }, true);
  dockRender();

  CLEANUP_MAP.set(backdrop, function (): void {
    window.removeEventListener("resize", onWinResize);
    saveGeo(wid, state.geo);
    dockWins = dockWins.filter((w) => w !== dockEntry);
    dockRender();
  });
}

// ── scan — walk a newly-added subtree for known backdrop classes ──────────────
export function scan(root: Element | HTMLElement): void {
  if (!active()) return;
  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    if (!spec) continue; // NOTE: preserved from legacy — guard for noUncheckedIndexedAccess
    const nodes: HTMLElement[] =
      (root instanceof HTMLElement && root.classList.contains(spec.backdrop))
        ? [root]
        : Array.from(root.querySelectorAll<HTMLElement>("." + spec.backdrop));
    for (const node of nodes) enhance(node, spec);
  }
}

// ── MutationObserver ──────────────────────────────────────────────────────────
let mo: MutationObserver | null = null;
// Debounce timer for codex:now dock re-render.
let dockNowTimer = 0;

export function boot(): void {
  try {
    if (!mo) {
      mo = new MutationObserver(function (muts: MutationRecord[]): void {
        muts.forEach(function (m): void {
          m.addedNodes.forEach(function (n): void {
            if (n instanceof HTMLElement) scan(n);
          });
          m.removedNodes.forEach(function (n): void {
            if (n instanceof HTMLElement) {
              const cleanup = CLEANUP_MAP.get(n);
              if (cleanup) cleanup();
            }
          });
        });
      });
    }
    mo.observe(document.body, { childList: true, subtree: true });
    scan(document.body);
    dockRender();
  } catch (_) {}
}

// ── Test utilities ────────────────────────────────────────────────────────────
/** Resets all mutable module state to initial values. For use in tests only. */
export function _resetForTest(): void {
  if (mo) {
    try { mo.disconnect(); } catch (_) {}
    mo = null;
  }
  if (dockEl?.isConnected) dockEl.remove();
  dockEl = null;
  dockWins = [];
  if (dockPop?.isConnected) dockPop.remove();
  dockPop = null;
  if (previewEl?.isConnected) previewEl.remove();
  previewEl = null;
  if (snapPreview?.isConnected) snapPreview.remove();
  snapPreview = null;
  zTop = 9500;
  resizeTimer = 0;
  dockNowTimer = 0;
  ENHANCED = new WeakSet<HTMLElement>();
  CLEANUP_MAP = new WeakMap<HTMLElement, () => void>();
  // Re-evaluate matchMedia in case tests stub it after module load.
  try {
    MQ = window.matchMedia("(min-width: 881px) and (pointer: fine)");
  } catch (_) {
    MQ = null;
  }
}

// Export dockNowTimer so index.ts can manage the event listener lifecycle.
export { dockNowTimer as _dockNowTimer };
