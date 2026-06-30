// compare — React component tree (migrated faithfully from legacy/compare.jsx).
// Sub-components: HeroStrip, FeatureMatrix, PriceChart, RadarChart,
// SentimentGrid, Roadmap, ShareButton, Sources, and the root ComparePanel.
// No CSS is self-injected here — the cx-cmp-* rules live in styles.css.
import React from "react";
import { APPS, FEATURES, PRICES, AXES, RADAR, SENTIMENT } from "./data.js";
import type { App } from "./data.js";
import { cellClass, cellGlyph, polygonPoints, axisLabelPos, buildMarkdown } from "./helpers.js";

const { useState, useEffect, useRef } = React;

// ── HeroStrip ───────────────────────────────────────────────────────────────
function HeroStrip(): React.ReactElement {
  const stats = [
    { big: "$0",   label: "Forever. No tiers.",    sub: "vs $100–$5000 (Logos)" },
    { big: "100%", label: "Offline & air-gap",      sub: "vs partial (YouVersion)" },
    { big: "OSS",  label: "Open source",            sub: "the only one besides Sefaria" },
    { big: "AI",   label: "AI-native by design",    sub: "no competitor ships AI" },
  ];
  return (
    <div className="cx-cmp-hero">
      {stats.map((s, i) => (
        <div className="cx-cmp-hero-card" key={i}>
          <div className="cx-cmp-hero-big">{s.big}</div>
          <div className="cx-cmp-hero-lbl">{s.label}</div>
          <div className="cx-cmp-hero-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── FeatureMatrix ───────────────────────────────────────────────────────────
function FeatureMatrix(): React.ReactElement {
  return (
    <div className="cx-cmp-section">
      <h3 className="cx-cmp-h">Feature matrix</h3>
      <div className="cx-cmp-sub">29 features × 7 apps · hover a cell for notes</div>
      <div className="cx-cmp-matrix-wrap">
        <table className="cx-cmp-matrix">
          <thead>
            <tr>
              <th className="cx-cmp-rowhead">Feature</th>
              {APPS.map((a) => (
                <th key={a.id} className={a.id === "codex" ? "cx-cmp-codex-col" : ""}>
                  <span style={{ color: a.color }}>{a.short}</span>
                  <div className="cx-cmp-colname">{a.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.key}>
                <th className="cx-cmp-rowhead">{f.label}</th>
                {f.row.map((c, i) => {
                  const app: App | undefined = APPS[i];
                  const isCodex = app?.id === "codex";
                  const title =
                    c.note ||
                    (app
                      ? app.name +
                        ": " +
                        (c.v === "y"
                          ? "yes"
                          : c.v === "n"
                          ? "no"
                          : c.v === "p"
                          ? "partial"
                          : c.v === "$"
                          ? "behind paywall"
                          : c.v)
                      : c.v);
                  return (
                    <td
                      key={i}
                      className={cellClass(c.v) + (isCodex ? " cx-cmp-codex-col" : "")}
                      title={title}
                    >
                      {cellGlyph(c.v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PriceChart ──────────────────────────────────────────────────────────────
interface PriceChartProps {
  ready: boolean;
}

function PriceChart({ ready }: PriceChartProps): React.ReactElement {
  const MAX = 5000;
  return (
    <div className="cx-cmp-section">
      <h3 className="cx-cmp-h">Price (USD, lifetime)</h3>
      <div className="cx-cmp-sub">
        Bar widths scaled to $5,000 ceiling · source: vendor pricing pages, 2026-05
      </div>
      <div className="cx-cmp-price">
        {PRICES.map((p) => {
          const app: App | undefined = APPS.find((a) => a.id === p.id);
          const color = app?.color ?? "#7ee0ff";
          const leftPct = (p.low / MAX) * 100;
          const widthPct = Math.max(2, ((p.high - p.low) / MAX) * 100);
          const isFree = p.high === 0;
          return (
            <div className="cx-cmp-price-row" key={p.id}>
              <div className="cx-cmp-price-name">{app?.name ?? p.id}</div>
              <div className="cx-cmp-price-track">
                <div
                  className={
                    "cx-cmp-price-bar" +
                    (isFree ? " cx-cmp-price-free" : "") +
                    (p.id === "codex" ? " cx-cmp-price-codex" : "")
                  }
                  style={{
                    left: leftPct + "%",
                    width: ready ? (isFree ? "60px" : widthPct + "%") : "0",
                    background: isFree
                      ? color
                      : "linear-gradient(90deg, " + color + "55, " + color + ")",
                    borderColor: color,
                  }}
                >
                  {p.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cx-cmp-scale">
        {["$0", "$1k", "$2k", "$3k", "$4k", "$5k"].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── RadarChart ──────────────────────────────────────────────────────────────
interface RadarChartProps {
  ready: boolean;
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
}

function RadarChart({ ready, visible, onToggle }: RadarChartProps): React.ReactElement {
  const SIZE = 460;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = 170;
  const rings = [0.25, 0.5, 0.75, 1.0];
  const n = AXES.length;

  const spokes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    spokes.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }

  return (
    <div className="cx-cmp-section">
      <h3 className="cx-cmp-h">Feature coverage radar</h3>
      <div className="cx-cmp-sub">8 axes · 0–100 % subjective coverage · toggle apps below</div>
      <div className="cx-cmp-radar-wrap">
        <svg
          viewBox={"0 0 " + SIZE + " " + SIZE}
          className="cx-cmp-radar"
          preserveAspectRatio="xMidYMid meet"
        >
          {rings.map((k, i) => (
            <polygon
              key={"ring" + i}
              points={polygonPoints(AXES.map(() => k * 100), cx, cy, r)}
              fill="none"
              stroke="var(--cx-fg-dim, #888)"
              strokeOpacity={0.18}
              strokeWidth={1}
            />
          ))}
          {spokes.map((s, i) => (
            <line
              key={"sp" + i}
              x1={cx}
              y1={cy}
              x2={s.x}
              y2={s.y}
              stroke="var(--cx-fg-dim, #888)"
              strokeOpacity={0.18}
              strokeWidth={1}
            />
          ))}
          {APPS.map((a) => {
            if (!visible[a.id]) return null;
            const scores: number[] = RADAR[a.id] ?? [];
            return (
              <polygon
                key={a.id}
                points={polygonPoints(scores, cx, cy, r)}
                fill={a.color}
                fillOpacity={ready ? (a.id === "codex" ? 0.28 : 0.14) : 0}
                stroke={a.color}
                strokeWidth={a.id === "codex" ? 2.5 : 1.5}
                strokeOpacity={ready ? 1 : 0}
                style={{ transition: "fill-opacity 700ms ease, stroke-opacity 700ms ease" }}
              />
            );
          })}
          {AXES.map((lbl, i) => {
            const p = axisLabelPos(i, n, cx, cy, r);
            let anchor: "middle" | "end" | "start" = "middle";
            if (p.x < cx - 8) anchor = "end";
            else if (p.x > cx + 8) anchor = "start";
            return (
              <text
                key={"ax" + i}
                x={p.x}
                y={p.y}
                fontSize={11}
                fill="var(--cx-fg, #ddd)"
                textAnchor={anchor}
                dominantBaseline="middle"
                fontFamily="ui-monospace, Menlo, monospace"
              >
                {lbl}
              </text>
            );
          })}
        </svg>
        <div className="cx-cmp-radar-legend">
          {APPS.map((a) => {
            const isOn = !!visible[a.id];
            return (
              <button
                key={a.id}
                className={"cx-cmp-legend-btn" + (isOn ? " on" : "")}
                onClick={() => onToggle(a.id)}
                style={{
                  borderColor: a.color,
                  color: isOn ? a.color : "var(--cx-fg-dim, #888)",
                }}
              >
                <span
                  className="cx-cmp-legend-swatch"
                  style={{ background: a.color, opacity: isOn ? 1 : 0.25 }}
                />
                {a.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SentimentGrid ───────────────────────────────────────────────────────────
function SentimentGrid(): React.ReactElement {
  return (
    <div className="cx-cmp-section">
      <h3 className="cx-cmp-h">What people love · what frustrates them</h3>
      <div className="cx-cmp-sub">
        Aggregate sentiment from Reddit, App Store reviews, blog posts (2024-26)
      </div>
      <div className="cx-cmp-sent-grid">
        {APPS.map((a) => {
          const s = SENTIMENT[a.id];
          if (!s) return null;
          return (
            <div
              className="cx-cmp-sent-card"
              key={a.id}
              style={{ borderColor: a.color + "55" }}
            >
              <div className="cx-cmp-sent-name" style={{ color: a.color }}>
                {a.name}
              </div>
              <div className="cx-cmp-sent-cols">
                <div className="cx-cmp-sent-col cx-cmp-love">
                  <div className="cx-cmp-sent-h">♥ Beloved</div>
                  <ul>
                    {s.love.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="cx-cmp-sent-col cx-cmp-hate">
                  <div className="cx-cmp-sent-h">⊘ Frustration</div>
                  <ul>
                    {s.hate.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Roadmap ─────────────────────────────────────────────────────────────────
function Roadmap(): React.ReactElement {
  const items = [
    "Full Strong's coverage (~14,000 entries, Hebrew + Greek)",
    "Full Treasury of Scripture Knowledge cross-refs",
    "Capacitor native iOS / Android builds",
    "Linux Tauri desktop with system tray",
    "More translations from open sources (eBible.org corpus)",
    "Community-authored module marketplace v2",
  ];
  return (
    <div className="cx-cmp-section cx-cmp-roadmap">
      <h3 className="cx-cmp-h">{"→ Where CODEX is going"}</h3>
      <div className="cx-cmp-sub">Gaps we know about · roadmap excerpt</div>
      <ul className="cx-cmp-roadmap-list">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

// ── ShareButton ─────────────────────────────────────────────────────────────
function ShareButton(): React.ReactElement {
  const [label, setLabel] = useState("Share this matrix");

  function onClick(): void {
    const md = buildMarkdown();
    const done = (): void => {
      setLabel("Copied! Paste in Reddit / Discord");
      setTimeout(() => {
        setLabel("Share this matrix");
      }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(done, () => {
        setLabel("Copy failed");
      });
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = md;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch {
        setLabel("Copy failed");
      }
    }
  }

  return (
    <div className="cx-cmp-share">
      <button className="cx-cmp-share-btn" onClick={onClick}>
        {label}
      </button>
      <div className="cx-cmp-share-hint">
        Copies a Markdown table you can paste into any thread.
      </div>
    </div>
  );
}

// ── Sources ──────────────────────────────────────────────────────────────────
function Sources(): React.ReactElement {
  return (
    <div className="cx-cmp-sources">
      <strong>Sources: </strong>
      {"Data assembled from public marketing pages, Reddit / Twitter aggregate sentiment, "}
      {"App Store reviews, and GitHub stargraphs as of 2026-05. CODEX-favoring? "}
      {"Open the source — if a row is wrong, send a PR via "}
      <code>CONTRIBUTING.md</code>
      {"."}
    </div>
  );
}

// ── ComparePanel (root) ─────────────────────────────────────────────────────
// Exported as the plugin's render target. The panel context (`ctx`) is passed
// by CODEX_PLUGINS_API.register render() but is not consumed — mirrors the
// legacy behaviour where `ComparePanel` ignores its props.
export function ComparePanel(_ctx: Record<string, unknown> = {}): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    APPS.forEach((a) => {
      o[a.id] = true;
    });
    return o;
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !done) {
            done = true;
            setReady(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  function toggle(id: string): void {
    setVisible((v) => {
      const nx: Record<string, boolean> = {};
      for (const k in v) {
        nx[k] = v[k] ?? false;
      }
      nx[id] = !(nx[id] ?? false);
      return nx;
    });
  }

  return (
    <div className="cx-cmp-root" ref={rootRef}>
      <div className="cx-cmp-header">
        <h2 className="cx-cmp-title">How CODEX Compares</h2>
        <div className="cx-cmp-tag">Honest. Sourced. Open to PRs.</div>
      </div>
      <HeroStrip />
      <FeatureMatrix />
      <PriceChart ready={ready} />
      <RadarChart ready={ready} visible={visible} onToggle={toggle} />
      <SentimentGrid />
      <Roadmap />
      <ShareButton />
      <Sources />
    </div>
  );
}
