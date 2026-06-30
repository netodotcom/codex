// intel — typed window boundary. Callers use iw() and read/write what they
// need, lazily, at call time — same pattern as reader-window.ts / vox-window.ts.
//
// Written at module load:
//   window.IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp
//   window.CODEX_INTEL
// Read at runtime:
//   window.CODEX_DATA.tweaks   (by intelEngine())

export interface IntelWindow {
  // written at module load (Object.assign + direct assignment)
  IntelDecrypt?: unknown;
  IntelBars?: unknown;
  IntelBanner?: unknown;
  IntelTicker?: unknown;
  IntelStamp?: unknown;
  CODEX_INTEL?: unknown;
  // read at runtime
  CODEX_DATA?: { tweaks?: { provider?: unknown; model?: unknown } };
}

export function iw(): IntelWindow {
  return window as unknown as IntelWindow;
}
