// marketplace — MarketplacePanel component (migrated from marketplace.jsx).
// Main panel: installed list, curated index browse, add-by-URL, add-by-file,
// detail view. All logic is faithful to the legacy IIFE.
import React from "react";
import type { IndexModule, InstalledModule, IndexData } from "./data.js";
import { loadIndex, CATEGORIES } from "./data.js";
import { fmtSize, fmtDate, typeBadge, CategoryFromIndex } from "./helpers.js";
import { S } from "./style.js";
import { ModuleCard } from "./ModuleCard.js";
import { mw } from "./marketplace-window.js";

const { useState, useEffect, useMemo, useCallback, useRef } = React;

interface Msg {
  kind: string;
  text: string;
}

export function MarketplacePanel(): React.ReactElement {
  const [installed, setInstalled] = useState<InstalledModule[]>([]);
  const [index, setIndex] = useState<IndexData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [url, setUrl] = useState("");
  const [expectedId, setExpectedId] = useState("");
  const [urlMsg, setUrlMsg] = useState<Msg | null>(null);
  const [fileMsg, setFileMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<IndexModule | null>(null);
  const [dragHot, setDragHot] = useState(false);
  const filePickRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    if (!mw().CODEX_MODULES) { setInstalled([]); return; }
    mw().CODEX_MODULES!.listModules()
      .then(setInstalled)
      .catch(() => setInstalled([]));
  }, []);

  useEffect(() => {
    refresh();
    loadIndex().then(setIndex).catch((e: unknown) => setErr(String((e && typeof e === "object" && "message" in e) ? (e as { message: unknown }).message : e)));
  }, [refresh]);

  const installedIds = useMemo(
    () => new Set(installed.map((m) => m.id)), [installed]);

  const indexMods: IndexModule[] = (index && index.modules) || [];
  const featured = useMemo(
    () => indexMods.filter((m) => m.featured), [indexMods]);
  const visible = useMemo(() => {
    if (cat === "all") return indexMods;
    return indexMods.filter((m) => CategoryFromIndex(m) === cat);
  }, [indexMods, cat]);

  function installFromIndex(mod: IndexModule): void {
    if (!mod || !mod.url) return;
    setBusy((b) => ({ ...b, [mod.id]: true }));
    mw().CODEX_MODULES!.loadModuleFromUrl(mod.url, mod.id).then(() => {
      setBusy((b) => { const n = { ...b }; delete n[mod.id]; return n; });
      refresh();
    }).catch((e: unknown) => {
      setBusy((b) => { const n = { ...b }; delete n[mod.id]; return n; });
      setErr("Install failed: " + ((e && typeof e === "object" && "message" in e) ? (e as { message: unknown }).message : e));
    });
  }

  function remove(id: string): void {
    if (!mw().CODEX_MODULES) return;
    mw().CODEX_MODULES!.removeModule(id).then(refresh).catch(() => {});
  }

  function installByUrl(): void {
    setUrlMsg(null);
    const u = url.trim();
    const id = expectedId.trim();
    if (!u) { setUrlMsg({ kind: "err", text: "Enter a URL first." }); return; }
    if (!id) { setUrlMsg({ kind: "err", text: "Enter the expected module id." }); return; }
    try { new URL(u); } catch { setUrlMsg({ kind: "err", text: "That URL doesn't look valid." }); return; }
    setUrlMsg({ kind: "ok", text: "Fetching + installing…" });
    mw().CODEX_MODULES!.loadModuleFromUrl(u, id).then(() => {
      setUrlMsg({ kind: "ok", text: "Installed " + id + "." });
      setUrl(""); setExpectedId("");
      refresh();
    }).catch((e: unknown) => {
      setUrlMsg({ kind: "err", text: "Install failed: " + ((e && typeof e === "object" && "message" in e) ? (e as { message: unknown }).message : e) });
    });
  }

  async function installFromFile(file: File): Promise<void> {
    setFileMsg(null);
    if (!file) return;
    try {
      const text = await file.text();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = JSON.parse(text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!mod || !mod.meta || !mod.meta.id || !mod.meta.type || !mod.meta.version) {
        throw new Error("missing meta envelope (need id/type/version)");
      }
      // Put directly via IndexedDB by reusing loadModuleFromUrl through a
      // blob URL — keeps validation in one place.
      const blob = new Blob([text], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        await mw().CODEX_MODULES!.loadModuleFromUrl(blobUrl, mod.meta.id);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      setFileMsg({ kind: "ok", text: "Installed " + mod.meta.id + "." });
      refresh();
    } catch (e: unknown) {
      setFileMsg({ kind: "err", text: "File install failed: " + ((e && typeof e === "object" && "message" in e) ? (e as { message: unknown }).message : e) });
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault(); setDragHot(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) void installFromFile(f);
  }

  // ─── detail view ──────────────────────────────────────────────────────
  if (detail) {
    const isInstalled = installedIds.has(detail.id);
    const soon = detail._status === "coming-soon";
    return React.createElement("div", { style: S.root, className: "cx-mkt-pane" },
      React.createElement("button", { style: S.backBtn, onClick: () => setDetail(null) },
        "‹ BACK TO MARKETPLACE"),
      React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 } },
        React.createElement("span", { style: S.badge(soon ? "soon" : "ok") },
          soon ? "Coming Soon" : typeBadge(detail.type))
      ),
      React.createElement("h2", { style: { ...S.name, fontSize: 26, margin: "4px 0 8px 0" } },
        detail.name),
      React.createElement("div", { style: S.meta },
        (detail.author || "—") + " · v" + (detail.version || "1.0.0") + " · " +
        (detail.license || "—") + " · " + fmtSize(detail.size_kb)),
      React.createElement("p", { style: { ...S.desc, marginTop: 12 } }, detail.description),
      detail.url && React.createElement("div", { style: { ...S.meta, marginTop: 6 } },
        "Source: ",
        React.createElement("a", {
          href: detail.url, target: "_blank", rel: "noopener noreferrer",
          style: { color: "var(--cx-accent, #7ee0ff)" },
        }, detail.url)
      ),
      React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
        isInstalled
          ? React.createElement("button", {
              style: S.pillDanger,
              onClick: () => { remove(detail.id); setDetail(null); },
            }, "Remove")
          : React.createElement("button", {
              style: soon ? { ...S.pill, opacity: 0.4, cursor: "not-allowed" } : S.pill,
              disabled: soon || !!busy[detail.id],
              onClick: () => installFromIndex(detail),
            }, !!busy[detail.id] ? "Installing…" : (soon ? "Coming Soon" : "Install"))
      ),
      React.createElement("details", { style: { marginTop: 18 } },
        React.createElement("summary", {
          style: { cursor: "pointer", fontSize: 11, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--cx-accent, #7ee0ff)" },
        }, "Raw JSON"),
        React.createElement("pre", { style: { ...S.detailPre, marginTop: 8 } },
          JSON.stringify(detail, null, 2))
      )
    );
  }

  // ─── main render ──────────────────────────────────────────────────────
  return React.createElement("div", { style: S.root, className: "cx-mkt-pane" },
    React.createElement("h1", { style: S.h1 }, "⌬ Module Marketplace"),
    React.createElement("p", { style: S.blurb },
      "Discover, install, and manage CODEX study modules — lexicons, cross-refs, commentaries, reading plans, and more."),

    err && React.createElement("div", { style: S.msg("err") }, err),

    // Installed
    React.createElement("h2", { style: S.h2 },
      "Installed (" + installed.length + ")"),
    installed.length === 0
      ? React.createElement("div", { style: { ...S.meta, opacity: 0.7 } },
          "Nothing installed yet. Browse below or add by URL.")
      : installed.map((m) =>
          React.createElement("div", { key: m.id, style: S.row, className: "cx-mkt-row" },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                React.createElement("span", { style: S.badge("ok") }, typeBadge(m.type)),
                React.createElement("strong", null, m.name || m.id)
              ),
              React.createElement("div", { style: S.meta },
                "v" + m.version + " · installed " + fmtDate(m.installedAt))
            ),
            React.createElement("button", {
              style: S.pillDanger,
              onClick: () => remove(m.id),
            }, "Remove")
          )
        ),

    React.createElement("div", { style: S.rule }),

    // Featured
    featured.length > 0 && React.createElement(React.Fragment, null,
      React.createElement("h2", { style: S.h2 }, "Featured"),
      React.createElement("div", { style: S.grid2 },
        featured.map((m) =>
          React.createElement(ModuleCard, {
            key: m.id, mod: m,
            installed: installedIds.has(m.id),
            onOpen: setDetail,
            onInstall: installFromIndex,
            busy: !!busy[m.id],
          })
        )
      )
    ),

    // Browse
    React.createElement("h2", { style: S.h2 }, "Browse by category"),
    React.createElement("div", { style: S.chipRow },
      CATEGORIES.map((c) =>
        React.createElement("span", {
          key: c.id,
          style: S.chip(cat === c.id),
          onClick: () => setCat(c.id),
        }, c.label)
      )
    ),
    visible.length === 0
      ? React.createElement("div", { style: { ...S.meta, opacity: 0.7 } },
          "No modules in this category yet.")
      : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 0 } },
          visible.map((m) =>
            React.createElement("div", { key: m.id, style: S.row, className: "cx-mkt-row",
              onClick: () => setDetail(m) },
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" } },
                  React.createElement("span", { style: S.badge(m._status === "coming-soon" ? "soon" : "ok") },
                    m._status === "coming-soon" ? "Soon" : typeBadge(m.type)),
                  React.createElement("strong", null, m.name)
                ),
                React.createElement("div", { style: S.meta },
                  (m.author || "—") + " · " + fmtSize(m.size_kb) + " · " + (m.license || "—"))
              ),
              installedIds.has(m.id)
                ? React.createElement("span", { style: { ...S.meta, color: "var(--cx-accent, #7ee0ff)" } }, "✓")
                : React.createElement("button", {
                    style: m._status === "coming-soon"
                      ? { ...S.pillGhost, opacity: 0.4, cursor: "not-allowed" }
                      : S.pillGhost,
                    disabled: m._status === "coming-soon" || !!busy[m.id],
                    onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (m._status !== "coming-soon") installFromIndex(m); },
                  }, !!busy[m.id] ? "…" : (m._status === "coming-soon" ? "Soon" : "Install"))
            )
          )
        ),

    React.createElement("div", { style: S.rule }),

    // Add by URL
    React.createElement("h2", { style: S.h2 }, "Add by URL"),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      React.createElement("input", {
        style: S.input, type: "url", placeholder: "https://example.com/my-module.json",
        value: url, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value),
      }),
      React.createElement("input", {
        style: S.input, type: "text", placeholder: "expected module id (e.g. my-lexicon)",
        value: expectedId, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setExpectedId(e.target.value),
      }),
      React.createElement("button", { style: S.pill, onClick: installByUrl }, "Install")
    ),
    urlMsg && React.createElement("div", { style: S.msg(urlMsg.kind) }, urlMsg.text),

    // Add by file
    React.createElement("h2", { style: S.h2 }, "Add by file"),
    React.createElement("div", {
      style: S.drop(dragHot),
      onClick: () => filePickRef.current && filePickRef.current.click(),
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragHot(true); },
      onDragLeave: () => setDragHot(false),
      onDrop: onDrop,
    },
      dragHot ? "Drop to install" : "Drop a .json module here, or click to pick"
    ),
    React.createElement("input", {
      ref: filePickRef, type: "file", accept: "application/json,.json",
      style: { display: "none" },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files && e.target.files[0];
        if (f) void installFromFile(f);
        e.target.value = "";
      },
    }),
    fileMsg && React.createElement("div", { style: S.msg(fileMsg.kind) }, fileMsg.text),

    React.createElement("div", { style: { ...S.meta, marginTop: 20, opacity: 0.55 } },
      index && index.updated ? "Curated index updated " + index.updated : null)
  );
}
