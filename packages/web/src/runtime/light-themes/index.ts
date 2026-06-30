// light-themes — migrated runtime entry. Replaces legacy/light-themes.js.
// Sets window.CODEX_LIGHT_THEMES on import with the same public API the legacy
// IIFE set. All DOM side-effects (apply-on-load, mutation-observer re-apply)
// are preserved faithfully.
//
// Variant is applied via [data-light-theme] on the .cx-app element.
// Persists choice to localStorage so it survives reloads.
import { KEY, DEFAULT, THEMES } from "./data.js";
import { ltw } from "./light-themes-window.js";
import type { LightTheme } from "./types.js";

function get(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && THEMES.some(t => t.id === v)) return v;
  } catch { /* ignore */ }
  return DEFAULT;
}

function apply(name: string): void {
  const id = THEMES.some(t => t.id === name) ? name : DEFAULT;
  // Find the .cx-app root (may not exist before React mount; default to body)
  // NOTE: preserved from legacy — || falls back to body when .cx-app is absent
  const root = document.querySelector(".cx-app") ?? document.body;
  if (id === DEFAULT) {
    root.removeAttribute("data-light-theme");
  } else {
    root.setAttribute("data-light-theme", id);
  }
  // Sync theme-color meta so the iOS notch tint follows the palette
  try {
    const theme: LightTheme | undefined = THEMES.find(t => t.id === id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme) meta.setAttribute("content", theme.bg);
  } catch { /* ignore */ }
}

function set(name: string): void {
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
  apply(name);
  try {
    window.dispatchEvent(new CustomEvent("codex:light-theme-change", { detail: { theme: name } }));
  } catch { /* ignore */ }
}

// Apply on load. The .cx-app element won't exist yet at script-eval time,
// so re-apply once after React mounts via a one-shot mutation observer.
// NOTE: preserved from legacy side-effect order
apply(get());
const obs = new MutationObserver(() => {
  if (document.querySelector(".cx-app")) {
    apply(get());
    obs.disconnect();
  }
});
obs.observe(document.documentElement, { childList: true, subtree: true });

// Public API for the picker UI in tweaks-panel.jsx
ltw().CODEX_LIGHT_THEMES = {
  list: () => THEMES.slice(),
  get,
  set,
  DEFAULT,
};
