// displays — entry. Sets window.__CXDISPLAYS and window.codexDisplays at
// import time, exactly as legacy/displays.js. Replaces that IIFE in the Vite build.
//
// Load-time order matches the legacy IIFE precisely:
//   1. Guard (double-init / non-browser check) + set __CXDISPLAYS
//   2. Parse URL params
//   3. Install BroadcastChannel cursor sync
//   4. Schedule bootSurface (DOMContentLoaded or immediate)
//   5. Assign window.codexDisplays
import { parseDisplayParams, buildDisplaysApi, installChannelSync, bootSurface } from "./helpers.js";
import { dw } from "./displays-window.js";

// NOTE: preserved from legacy — dual guard: non-browser environments and
// re-entrant script loads both bail out without side-effects.
if (typeof window !== "undefined" && !dw().__CXDISPLAYS) {
  dw().__CXDISPLAYS = true;

  const params = parseDisplayParams(new URLSearchParams(window.location.search));

  installChannelSync();

  // Boot into single-surface arrangement when ?surface= is present.
  const surface = params.surface;
  if (surface !== null) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { bootSurface(surface); }, { once: true });
    } else {
      bootSurface(surface);
    }
  }

  dw().codexDisplays = buildDisplaysApi(params);
}
