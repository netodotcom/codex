// settings — day-mode palette picker (migrated from tweaks-panel.jsx). Renders
// the registered light themes as swatches; selection routes through
// window.CODEX_LIGHT_THEMES.
import React from "react";
import { sw } from "./settings-window.js";

export function LightThemePicker(): React.ReactElement | null {
  const themes = sw().CODEX_LIGHT_THEMES;
  const [current, setCurrent] = React.useState((themes && themes.get()) || "parchment");
  React.useEffect(() => {
    const onChange = (e: Event): void => setCurrent((e as CustomEvent<{ theme?: string }>).detail?.theme || current);
    window.addEventListener("codex:light-theme-change", onChange);
    return () => window.removeEventListener("codex:light-theme-change", onChange);
  }, [current]);
  if (!themes) return null;
  return (
    <div className="cx-tp-theme-grid">
      {themes.list().map((t) => {
        const isActive = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`cx-tp-theme-swatch ${isActive ? "is-active" : ""}`}
            onClick={() => themes.set(t.id)}
            title={`Day mode: ${t.label}`}
            aria-label={`Day mode theme: ${t.label}${isActive ? " (active)" : ""}`}
            aria-pressed={isActive}
          >
            <div className="cx-tp-theme-swatch-preview" style={{ background: t.bg, color: t.fg }}>
              Aa
            </div>
            <span className="cx-tp-theme-swatch-accent" style={{ background: t.accent }} aria-hidden="true" />
            <span className="cx-tp-theme-swatch-name">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
