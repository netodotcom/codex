// settings — the tweak store helpers (migrated from tweaks-panel.jsx). Tiny
// localStorage read/write shared by useTweaks and the panel's own controls.
// Every write persists, posts __edit_mode_set_keys to the host, and dispatches
// 'tweakchange' so every surface converges.
export const CODEX_TWEAKS_KEY = "codex.tweaks.v1";

export type TweakValue = string | number | boolean | unknown;
export type TweakMap = Record<string, TweakValue>;

interface StoreWindow {
  parent: { postMessage(msg: unknown, target: string): void };
}

export function cxTweaksRead(): TweakMap {
  try {
    return (JSON.parse(localStorage.getItem(CODEX_TWEAKS_KEY) || "null") as TweakMap) || {};
  } catch {
    return {};
  }
}

export function cxTweaksWrite(edits: TweakMap): TweakMap {
  const next = { ...cxTweaksRead(), ...edits };
  try {
    localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  try {
    (window as unknown as StoreWindow).parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));
  } catch {
    /* ignore */
  }
  return next;
}
