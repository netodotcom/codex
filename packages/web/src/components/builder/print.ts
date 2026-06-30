// builder — print-only container that mirrors the active study cleanly (migrated
// verbatim from builder.jsx). On Export-PDF the panel adds a body class; CSS
// hides app chrome and reveals #cx-builder-printable holding the rendered study.
// We inject/refresh that node on demand (the `beforeprint` wiring lives in index).
import { loadStore } from "./store.js";
import { studyToMarkdown, mdToHtml } from "./markdown.js";

export function syncPrintable(): void {
  let node = document.getElementById("cx-builder-printable");
  if (!node) {
    node = document.createElement("div");
    node.id = "cx-builder-printable";
    document.body.appendChild(node);
  }
  const store = loadStore();
  const active = store.studies.find((s) => s.id === store.activeStudyId);
  if (!active) {
    node.innerHTML = "";
    return;
  }
  const md = studyToMarkdown(active);
  node.innerHTML = mdToHtml(md);
}
