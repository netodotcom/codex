// plans — bundled plan IDs + the cached plan loader (migrated from plans.jsx).
// Each plan is a CODEX_MODULES module; PLAN_CACHE mirrors the legacy per-id cache
// so we never re-fetch across renders. The engines outlive the skin.
import type { Plan } from "./types.js";
import { pw } from "./plans-window.js";

// ───────────────────────────────────────────────────────────────────────
// Bundled plan IDs
// ───────────────────────────────────────────────────────────────────────
export const BUNDLED_PLANS: string[] = [
  "plan-canonical-1y",
  "plan-chronological-1y",
  "plan-gospels-90",
  "plan-psalms-30",
  "plan-whole-bible-90",
  "plan-daf-yomi",
  "plan-torah-triennial",
];

// Local cache so we don't re-fetch each render
export const PLAN_CACHE: Record<string, Plan> = {};

export function loadPlan(id: string): Promise<Plan | null> {
  const cached = PLAN_CACHE[id];
  if (cached) return Promise.resolve(cached);
  const w = pw();
  const base: Promise<Plan> = w.CODEX_MODULES
    ? w.CODEX_MODULES.loadModule(id)
    : fetch(`data/modules/${id}.json`).then((r) => r.json() as Promise<Plan>);
  return base
    .then((mod) => {
      PLAN_CACHE[id] = mod;
      return mod as Plan | null;
    })
    .catch((e) => {
      console.warn("[plans] load failed", id, e);
      return null;
    });
}
