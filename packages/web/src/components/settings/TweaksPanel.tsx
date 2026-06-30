// settings — THE PANEL (migrated from tweaks-panel.jsx). One calm, searchable,
// grouped surface. Hosts the self-rendered controls (SelfControls), partitions
// host-provided children into groups, auto-surfaces unknown tweak keys, and
// keeps the host edit-mode protocol + app-wide open intents intact.
import React from "react";
import { TweakSection, TweakRadio, TweakSlider, TweakToggle, TweakSelect, TweakText, TweakNumber, TweakButton } from "./controls.js";
import { TweakContinuity } from "./TweakContinuity.js";
import { TweakPersonalization } from "./TweakPersonalization.js";
import { useTweaks } from "./useTweaks.js";
import { SETTINGS_GROUPS, SECTION_KW, groupForSection } from "./registry.js";
import { unknownTweaks, refreshSettingsIndex, type AutoEntry } from "./settings-index.js";
import { cxTweaksRead, cxTweaksWrite, type TweakMap } from "./store.js";
import { TWEAKS_STYLE } from "./style.js";
import { sw } from "./settings-window.js";
import type { Translation } from "../reader/types.js";

interface PanelWindow {
  CODEX_DATA?: { translations?: Translation[]; tweaks?: Record<string, unknown> };
  CODEX_TWEAK_DEFAULTS?: TweakMap;
  parent: { postMessage(msg: unknown, target: string): void };
}
function pw(): PanelWindow {
  return window as unknown as PanelWindow;
}

// Wrapper for every filterable row.
export function TwkItem({ kw, passive, children }: { kw?: string; passive?: boolean; children?: React.ReactNode }): React.ReactElement {
  return (
    <div className="twkx-item" data-kw={kw || ""} data-passive={passive ? "1" : "0"}>
      {children}
    </div>
  );
}

// Generic control for tweak keys this panel has never heard of.
export function AutoTweakRow({ entry }: { entry: AutoEntry }): React.ReactElement {
  const [v, setV] = React.useState<unknown>(() => {
    const s = cxTweaksRead();
    if (entry.key in s) return s[entry.key];
    const d = pw().CODEX_TWEAK_DEFAULTS || {};
    return entry.key in d ? d[entry.key] : entry.value;
  });
  React.useEffect(() => {
    const onChange = (e: Event): void => {
      const d = (e as CustomEvent<TweakMap>).detail || {};
      if (entry.key in d) setV(d[entry.key]);
    };
    window.addEventListener("tweakchange", onChange);
    return () => window.removeEventListener("tweakchange", onChange);
  }, [entry.key]);
  const write = (val: unknown): void => {
    setV(val);
    cxTweaksWrite({ [entry.key]: val });
  };
  if (typeof v === "boolean") return <TweakToggle label={entry.label} value={v} onChange={write} />;
  if (typeof v === "number") return <TweakNumber label={entry.label} value={v} onChange={(n) => write(n)} />;
  if (typeof v === "string") return <TweakText label={entry.label} value={v} onChange={write} />;
  return (
    <TweakRowFallback label={entry.label} value={String(v)} />
  );
}

function TweakRowFallback({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
        <span className="twk-val">{value}</span>
      </div>
      <p className="twkx-hint">registered tweak · no editor for this shape yet</p>
    </div>
  );
}

function applyFontPreview(v: number): void {
  try {
    const data = pw().CODEX_DATA;
    if (data && data.tweaks) data.tweaks["fontScale"] = v;
  } catch {
    /* ignore */
  }
  try {
    document.querySelectorAll<HTMLElement>(".cxr").forEach((el) => el.style.setProperty("--cxr-fs", v + "px"));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("codex:fontscale", { detail: { fontScale: v } }));
  } catch {
    /* ignore */
  }
}

// ── The panel's own (self-rendered) controls ────────────────────────────────
export function SelfControls({ group, t, setTweak }: { group: string; t: TweakMap; setTweak: (k: string | TweakMap, v?: unknown) => void }): React.ReactElement | null {
  const themeVal = t["autoTheme"] ? "auto" : t["manualDark"] ? "night" : "day";
  const setTheme = (v: string): void => {
    if (v === "auto") setTweak({ autoTheme: true });
    else setTweak({ autoTheme: false, manualDark: v === "night" });
  };
  const translations = pw().CODEX_DATA?.translations || [];

  if (group === "APPEARANCE") {
    return (
      <TwkItem kw="theme dark light night day auto solar lights appearance mode">
        <TweakRadio
          label="Theme"
          value={themeVal}
          options={[
            { value: "auto", label: "☉ AUTO" },
            { value: "day", label: "DAY" },
            { value: "night", label: "NIGHT" },
          ]}
          onChange={setTheme}
        />
        <p className="twkx-hint">Auto follows the sun at your hour — day pages, night glass.</p>
      </TwkItem>
    );
  }

  if (group === "SCRIPTURE") {
    return (
      <>
        <TwkItem kw="font size text scale scripture aa bigger smaller reader type">
          <TweakSlider
            label="Scripture size"
            value={Number(t["fontScale"]) || 22}
            min={16}
            max={30}
            step={1}
            unit="px"
            onChange={(v) => {
              setTweak("fontScale", v);
              applyFontPreview(v);
            }}
          />
          <p className="twkx-hint">Live — the reader behind repaints as you slide.</p>
        </TwkItem>
        <TwkItem kw="font face serif mono typeface family scripture">
          <TweakRadio
            label="Scripture face"
            value={(t["scriptureFont"] as string) || "serif"}
            options={[
              { value: "serif", label: "SERIF" },
              { value: "mono", label: "MONO" },
            ]}
            onChange={(v) => {
              setTweak("scriptureFont", v);
              try {
                const app = document.querySelector(".cx-app");
                if (app) {
                  app.classList.remove("font-serif", "font-mono");
                  app.classList.add("font-" + v);
                }
              } catch {
                /* ignore */
              }
            }}
          />
        </TwkItem>
        {translations.length > 0 && (
          <TwkItem kw="translation bible version primary kjv web text">
            <TweakSelect
              label="Primary translation"
              value={(t["primaryTranslation"] as string) || "kjv"}
              options={translations.map((x) => ({ value: x.id, label: x.name || x.id }))}
              onChange={(id) => {
                setTweak("primaryTranslation", id);
                try {
                  window.dispatchEvent(new CustomEvent("codex:primary", { detail: { id } }));
                } catch {
                  /* ignore */
                }
              }}
            />
          </TwkItem>
        )}
        <TwkItem kw="red letter words of jesus christ crimson">
          <TweakToggle label="Red-letter words of Jesus" value={t["redLetter"] !== false} onChange={(v) => setTweak("redLetter", v)} />
        </TwkItem>
        <TwkItem kw="side by side parallel two translations columns compare">
          <TweakToggle label="Side-by-side translations" value={!!t["sideBySide"]} onChange={(v) => setTweak("sideBySide", v)} />
        </TwkItem>
      </>
    );
  }

  if (group === "THE NAME") {
    return (
      <>
        <TwkItem kw="divine gold golden name covenant color reader yhwh tetragrammaton yahweh jehovah lord restore sacred">
          <TweakToggle label="The Name in covenant gold" value={t["divineGold"] !== false} onChange={(v) => setTweak("divineGold", v)} />
        </TwkItem>
        <TwkItem kw="divine hebrew tetragrammaton script reader yhwh">
          <TweakToggle label="Tetragrammaton in Hebrew (יהוה)" value={!!t["divineHebrew"]} onChange={(v) => setTweak("divineHebrew", v)} />
          <p className="twkx-hint">The reader renders the Name in its own script where the Hebrew carries it.</p>
        </TwkItem>
      </>
    );
  }

  if (group === "READING") {
    return (
      <>
        <TwkItem kw="distraction free focus zen hide chrome quiet theater">
          <TweakToggle label="Distraction-free reading" value={!!t["distractionFree"]} onChange={(v) => setTweak("distractionFree", v)} />
          <p className="twkx-hint">Only the Word on screen. Also: the ⊟ button in the footer, or F to focus.</p>
        </TwkItem>
        <TwkItem kw="overlay gnosis reader margin esoteric glyph">
          <TweakToggle label="Reader overlay · Gnosis" value={!!t["overlayGnosis"]} onChange={(v) => setTweak("overlayGnosis", v)} />
        </TwkItem>
        <TwkItem kw="overlay talmud reader margin rabbinic glyph">
          <TweakToggle label="Reader overlay · Talmud" value={!!t["overlayTalmud"]} onChange={(v) => setTweak("overlayTalmud", v)} />
        </TwkItem>
        <TwkItem kw="overlay commentary reader margin voices glyph">
          <TweakToggle label="Reader overlay · Commentary" value={!!t["overlayCommentary"]} onChange={(v) => setTweak("overlayCommentary", v)} />
          <p className="twkx-hint">Overlays paint quiet glyphs in the reader's margin — also togglable from the reader itself.</p>
        </TwkItem>
      </>
    );
  }

  if (group === "INSTRUMENTS") {
    return (
      <>
        <TwkItem kw="continuity streak engagement mastery analyst depth announcements cadence">
          <TweakContinuity />
        </TwkItem>
        <TwkItem kw="gnosis overlay esoteric ring engaged dormant" passive>
          <div className="twkx-note">
            ⟁ <b>Gnosis overlay</b> — lives on the master ring in the desk footer (DORMANT / ENGAGED). One tap there; it never hides in a menu.
          </div>
        </TwkItem>
      </>
    );
  }

  if (group === "SYSTEM") {
    return (
      <TwkItem kw="tour welcome replay onboarding first run">
        <TweakButton
          label="↻ Replay the welcome tour"
          secondary
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("codex:open-tour"));
            } catch {
              /* ignore */
            }
            try {
              window.dispatchEvent(new CustomEvent("codex:close-settings"));
            } catch {
              /* ignore */
            }
          }}
        />
      </TwkItem>
    );
  }

  if (group === "DANGER") {
    return (
      <TwkItem kw="personalization profile taste reels oracle context clear privacy">
        <TweakPersonalization />
      </TwkItem>
    );
  }

  return null;
}

interface Cluster {
  label: string;
  group: string;
  kw: string;
  items: React.ReactNode[];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
export function TweaksPanel({ title = "Settings", children }: { title?: string; noDeckControls?: boolean; children?: React.ReactNode }): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"settings" | "help">("settings");
  const [query, setQuery] = React.useState("");
  const [matchCount, setMatchCount] = React.useState<number | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [activeGroup, setActiveGroup] = React.useState(SETTINGS_GROUPS[0]);
  const [, forceTick] = React.useState(0);

  const [t, setTweak] = useTweaks(pw().CODEX_TWEAK_DEFAULTS || {});

  React.useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      const ty = (e as MessageEvent<{ type?: string }>).data?.type;
      if (ty === "__activate_edit_mode") setOpen(true);
      else if (ty === "__deactivate_edit_mode") setOpen(false);
    };
    window.addEventListener("message", onMsg);
    pw().parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    pw().parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
  }, []);

  React.useEffect(() => {
    const scrollToGroup = (g: string): void => {
      setTimeout(() => {
        try {
          const el = bodyRef.current?.querySelector(`[data-group="${g}"]`);
          if (el) el.scrollIntoView({ block: "start" });
        } catch {
          /* ignore */
        }
      }, 60);
    };
    const onOpen = (e: Event): void => {
      setOpen(true);
      refreshSettingsIndex();
      const sect = String((e as CustomEvent<{ section?: string }>).detail?.section || "").toLowerCase();
      if (!sect) {
        setMode("settings");
        return;
      }
      if (/help|wiki|doc/.test(sect)) {
        setMode("help");
        return;
      }
      setMode("settings");
      if (/api|ai|model|engine|infer|key/.test(sect)) scrollToGroup("AI & KEYS");
      else if (/name|yhwh/.test(sect)) scrollToGroup("THE NAME");
      else if (/scripture|font|translat/.test(sect)) scrollToGroup("SCRIPTURE");
      else if (/look|theme|appear/.test(sect)) scrollToGroup("APPEARANCE");
      else if (/read|mark|note/.test(sect)) scrollToGroup("READING");
      else if (/sync|cache|offline|data|export|import|install|lang|system/.test(sect)) scrollToGroup("SYSTEM");
    };
    const onClose = (): void => dismiss();
    window.addEventListener("codex:open-settings", onOpen);
    window.addEventListener("codex:close-settings", onClose);
    return () => {
      window.removeEventListener("codex:open-settings", onOpen);
      window.removeEventListener("codex:close-settings", onClose);
    };
  }, [dismiss]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (target.closest && target.closest("[data-tweaks-trigger]")) return;
      dismiss();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") dismiss();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, dismiss]);

  React.useEffect(() => {
    if (!open) return;
    refreshSettingsIndex();
    forceTick((n) => n + 1);
    setQuery("");
    const timer = setTimeout(() => {
      try {
        searchRef.current?.focus();
      } catch {
        /* ignore */
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [open, mode]);

  // ── live filter — plain words over label text + keyword aliases ─────
  React.useEffect(() => {
    if (!open || mode !== "settings") return;
    const body = bodyRef.current;
    if (!body) return;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const items = Array.from(body.querySelectorAll<HTMLElement>(".twkx-item"));
    if (!words.length) {
      items.forEach((el) => el.classList.remove("twkx-hide"));
      body.querySelectorAll(".twkx-sub").forEach((el) => el.classList.remove("twkx-hide"));
      body.querySelectorAll(".twkx-group").forEach((el) => el.removeAttribute("data-hidden"));
      setMatchCount(null);
      return;
    }
    const matches = (el: HTMLElement): boolean => {
      const hay = ((el.textContent || "") + " " + (el.getAttribute("data-kw") || "")).toLowerCase();
      return words.every((w) => hay.includes(w));
    };
    const vis = new Map<HTMLElement, boolean>();
    items.forEach((el) => vis.set(el, matches(el)));
    items.forEach((el, i) => {
      if (el.getAttribute("data-passive") !== "1" || vis.get(el)) return;
      const prev = items[i - 1];
      const next = items[i + 1];
      if ((prev && vis.get(prev)) || (next && vis.get(next))) vis.set(el, true);
    });
    let shown = 0;
    items.forEach((el) => {
      const on = !!vis.get(el);
      el.classList.toggle("twkx-hide", !on);
      if (on && el.getAttribute("data-passive") !== "1") shown++;
    });
    body.querySelectorAll<HTMLElement>(".twkx-group").forEach((g) => {
      const kids = Array.from(g.children);
      kids.forEach((k, i) => {
        if (!k.classList.contains("twkx-sub")) return;
        let any = false;
        for (let j = i + 1; j < kids.length; j++) {
          const kj = kids[j];
          if (!kj) break;
          if (kj.classList.contains("twkx-sub")) break;
          if (kj.classList.contains("twkx-item") && !kj.classList.contains("twkx-hide")) {
            any = true;
            break;
          }
        }
        k.classList.toggle("twkx-hide", !any);
      });
      const anyItem = g.querySelector(".twkx-item:not(.twkx-hide)");
      if (anyItem) g.removeAttribute("data-hidden");
      else g.setAttribute("data-hidden", "1");
    });
    setMatchCount(shown);
  }, [query, open, mode]);

  // Scroll-spy for the nav rail.
  React.useEffect(() => {
    if (!open || mode !== "settings") return;
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = (): void => {
      const groups = Array.from(body.querySelectorAll<HTMLElement>(".twkx-group"));
      let cur = groups[0];
      for (const g of groups) {
        if (g.getAttribute("data-hidden") === "1") continue;
        if (g.offsetTop - body.scrollTop <= 90) cur = g;
      }
      if (cur) setActiveGroup(cur.getAttribute("data-group") || SETTINGS_GROUPS[0]);
    };
    onScroll();
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, [open, mode]);

  if (!open) return null;

  // ── partition host children into groups, preserving section labels ──
  const childArr = React.Children.toArray(children);
  const clusters: Cluster[] = [];
  let cur: Cluster | null = null;
  for (const node of childArr) {
    if (React.isValidElement(node) && node.type === TweakSection) {
      const label = (node.props as { label: string }).label;
      cur = { label, group: groupForSection(label), kw: SECTION_KW[label] || "", items: [] };
      clusters.push(cur);
      continue;
    }
    if (!cur) {
      cur = { label: "", group: "SYSTEM", kw: "", items: [] };
      clusters.push(cur);
    }
    cur.items.push(node);
  }
  const clustersByGroup: Record<string, Cluster[]> = {};
  for (const g of SETTINGS_GROUPS) clustersByGroup[g] = [];
  for (const c of clusters) (clustersByGroup[c.group] || clustersByGroup["SYSTEM"])?.push(c);

  const unknown = unknownTweaks();
  const unknownByGroup: Record<string, AutoEntry[]> = {};
  for (const u of unknown) (unknownByGroup[u.group] = unknownByGroup[u.group] || []).push(u);

  const isPassiveNode = (node: React.ReactNode): boolean =>
    typeof node === "object" && node !== null && React.isValidElement(node) && typeof node.type === "string" && (node.type === "p" || node.type === "div");

  const switchMode = (m: "settings" | "help"): void => setMode(m);
  const jumpTo = (g: string): void => {
    setMode("settings");
    setTimeout(() => {
      try {
        const el = bodyRef.current?.querySelector<HTMLElement>(`[data-group="${g}"]`);
        if (el && bodyRef.current) bodyRef.current.scrollTo({ top: el.offsetTop - 8 });
      } catch {
        /* ignore */
      }
    }, 30);
  };

  const HelpWiki = sw().CODEX_HelpWiki;

  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      <div className="twkx-scrim" data-noncommentable="" onMouseDown={dismiss} />
      <div ref={panelRef} className="twkx-panel" data-noncommentable="" role="dialog" aria-modal="true" aria-label={title}>
        <div className="twkx-head">
          <span className="twkx-title">{title}</span>
          <div className="twkx-mode" role="tablist" aria-label="Settings or help">
            <button role="tab" aria-selected={mode === "settings"} onClick={() => switchMode("settings")}>
              SETTINGS
            </button>
            <button role="tab" aria-selected={mode === "help"} onClick={() => switchMode("help")}>
              HELP
            </button>
          </div>
          <span className="twkx-spacer" />
          <button className="twkx-x" aria-label="Close settings" onClick={dismiss}>
            ✕
          </button>
        </div>

        {mode === "help" ? (
          <div className="twkx-help-body">{HelpWiki ? <HelpWiki /> : <div className="twkx-empty">Help wiki loading…</div>}</div>
        ) : (
          <div className="twkx-shell">
            <nav className="twkx-nav" aria-label="Setting groups">
              {SETTINGS_GROUPS.map((g) => (
                <button key={g} className={(activeGroup === g ? "is-on " : "") + (g === "DANGER" ? "is-danger" : "")} onClick={() => jumpTo(g)}>
                  {g}
                </button>
              ))}
            </nav>
            <div className="twkx-main">
              <div className="twkx-search">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search settings — try 'dark', 'font', 'api key'…"
                  aria-label="Search settings"
                  spellCheck={false}
                />
                <span className="twkx-count" aria-live="polite">
                  {matchCount == null ? "" : matchCount === 0 ? "no matches" : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
                </span>
              </div>
              <div className="twkx-body" ref={bodyRef} role="region" aria-label="Settings">
                {SETTINGS_GROUPS.map((g) => (
                  <section key={g} className="twkx-group" data-group={g}>
                    <h2 className="twkx-group-h">{g}</h2>
                    <SelfControls group={g} t={t} setTweak={setTweak} />
                    {(clustersByGroup[g] || []).map((c, ci) => (
                      <React.Fragment key={`${g}-${ci}`}>
                        {c.label ? <div className="twkx-sub">{c.label}</div> : null}
                        {c.items.map((node, ni) => (
                          <TwkItem key={ni} kw={`${c.label} ${c.kw}`} passive={isPassiveNode(node)}>
                            {node}
                          </TwkItem>
                        ))}
                      </React.Fragment>
                    ))}
                    {(unknownByGroup[g] || []).map((u) => (
                      <TwkItem key={u.key} kw={`${u.kw} ${u.key} tweak`}>
                        <AutoTweakRow entry={u} />
                      </TwkItem>
                    ))}
                  </section>
                ))}
                {matchCount === 0 && <div className="twkx-empty">nothing matches “{query}” — try ‘theme’, ‘font’, ‘key’, ‘offline’…</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
