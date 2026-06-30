// panels — rail/plugin host (Backlog 4.1). Migrated from panels.jsx: the tab
// registry (railTabs), the programmatic opener (codexOpenPanel), the engagement
// depth helper, and the plugin panel host (React + DOM-mutation paths with an
// error boundary). Window-coupled glue verified by the integration probe.
import React, { useEffect, useRef } from "react";
import { PaneHead } from "./chrome.js";

interface PluginPanel {
  pluginId?: string;
  id: string;
  label: string;
  glyph?: string;
  render(ctx: { book?: string; bookId?: string; chapter?: number; verse?: number; translation?: string; container?: HTMLElement }): unknown;
}

interface HostWindow {
  t?: (k: string) => string;
  CODEX_PLUGINS_API?: { getPanels(): PluginPanel[] };
  railTabs?: () => RailTab[];
  codexOpenPanel?: (id: string) => void;
  codexDeskPanels?: { on?: () => boolean; open(id: string): void };
}
function hw(): HostWindow {
  return window as unknown as HostWindow;
}

export interface RailTab {
  id: string;
  label: string;
  glyph: string;
  isPlugin?: boolean;
  plugin?: PluginPanel;
}

export function railTabs(): RailTab[] {
  const t = hw().t || ((k: string) => k);
  const builtIns: RailTab[] = [
    { id: "trans", label: t("panel.translations"), glyph: "Α/Ω" },
    { id: "talmud", label: t("panel.talmud"), glyph: "ת" },
    { id: "comm", label: t("panel.commentary"), glyph: "§" },
    { id: "gem", label: t("panel.gematria"), glyph: "Σn" },
    { id: "gnosis", label: t("panel.gnosis"), glyph: "⟁" },
    { id: "disarm", label: t("panel.disarm") === "panel.disarm" ? "DISARM" : t("panel.disarm"), glyph: "⚔" },
    { id: "exeg", label: t("panel.exegesis"), glyph: "✎" },
    { id: "txan", label: t("panel.txanalysis"), glyph: "⟷" },
  ];
  const pluginPanels = hw().CODEX_PLUGINS_API?.getPanels() || [];
  const pluginTabs: RailTab[] = pluginPanels.map((p) => ({
    id: `plugin:${p.pluginId}:${p.id}`,
    label: p.label,
    glyph: p.glyph || "◆",
    isPlugin: true,
    plugin: p,
  }));
  return [...builtIns, ...pluginTabs];
}

export function codexOpenPanel(idIn: unknown): void {
  try {
    const id = String(idIn == null ? "" : idIn).trim();
    if (!id) return;
    if (id.indexOf("plugin:") === 0) {
      const parts = id.split(":");
      window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { pluginId: parts[1], panelId: parts.slice(2).join(":") } }));
    } else {
      const desk = hw().codexDeskPanels;
      if (desk && desk.on && desk.on()) {
        desk.open(id);
        return;
      }
      window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { panelId: id } }));
      window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: id } }));
    }
  } catch {
    /* ignore */
  }
}

export function emitDepth(type: string, ref: string | null, weight: number): void {
  try {
    if (!type) return;
    window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type, ref: ref == null ? null : String(ref), weight } }));
  } catch {
    /* best-effort */
  }
}

class PluginErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err: Error): { err: Error } {
    return { err };
  }
  override componentDidCatch(err: Error, info: unknown): void {
    console.warn("[CODEX plugin error]", err, info);
  }
  override render(): React.ReactNode {
    if (this.state.err) {
      return (
        <div className="cx-plugin-error">
          <b>Plugin crashed</b>
          <pre>{String(this.state.err.message || this.state.err)}</pre>
          <small>This crash was caught and contained — the rest of the app keeps working.</small>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PluginMountProps {
  panel: PluginPanel;
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

function DomPluginMount({ panel, book, bookId, chapter, verse, translation }: PluginMountProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    try {
      const r = panel.render({ book, bookId, chapter, verse, translation, container: el });
      if (typeof r === "string") el.textContent = r;
    } catch (e) {
      console.warn(`[CODEX plugin "${panel.pluginId}:${panel.id}" DOM mount threw]`, e);
      el.textContent = `Plugin error: ${(e as Error).message || e}`;
    }
    return () => {
      if (el) el.innerHTML = "";
    };
  }, [panel, book, bookId, chapter, verse, translation]);
  return <div ref={ref} className="cx-plugin-mount-dom" />;
}

export function PluginPanelHost({ panel, book, bookId, chapter, verse, translation }: PluginMountProps): React.ReactElement {
  const ctx = { book, bookId, chapter, verse, translation };
  let reactEl: unknown = null;
  let renderErr: Error | null = null;
  try {
    reactEl = panel.render(ctx);
  } catch (e) {
    renderErr = e as Error;
  }
  const isReact = !!reactEl && (React.isValidElement(reactEl) || typeof reactEl === "string" || typeof reactEl === "number");
  const panelKey = `${panel.pluginId || "?"}:${panel.id}`;
  return (
    <div className="cx-pane cx-pane-plugin">
      <PaneHead title={panel.label.toUpperCase()} sub={`${book} ${chapter}${verse ? ":" + verse : ""}`} />
      {renderErr ? (
        <div className="cx-plugin-error">
          <b>Plugin failed to render</b>
          <pre>{String(renderErr.message || renderErr)}</pre>
        </div>
      ) : isReact ? (
        <PluginErrorBoundary key={panelKey}>
          <div className="cx-plugin-mount">{reactEl as React.ReactNode}</div>
        </PluginErrorBoundary>
      ) : (
        <DomPluginMount key={panelKey} panel={panel} book={book} bookId={bookId} chapter={chapter} verse={verse} translation={translation} />
      )}
    </div>
  );
}
