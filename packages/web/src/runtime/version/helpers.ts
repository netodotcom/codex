// version — data constant and load-time side-effect helpers.
// Faithful port of the two IIFEs in legacy/version.js (zero behaviour change).
import type { CodexVersion } from "./types.js";
import { vw } from "./version-window.js";

// ── Version data ──────────────────────────────────────────────────────────────
// ⚠️ BOUND TO sw.js: the SW cannot importScripts this file without adding a
// network/cache dependency to its own parse, so sw.js mirrors `sw` below in
// its `const VERSION` line. WHEN YOU BUMP `sw` HERE, BUMP sw.js VERSION TOO
// (one grep: `const VERSION =`). Everything else reads this constant — never
// hardcode versions anywhere else.
export const CODEX_VERSION_DATA: CodexVersion = {
  v: "12.0",    // user-facing app version
  sw: "v269",   // service-worker cache generation — MIRRORED in sw.js line ~21
  notes: [
    "THE WHOLE DESKTOP IS YOURS: every window now drags flush to any edge — the bug that pinned the galaxy is gone; spread your study across the entire screen",
    "⊞ ARRANGE: one tap lays your open windows side-by-side, in thirds, or quad — and you can NAME and save study setups to recall later",
    "EVERY WINDOW: − to minimize, ⧉ to pop out onto another monitor; the dock has clear line icons now, live previews on right-click, and you can drag to reorder",
  ],
};

// ── WHAT’S NEW flash ──────────────────────────────────────────────────────────────
// Faithful port of the first IIFE in legacy/version.js.
// On boot, if the stored last-seen version differs from CODEX_VERSION.v,
// show a small dismissible glass card (bottom-right) with the notes.
// Dismissing stores the version so the card appears once per update.
export function installWhatsNew(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const KEY = "codex.lastver";
  const cur = vw().CODEX_VERSION.v;
  let last: string | null = null;
  try { last = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (last === cur) return;
  if (last === null) {
    // First-ever visit: nothing to delta against — just record and skip.
    // NOTE: preserved from legacy
    try { localStorage.setItem(KEY, cur); } catch { /* private mode */ }
    return;
  }

  function dismiss(card: HTMLElement): void {
    try { localStorage.setItem(KEY, cur); } catch { /* private mode */ }
    card.classList.add("cx-fresh-out");
    setTimeout(() => {
      if (card.parentNode) card.parentNode.removeChild(card);
    }, 350);
  }

  function show(): void {
    if (document.getElementById("cx-whatsnew")) return;
    const card = document.createElement("div");
    card.id = "cx-whatsnew";
    card.setAttribute("role", "status");
    const ul = vw().CODEX_VERSION.notes
      .slice(0, 4)
      .map((n) => "<li>" + n + "</li>")
      .join("");
    card.innerHTML =
      '<div class="cx-whatsnew-head"><span class="cx-whatsnew-title">✦ WHAT’S NEW · v' +
      cur +
      "</span>" +
      '<button class="cx-whatsnew-x" type="button" aria-label="Dismiss">×</button></div>' +
      '<ul class="cx-whatsnew-list">' +
      ul +
      "</ul>";
    // NOTE: preserved from legacy — button is always present inside the innerHTML above;
    // TypeScript requires the null-check that the legacy omitted.
    const xBtn = card.querySelector(".cx-whatsnew-x");
    if (xBtn) {
      xBtn.addEventListener("click", () => { dismiss(card); });
    }
    document.body.appendChild(card);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { setTimeout(show, 1200); });
  } else {
    setTimeout(show, 1200);
  }
}

// ── SELF-UPDATE pill ──────────────────────────────────────────────────────────
// Faithful port of the second IIFE in legacy/version.js.
// The end of the double-reload ritual. The SW already skipWaiting()s on
// install and claims clients — so when a new version lands, the PAGE is
// what’s stale, not the worker. We watch for that moment and offer one
// tap: controllerchange (a new SW took over this page) or a waiting
// worker (belt & braces: we post SKIP_WAITING) → show the pill → tap →
// reload once → current. A 30-min reg.update() poll while visible means
// long-lived tabs hear about updates without a navigation.
export function installUpdatePill(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let shown = false;
  let booted = false;
  // NOTE: preserved from legacy — ignore the initial claim on first install
  setTimeout(() => { booted = true; }, 4000);

  function pill(): void {
    if (shown || document.getElementById("cx-fresh")) return;
    shown = true;
    const el = document.createElement("button");
    el.id = "cx-fresh";
    el.type = "button";
    el.setAttribute("role", "status");
    el.innerHTML = "✦ CODEX updated — <b>tap to refresh</b>";
    el.addEventListener("click", () => {
      el.disabled = true;
      el.innerHTML = "✦ refreshing…";
      location.reload();
    });
    document.body.appendChild(el);
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (booted) pill();
  });

  function watch(reg: ServiceWorkerRegistration | undefined): void {
    if (!reg) return;
    if (reg.waiting) {
      try { reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ }
    }
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) pill();
      });
    });
    // long-lived tabs: ask for updates every 30 min while visible
    // NOTE: preserved from legacy
    setInterval(() => {
      if (document.visibilityState === "visible") {
        try { reg.update(); } catch { /* ignore */ }
      }
    }, 30 * 60 * 1000);
  }

  if (document.readyState === "complete") {
    navigator.serviceWorker.getRegistration().then(watch).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      setTimeout(() => {
        navigator.serviceWorker.getRegistration().then(watch).catch(() => {});
      }, 800);
    });
  }
}
