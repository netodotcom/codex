// winhost — CodexWin + WinHostRoot (migrated verbatim from winhost.jsx).
// One floating window and the root that hosts them all.  Zero behaviour
// change: same DOM structure, same event listeners, same window-global
// lifecycles (codexOpenWindow / codexOpenPanel) as v1.
import React from "react";
import { winhostLoad, winhostSave, winhostDesktop, winhostResolve } from "./helpers.js";
import type { WinEntry } from "./helpers.js";
import { ww } from "./winhost-window.js";
import type { CodexNow } from "./winhost-window.js";

const { useState, useEffect } = React;

// ── CodexWin ───────────────────────────────────────────────────────────────

interface CodexWinProps {
  win: WinEntry;
  onClose: (win: WinEntry) => void;
}

function CodexWin({ win, onClose }: CodexWinProps): React.ReactElement {
  // Live passage context — the window follows the reader.
  const [now, setNow] = useState<CodexNow | null>(() => ww().CODEX_NOW ?? null);

  useEffect(() => {
    const onNow = (e: Event): void => {
      const detail = (e as CustomEvent<CodexNow | null | undefined>).detail;
      setNow(detail || ww().CODEX_NOW || null);
    };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  const panel = winhostResolve(win.id);
  const Host = ww().PluginPanelHost;

  return (
    <div
      className="cx-win-backdrop"
      data-wm-id={`win:${win.id}`}
      data-wm-glyph={win.glyph || "▣"}
    >
      <div className="cx-win">
        <header className="cx-win-h">
          <span className="cx-win-h-glyph" aria-hidden="true">{win.glyph || "▣"}</span>
          <span className="cx-win-h-title">{win.title || win.id}</span>
          {now?.ref ? <span className="cx-win-h-ctx">{now.ref}</span> : null}
          <button
            className="cx-win-x"
            onClick={() => onClose(win)}
            aria-label={`Close ${win.title}`}
            title="Close"
          >
            ×
          </button>
        </header>
        <div className="cx-win-body">
          {panel && Host ? (
            <Host
              panel={panel}
              book={now?.book}
              bookId={now?.bookId}
              chapter={now?.chapter || 1}
              verse={now?.verse || 1}
              translation={now?.translation || ww().CODEX_DATA?.tweaks?.primary || "web"}
            />
          ) : (
            <div className="cx-win-missing">
              <b>PANEL UNAVAILABLE</b>
              <p>
                {panel
                  ? "host not loaded"
                  : "this panel hasn't registered yet — it opens in the study rail instead"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WinHostRoot ────────────────────────────────────────────────────────────

export function WinHostRoot(): React.ReactElement {
  const [wins, setWins] = useState<WinEntry[]>(() =>
    winhostDesktop() ? winhostLoad() : []
  );

  useEffect(() => {
    winhostSave(wins);
  }, [wins]);

  // Public API: window.codexOpenWindow({ id, title, glyph })
  useEffect(() => {
    ww().codexOpenWindow = (spec): boolean => {
      if (!spec || !spec.id) return false;
      if (!winhostDesktop()) return false;
      if (!winhostResolve(spec.id)) return false; // only plugin panels float
      setWins((prev) => {
        if (prev.some((w) => w.id === spec.id)) {
          // Already open — surface it (wm focus happens on pointer; nudge via display).
          const bd = document.querySelector(`[data-wm-id="win:${spec.id}"]`);
          if (bd) {
            (bd as HTMLElement).style.display = "";
            bd.dispatchEvent(new Event("pointerdown", { bubbles: true }));
          }
          return prev;
        }
        return [
          ...prev,
          {
            id: spec.id,
            title: spec.title || (spec.id.split(":").pop()?.toUpperCase() ?? spec.id),
            glyph: spec.glyph || "▣",
          },
        ];
      });
      return true;
    };
    return (): void => {
      delete ww().codexOpenWindow;
    };
  }, []);

  // Under the os7 desktop, plugin panels PREFER windows: wrap codexOpenPanel
  // once (the rail version stays the fallback for builtins/mobile/classic).
  useEffect(() => {
    const railOpen = ww().codexOpenPanel;
    if (typeof railOpen !== "function") return;
    const wrapped = (id: string): void => {
      if (winhostDesktop() && id && id.indexOf("plugin:") === 0) {
        const panels = ww().CODEX_PLUGINS_API?.getPanels?.() ?? [];
        const glyph = panels.find(
          (p) => `plugin:${p.pluginId}:${p.id}` === id
        )?.glyph;
        if (ww().codexOpenWindow?.({ id, glyph })) return;
      }
      railOpen(id);
    };
    ww().codexOpenPanel = wrapped;
    return (): void => {
      if (ww().codexOpenPanel === wrapped) ww().codexOpenPanel = railOpen;
    };
  }, []);

  const close = (win: WinEntry): void =>
    setWins((prev) => prev.filter((w) => w.id !== win.id));

  return (
    <>
      {wins.map((w) => (
        <CodexWin key={w.id} win={w} onClose={close} />
      ))}
    </>
  );
}
