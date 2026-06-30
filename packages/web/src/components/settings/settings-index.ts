// settings — the machine-checkable settings index (migrated from
// tweaks-panel.jsx). Surfaces every live setting (registry + auto-detected
// unknown tweak keys) on window.CODEX_SETTINGS_INDEX, and runs the one-time
// engage* → continuity migration.
import { SETTINGS_REGISTRY, CODEX_SETTINGS_DEPRECATED, groupForKey, humanize, inferKind } from "./registry.js";
import { CODEX_TWEAKS_KEY, cxTweaksRead, type TweakMap } from "./store.js";

export interface AutoEntry {
  key: string;
  label: string;
  kind: string;
  group: string;
  owner: string;
  kw: string;
  value: unknown;
}
export interface IndexEntry {
  key: string;
  label: string;
  kind: string;
  group: string;
}

interface SettingsWindow {
  CODEX_TWEAK_DEFAULTS?: TweakMap;
  CODEX_SETTINGS_INDEX?: IndexEntry[];
  CODEX_SETTINGS_DEPRECATED?: string[];
}
function sw(): SettingsWindow {
  return window as unknown as SettingsWindow;
}

// Keys in CODEX_TWEAK_DEFAULTS / the stored blob that the registry doesn't know
// and that weren't deliberately retired → auto-surfaced as generic controls.
export function unknownTweaks(): AutoEntry[] {
  const known = new Set(SETTINGS_REGISTRY.map((r) => r.key));
  const dep = new Set(CODEX_SETTINGS_DEPRECATED);
  const defaults = (typeof window !== "undefined" && sw().CODEX_TWEAK_DEFAULTS) || {};
  const stored = cxTweaksRead();
  const out: AutoEntry[] = [];
  const seen = new Set<string>();
  for (const k of [...Object.keys(defaults), ...Object.keys(stored)]) {
    if (known.has(k) || dep.has(k) || seen.has(k)) continue;
    seen.add(k);
    const v = k in defaults ? defaults[k] : stored[k];
    out.push({
      key: k,
      label: humanize(k),
      kind: inferKind(v),
      group: groupForKey(k),
      owner: "auto",
      kw: humanize(k).toLowerCase(),
      value: v,
    });
  }
  return out;
}

export function refreshSettingsIndex(): IndexEntry[] {
  const idx: IndexEntry[] = (SETTINGS_REGISTRY as Array<{ key: string; label: string; kind: string; group: string }>)
    .concat(unknownTweaks())
    .map((r) => ({ key: r.key, label: r.label, kind: r.kind, group: r.group }));
  sw().CODEX_SETTINGS_INDEX = idx;
  return idx;
}

// One-time migration: users who flipped the old engage* controls keep their
// choices under the canonical continuity keys.
export function migrateEngage(): void {
  try {
    const s = cxTweaksRead();
    const edits: TweakMap = {};
    if ("engageEnabled" in s && !("continuityEnabled" in s)) edits["continuityEnabled"] = !!s["engageEnabled"];
    if ("engageDailyThreshold" in s && !("continuityThreshold" in s)) edits["continuityThreshold"] = s["engageDailyThreshold"];
    if ("engageNotifyCadence" in s && !("notifyCadence" in s)) {
      const cad = s["engageNotifyCadence"];
      edits["notifyCadence"] = cad === "off" ? "off" : cad === "all" ? "all" : "subtle";
    }
    if (Object.keys(edits).length) {
      const next = { ...s, ...edits };
      localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify(next));
    }
  } catch {
    /* never throw at module load */
  }
}

// Publish the deprecated set (the settings index check reads it).
export function registerDeprecated(): void {
  sw().CODEX_SETTINGS_DEPRECATED = CODEX_SETTINGS_DEPRECATED;
}
