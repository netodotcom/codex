// displays — multi-display routing logic (faithful port from legacy/displays.js).
//
// Any surface of CODEX can be thrown onto another monitor as its own browser
// window. Every window shares ONE reading cursor via BroadcastChannel.
//
//   ?surface=<s>  — boots the window focused on that surface.
//   &follow=1     — marks the window a FOLLOWER.

import type { SurfaceKey, SurfaceDescriptor, CodexDisplaysApi } from "./types.js";
import { dw } from "./displays-window.js";

// ── Surface registry ──────────────────────────────────────────────────────────

// Each builtin panel that lives in its own window gets a satellite surface too —
// ?surface=trans opens a window with only the TRANSLATIONS instrument on the
// second monitor. The surface key is just the panel id.
function panelSurface(id: string, label: string): SurfaceDescriptor {
  return {
    label,
    open() { dw().codexOpenPanel?.(id); },
  };
}

export const SURFACES: Record<SurfaceKey, SurfaceDescriptor> = {
  reader:  { label: "Reader",  open() { dw().codexDesk?.open?.("reader"); } },
  library: { label: "Library", open() { dw().codexDesk?.open?.("library"); } },
  oracle:  { label: "Oracle",  open() { dw().codexDesk?.open?.("oracle"); } },
  marks:   { label: "Marks",   open() { dw().codexDesk?.open?.("marks"); } },
  galaxy:  { label: "Galaxy",  open() { dw().codexOpenConstellation?.(); } },
  // v11.5 — every builtin panel can ride its own monitor.
  trans:   panelSurface("trans",  "Translations"),
  talmud:  panelSurface("talmud", "Talmud"),
  comm:    panelSurface("comm",   "Commentary"),
  gem:     panelSurface("gem",    "Gematria"),
  gnosis:  panelSurface("gnosis", "Gnosis"),
  disarm:  panelSurface("disarm", "Disarm"),
  exeg:    panelSurface("exeg",   "Exegesis"),
  txan:    panelSurface("txan",   "Words"),
};

// ── WM window-id → surface key ────────────────────────────────────────────────

// wm.js asks "which surface (if any) can pop this window id onto another
// monitor?" — it owns the header ⧉ button, this owns the surface routing.
// Map the WM's window ids (data-wm-id / console spec id) → surface key.
const WID_MAP: Record<string, SurfaceKey> = {
  "win:sys:reader":  "reader",
  "win:sys:library": "library",
  "win:sys:oracle":  "oracle",
  "win:sys:marks":   "marks",
  "const":           "galaxy",
};

export function surfaceForWid(wid: string | null | undefined): string | null {
  if (!wid) return null;
  if (Object.prototype.hasOwnProperty.call(WID_MAP, wid)) {
    return WID_MAP[wid] ?? null;
  }
  // builtin panels: win:builtin:<id> → that panel's surface key.
  const m = /^win:builtin:(.+)$/.exec(wid);
  if (m !== null) {
    const panelId = m[1];
    if (panelId !== undefined && Object.prototype.hasOwnProperty.call(SURFACES, panelId)) {
      return panelId;
    }
  }
  return null;
}

// ── URL param parsing ─────────────────────────────────────────────────────────

export interface DisplayParams {
  surface: string | null;
  follow: boolean;
}

export function parseDisplayParams(params: URLSearchParams): DisplayParams {
  const surface = params.get("surface");
  // NOTE: preserved from legacy — FOLLOW is true whenever ?follow=1 OR any ?surface= is present.
  const follow = params.get("follow") === "1" || surface !== null;
  return { surface, follow };
}

// ── Shared cursor bus (BroadcastChannel) ──────────────────────────────────────

function currentRef(): string | null {
  const n = dw().CODEX_NOW;
  return n !== undefined && n.ref !== undefined ? String(n.ref) : null;
}

export function installChannelSync(): void {
  let chan: BroadcastChannel | null = null;
  // NOTE: preserved from legacy — BroadcastChannel creation wrapped in try/catch
  // (unavailable in some embedded environments).
  try { chan = new BroadcastChannel("codex-displays"); } catch { /* unavailable */ }
  let applying = false;

  window.addEventListener("codex:now", () => {
    if (chan === null || applying) return;
    const ref = currentRef();
    if (ref !== null) {
      try { chan.postMessage({ kind: "now", ref }); } catch { /* ignore */ }
    }
  });

  if (chan !== null) {
    chan.onmessage = (e: MessageEvent<unknown>) => {
      const msg = e.data;
      if (msg === null || typeof msg !== "object") return;
      const data = msg as Record<string, unknown>;
      if (data["kind"] !== "now" || !data["ref"]) return;
      const ref = String(data["ref"]);
      if (ref === currentRef()) return;  // echo guard
      const jumpFn = dw().codexJumpToRef;
      if (jumpFn === undefined) return;
      applying = true;
      try { jumpFn(ref); } catch { /* ignore */ }
      // release after the resulting codex:now has fired
      setTimeout(() => { applying = false; }, 150);
    };
  }
}

// ── Boot a ?surface= window into its single-surface arrangement ───────────────

export function bootSurface(surface: string): void {
  const descriptor = SURFACES[surface as SurfaceKey];
  if (descriptor === undefined) return;

  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const ready = dw().__CODEX_READY__ === true;
    if (!ready && tries < 120) return;
    clearInterval(t);
    if (!ready) return;
    try {
      document.body.classList.add("cx-display-" + surface);
      const d = dw().codexDesk;
      if (d !== undefined && typeof d.on === "function" && d.on()) {
        // NOTE: preserved from legacy — state() is accessed without an explicit
        // guard after on() returns true. In the real app, on() == true implies
        // state() is present; the outer try/catch swallows any TypeError otherwise.
        const state = d.state?.() ?? {};
        if (surface !== "reader" && state["reader"] && surface !== "galaxy") {
          // a satellite shows ONLY its surface — close reader on non-reader satellites.
          d.close?.("reader");
        }
        for (const k of ["library", "oracle", "marks"] as const) {
          if (k !== surface && state[k]) {
            d.close?.(k);
          }
        }
      }
      descriptor.open();
      try { document.title = "CODEX · " + descriptor.label.toUpperCase(); } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, 250);
}

// ── Public API factory ────────────────────────────────────────────────────────

export function buildDisplaysApi(params: DisplayParams): CodexDisplaysApi {
  const { surface, follow } = params;
  return {
    surfaces: Object.keys(SURFACES),
    surfaceForWid,
    isFollower: () => follow,
    surface: () => surface,
    open(s: string): boolean {
      if (!Object.prototype.hasOwnProperty.call(SURFACES, s)) return false;
      const url =
        window.location.pathname +
        "?surface=" + encodeURIComponent(s) +
        "&follow=1";
      // NOTE: preserved from legacy — || fallback (not ??) to coerce 0 → 1280/900.
      const w = Math.min(1280, window.screen.availWidth || 1280);
      const h = Math.min(900, window.screen.availHeight || 900);
      try {
        window.open(url, "codex-display-" + s, "popup=yes,width=" + w + ",height=" + h);
        return true;
      } catch { return false; }
    },
  };
}
