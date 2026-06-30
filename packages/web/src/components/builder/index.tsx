// builder — migrated feature entry (Phase 2.5 Sermon / Study Builder). Replaces
// dist/builder.js in the Vite build (gen-web-entry maps it). This file is the
// former IIFE body: it runs the same module-load side effects (URL-hash import,
// the codex:add-to-study listener, the beforeprint printable sync, plugin
// registration) and exposes the same window global (window.CODEX_StudyBuilder),
// exactly as legacy/builder.jsx did.
import React from "react";
import { BuilderPanel, type PanelCtx } from "./BuilderPanel.js";
import { loadStore, saveStore, makeEmptyStudy, uid, importStudyObject, type StudyItem } from "./store.js";
import { studyToMarkdown } from "./markdown.js";
import { syncPrintable } from "./print.js";
import { bw } from "./builder-window.js";

// ── URL-hash import on load ─────────────────────────────────────────
function tryImportFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const enc = params.get("study");
    if (!enc) return;
    const json = decodeURIComponent(escape(atob(enc)));
    const obj = JSON.parse(json);
    if (importStudyObject(obj)) {
      // Strip the param so it doesn't re-import on next reload.
      params.delete("study");
      const next = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
      window.history.replaceState({}, "", next);
    }
  } catch (e) {
    console.warn("studies: URL import failed", e);
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryImportFromUrl, { once: true });
} else {
  tryImportFromUrl();
}

// ── External event listener — appends to active study even when the panel
//    isn't mounted, so verse-menu / panel buttons always work ──
window.addEventListener("codex:add-to-study", (ev: Event) => {
  const item = (ev as CustomEvent<StudyItem>).detail;
  if (!item || !item.type) return;
  const store = loadStore();
  let study = store.studies.find((s) => s.id === store.activeStudyId);
  if (!study) {
    study = makeEmptyStudy("New study");
    store.studies.push(study);
    store.activeStudyId = study.id;
  }
  if (study.sections.length === 0) {
    study.sections.push({ id: uid("section"), heading: "Notes", items: [] });
  }
  const last = study.sections[study.sections.length - 1];
  if (last) last.items.push({ ...item, _id: uid("item") });
  study.modified = Date.now();
  saveStore(store);
  window.dispatchEvent(new CustomEvent("codex:studies-changed"));
  // Brief toast — unified notification dock.
  try {
    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: `Added to “${study.title}”`, kind: "ok" } }));
  } catch {
    /* ignore */
  }
});

// ── Print-only sync: refresh #cx-builder-printable when printing the study ──
window.addEventListener("beforeprint", () => {
  if (document.body.classList.contains("cx-builder-printing")) syncPrintable();
});

// ── Plugin registration ─────────────────────────────────────────────
function doRegister(): unknown {
  const api = bw().CODEX_PLUGINS_API;
  if (!api || typeof api.register !== "function") return false;
  return api.register({
    id: "sermon-builder",
    name: "Sermon & Study Builder",
    version: "1.0.0",
    panels: [
      {
        id: "builder",
        label: "STUDIES",
        glyph: "❡",
        render(ctx) {
          return React.createElement(BuilderPanel, (ctx || {}) as unknown as PanelCtx);
        },
      },
    ],
    verseActions: [
      {
        label: "Add to Study",
        icon: "❡",
        handler(verseRef) {
          // verseRef may be a string ("Book C:V") or context object.
          let detail: StudyItem;
          if (verseRef && typeof verseRef === "object" && (verseRef as { bookId?: unknown }).bookId) {
            const vr = verseRef as { bookId: string; chapter?: number; verse?: number; text?: string; translation?: string };
            const v = vr.verse || 1;
            let text = vr.text || "";
            const tr = vr.translation || "kjv";
            if (!text) {
              try {
                const bible = bw().BIBLE;
                if (bible && bible.getCachedChapter) {
                  const ch = bible.getCachedChapter(vr.bookId, vr.chapter, tr);
                  const vv = ch && ch.verses && ch.verses.find((x) => x.n === v);
                  if (vv) text = (((vv as Record<string, unknown>)[tr] as string) || vv.text || "").trim();
                }
              } catch {
                /* ignore */
              }
            }
            detail = { type: "verse", ref: `${vr.bookId}.${vr.chapter}.${v}`, text, translation: tr };
          } else {
            detail = { type: "verse", ref: String(verseRef || ""), text: "", translation: "kjv" };
          }
          window.dispatchEvent(new CustomEvent("codex:add-to-study", { detail }));
          // Surface the Studies panel so the user SEES the verse land (the action
          // was silently adding in the background = "not working").
          try {
            window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { pluginId: "sermon-builder", panelId: "builder" } }));
          } catch {
            /* ignore */
          }
          try {
            window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Added to study", kind: "ok" } }));
          } catch {
            /* ignore */
          }
        },
      },
    ],
  });
}
if (!doRegister()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doRegister, { once: true });
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}

// Expose helpers for other modules / panels (same surface as v1).
Object.assign(window, {
  CODEX_StudyBuilder: {
    addItem: (item: unknown) => window.dispatchEvent(new CustomEvent("codex:add-to-study", { detail: item })),
    importStudy: importStudyObject,
    studyToMarkdown,
  },
});
