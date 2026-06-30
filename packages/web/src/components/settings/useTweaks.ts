// settings — the tweak store hook (migrated from tweaks-panel.jsx). Single
// source of truth for tweak values: persists to codex.tweaks.v1, posts
// __edit_mode_set_keys to the host, dispatches 'tweakchange', and LISTENS on
// 'tweakchange' so every instance (panel, kernel, reader pills) converges.
import React from "react";
import { CODEX_TWEAKS_KEY, type TweakMap } from "./store.js";
import { refreshSettingsIndex } from "./settings-index.js";

interface TweaksWindow {
  CODEX_TWEAK_DEFAULTS?: TweakMap;
  parent: { postMessage(msg: unknown, target: string): void };
}
function tw(): TweaksWindow {
  return window as unknown as TweaksWindow;
}

export type SetTweak = (keyOrEdits: string | TweakMap, val?: unknown) => void;

export function useTweaks(defaults: TweakMap): [TweakMap, SetTweak] {
  React.useMemo(() => {
    try {
      tw().CODEX_TWEAK_DEFAULTS = Object.assign({}, tw().CODEX_TWEAK_DEFAULTS, defaults);
      refreshSettingsIndex();
    } catch {
      /* defensive */
    }
    return null;
  }, []);

  const [values, setValues] = React.useState<TweakMap>(() => {
    try {
      const raw = localStorage.getItem(CODEX_TWEAKS_KEY);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as TweakMap) };
    } catch {
      /* fall through */
    }
    return defaults;
  });

  // Accepts setTweak('key', value) or setTweak({ key: value, ... }).
  const setTweak = React.useCallback<SetTweak>((keyOrEdits, val) => {
    const edits: TweakMap = typeof keyOrEdits === "object" && keyOrEdits !== null ? keyOrEdits : { [keyOrEdits as string]: val };
    setValues((prev) => {
      const next = { ...prev, ...edits };
      try {
        localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
    try {
      tw().parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));
  }, []);

  // Converge on writes from ANY other surface.
  React.useEffect(() => {
    const onChange = (e: Event): void => {
      const edits = (e as CustomEvent<TweakMap>).detail;
      if (!edits || typeof edits !== "object") return;
      setValues((prev) => {
        let changed = false;
        for (const k in edits) {
          if (prev[k] !== edits[k]) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...edits } : prev;
      });
    };
    window.addEventListener("tweakchange", onChange);
    return () => window.removeEventListener("tweakchange", onChange);
  }, []);

  return [values, setTweak];
}
