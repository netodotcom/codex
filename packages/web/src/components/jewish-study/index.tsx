// jewish-study — migrated feature entry. Replaces legacy/deleted/dist/jewish-study.js
// in the Vite build (gen-web-entry maps it). Reproduces the legacy IIFE's
// load-time side-effects:
//   · window.CODEX_JEWISH  = { currentParsha, nextHoliday, hebrewDate }
//   · window.CODEX_JewishStudyPanel = JewishStudyPanel
//   · plugin "jewish-study" (panel "TORAH", glyph "ה") registered via
//     window.CODEX_PLUGINS_API.register — deferred to DOMContentLoaded / load
//     if the API isn't ready yet — identical control flow to the legacy IIFE.
import React from "react";
import { JewishStudyPanel } from "./JewishStudyPanel.js";
import { jw } from "./jewish-study-window.js";
import type { Parasha, CalendarModule, ParshaModule } from "./jewish-study-window.js";
import { loadModule, approxHebrewDate, daysUntilHoliday, pickParshaIndex } from "./helpers.js";

// ── Public API for other plugins ──────────────────────────────────────────
jw().CODEX_JEWISH = {
  currentParsha(): Promise<Parasha | null> {
    return loadModule("parsha").then((p: unknown) => {
      const pm = p as ParshaModule | null | undefined;
      if (!pm || !pm.parashot) return null;
      return pm.parashot[pickParshaIndex(pm.parashot)] ?? null;
    });
  },
  nextHoliday() {
    return loadModule("hebrew-calendar").then((c: unknown) => {
      const cm = c as CalendarModule | null | undefined;
      if (!cm || !cm.holidays) return null;
      const heb = approxHebrewDate(new Date());
      const sorted = cm.holidays
        .map((h) => ({ h, days: daysUntilHoliday(h, heb, cm.months) }))
        .filter((x): x is { h: typeof x.h; days: number } => x.days != null)
        .sort((a, b) => a.days - b.days);
      const next = sorted.find((x) => x.days >= 0) ?? sorted[0];
      return next ? { ...next.h, daysUntil: next.days } : null;
    });
  },
  hebrewDate(d?: Date) {
    // Make sure months cache is populated for the name.
    const date = d ?? new Date();
    if (!jw().CODEX_JEWISH_MONTHS_CACHE) {
      return loadModule("hebrew-calendar").then((c: unknown) => {
        const cm = c as CalendarModule;
        jw().CODEX_JEWISH_MONTHS_CACHE = cm.months;
        return approxHebrewDate(date);
      });
    }
    return Promise.resolve(approxHebrewDate(date));
  },
};

jw().CODEX_JewishStudyPanel = JewishStudyPanel;

// ── Plugin registration ───────────────────────────────────────────────────
function doRegister(): unknown {
  const api = jw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return api.register({
    id: "jewish-study",
    name: "Jewish Study Tools",
    version: "1.0.0",
    panels: [{
      id: "torah",
      label: "TORAH",
      glyph: "ה",
      render(_ctx: Record<string, unknown>): React.ReactElement {
        return React.createElement(JewishStudyPanel, {});
      },
    }],
  });
}

if (!doRegister()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
