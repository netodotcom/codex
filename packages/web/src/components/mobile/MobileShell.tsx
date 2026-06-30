// mobile — React components (migrated faithful from mobile.jsx v12 THE PALM).
// MobileTrace · MobileOrb · MobileSheet · MobilePluginBody · MobilePalm ·
// CodexMobileShell. Zero logic changes; types added around the original shape.
import React from "react";
import {
  mobFreqLoad,
  mobFreqRecord,
  mobFreqScore,
  mobStreak,
  mobTrailRef,
  mobOrbPos,
  mobResolvePanel,
  mobSheetDrag,
  mobEdgeBack,
  mobPullToOmni,
  MOB_ORB_KEY,
} from "./helpers.js";
import { mw } from "./mobile-window.js";
import type { BuiltinWinEntry, CodexMobileShellProps } from "./mobile-window.js";

const { useState, useEffect, useRef, useCallback } = React;

// ── Sheet descriptor ──────────────────────────────────────────────────────
// SheetBase is what sheetFor returns; SheetDescriptor adds the key slot that
// openSheet computes and stores in the sheets array.
interface SheetBase {
  kind: string;
  id?: string;
  title: string;
  glyph: string;
}
interface SheetDescriptor extends SheetBase {
  key: string;
}

// ── GRIP launcher items ───────────────────────────────────────────────────
interface GripItem {
  id: string;
  glyph: string;
  label: string;
  open?: string;
  run?: () => void;
}
interface VerbItem {
  kind: string;
  glyph: string;
  label: string;
}
interface Candidate {
  id: string;
  glyph: string;
  label: string;
}

const MOB_GRIP: GripItem[] = [
  { id: "omni",    glyph: "⌘", label: "OMNI",    run: () => { if (mw().codexOpenOmni) mw().codexOpenOmni?.(); } },
  { id: "library", glyph: "☰", label: "SHELVES", open: "library" },
  { id: "oracle",  glyph: "◬", label: "ORACLE",  open: "oracle" },
  { id: "marks",   glyph: "✦", label: "MARKS",   open: "marks" },
  { id: "galaxy",  glyph: "❂", label: "GALAXY",  run: () => { if (mw().codexOpenConstellation) mw().codexOpenConstellation?.(); } },
];
const MOB_VERBS: VerbItem[] = [
  { kind: "sword",  glyph: "⚔", label: "SWORD" },
  { kind: "mirror", glyph: "⌬", label: "MIRROR" },
  { kind: "map",    glyph: "◎", label: "MAP" },
];

// ── THE TRACE — time · ◐, top-right, nearly transparent (tap to wake). ──
interface MobileTraceProps {
  dark?: boolean;
  onToggleTheme?: () => void;
}
function MobileTrace({ dark, onToggleTheme }: MobileTraceProps): React.ReactElement {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="cx-mtrace" role="toolbar" aria-label="System">
      <span className="cx-mtrace-time">{hh}:{mm}</span>
      <button
        className="cx-mtrace-btn"
        onClick={onToggleTheme}
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      >{dark ? "◐" : "◑"}</button>
    </div>
  );
}

// ── Orb touch state ───────────────────────────────────────────────────────
interface OrbTouchState {
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
  long: boolean;
  timer: number;
}

// ── THE ORB — the one piece of chrome. ──────────────────────────────────
interface MobileOrbProps {
  busy: boolean;
  streak: number;
  pos: "left" | "center" | "right";
  onPos: (p: "left" | "center" | "right") => void;
  onTap: () => void;
  onLongPress: () => void;
  hidden: boolean;
}
function MobileOrb({ busy, streak, pos, onPos, onTap, onLongPress, hidden }: MobileOrbProps): React.ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  const st = useRef<OrbTouchState | null>(null);

  const clearTimer = (): void => {
    if (st.current && st.current.timer) { clearTimeout(st.current.timer); st.current.timer = 0; }
  };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== undefined && e.button !== 0) return;
    const s: OrbTouchState = { x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: false, long: false, timer: 0 };
    st.current = s;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    s.timer = window.setTimeout(() => {
      if (st.current === s && !s.moved) { s.long = true; onLongPress(); }
    }, 550);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const s = st.current;
    if (!s || s.long) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.moved && Math.abs(dx) + Math.abs(dy) > 10) { s.moved = true; clearTimer(); }
    if (s.moved && ref.current) {
      // ride the bottom edge — horizontal only
      const w = window.innerWidth;
      const x = Math.max(36, Math.min(w - 36, e.clientX));
      ref.current.style.left = x + "px";
      ref.current.style.right = "auto";
      ref.current.style.transform = "translateX(-50%)";
    }
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const s = st.current;
    st.current = null;
    clearTimer();
    if (!s) return;
    if (s.long) return;            // long-press already fired
    if (s.moved) {
      const w = window.innerWidth || 1;
      const third: "left" | "center" | "right" = e.clientX < w / 3 ? "left" : e.clientX > (2 * w) / 3 ? "right" : "center";
      if (ref.current) { ref.current.style.left = ""; ref.current.style.right = ""; ref.current.style.transform = ""; }
      onPos(third);
      return;
    }
    onTap();
  };
  const onCancel = (): void => {
    st.current = null;
    clearTimer();
    if (ref.current) { ref.current.style.left = ""; ref.current.style.right = ""; ref.current.style.transform = ""; }
  };

  // streak arc: up to 30 days fills the ring
  const arc = streak > 0 ? Math.max(10, Math.min(1, streak / 30) * 151) : 0;
  return (
    <button
      ref={ref}
      className={`cx-orb is-${pos} ${busy ? "is-busy" : ""} ${hidden ? "is-tucked" : ""}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onTouchEnd={(e) => {
        // The orb acts on pointerup. Kill the browser's synthesized click —
        // it would land on whatever the palm just rendered under the thumb.
        if (e.cancelable) e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="CODEX — open the palm (hold for focus)"
      title="The palm — every tool (hold: focus)"
    >
      <svg className="cx-orb-ring" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="24" className="cx-orb-track" />
        {arc > 0 ? (
          <circle cx="28" cy="28" r="24" className="cx-orb-streak"
            strokeDasharray={`${arc} ${Math.max(0, 151 - arc)}`}
            transform="rotate(-90 28 28)" />
        ) : null}
      </svg>
      <span className="cx-orb-core" aria-hidden="true">✦</span>
    </button>
  );
}

// ── One full-screen sheet. ────────────────────────────────────────────────
interface MobileSheetProps {
  sheet: SheetDescriptor;
  isTop: boolean;
  canBack: boolean;
  onClose: () => void;
  onBack: () => void;
  children?: React.ReactNode;
}
function MobileSheet({ sheet, isTop, canBack, onClose, onBack, children }: MobileSheetProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLElement>(null);
  useEffect(() => mobSheetDrag(ref.current, headRef.current, onClose), [onClose]);
  useEffect(() => mobEdgeBack(ref.current, canBack ? onBack : onClose), [canBack, onBack, onClose]);
  return (
    <section
      ref={ref}
      className={`cx-sheet ${isTop ? "is-top" : "is-under"}`}
      role="dialog"
      aria-modal="true"
      aria-label={sheet.title}
      data-sheet={sheet.key}
    >
      <header className="cx-sheet-h" ref={headRef}>
        <span className="cx-sheet-grab" aria-hidden="true" />
        <div className="cx-sheet-row">
          <button className="cx-sheet-back" onClick={canBack ? onBack : onClose}
            aria-label={canBack ? "Back" : "Close"} title={canBack ? "Back" : "Close"}>‹</button>
          <span className="cx-sheet-glyph" aria-hidden="true">{sheet.glyph}</span>
          <b className="cx-sheet-title">{sheet.title}</b>
          <button className="cx-sheet-x" onClick={onClose} aria-label={`Close ${sheet.title}`} title="Close">×</button>
        </div>
      </header>
      <div className="cx-sheet-body">{children}</div>
    </section>
  );
}

// Plugin sheet body — same PluginPanelHost the desk windows mount, bound
// live to the reading cursor.
interface MobilePluginBodyProps {
  panelId: string;
}
function MobilePluginBody({ panelId }: MobilePluginBodyProps): React.ReactElement {
  const [now, setNow] = useState(() => mw().CODEX_NOW ?? null);
  useEffect(() => {
    const onNow = (e: Event): void => {
      const detail = (e as CustomEvent).detail as typeof now;
      setNow(detail ?? mw().CODEX_NOW ?? null);
    };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);
  const panel = mobResolvePanel(panelId);
  const Host = mw().PluginPanelHost;
  if (!panel || !Host) {
    return (
      <div className="cx-sheet-missing">
        <b>PANEL UNAVAILABLE</b>
        <p>{panel ? "host not loaded" : "this panel hasn't registered yet"}</p>
      </div>
    );
  }
  return (
    <Host
      panel={panel}
      book={now?.book}
      bookId={now?.bookId}
      chapter={(now?.chapter) || 1}
      verse={(now?.verse) || 1}
      translation={now?.translation || mw().CODEX_DATA?.tweaks?.primaryTranslation || "web"}
    />
  );
}

// ── THE PALM — the one door. ──────────────────────────────────────────────
interface MobilePalmProps {
  onClose: () => void;
  onOpenSheet: (spec: string) => boolean;
  builtinWin: Record<string, BuiltinWinEntry>;
}
function MobilePalm({ onClose, onOpenSheet, builtinWin }: MobilePalmProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLElement>(null);
  useEffect(() => mobSheetDrag(ref.current, headRef.current, onClose), [onClose]);

  const now = mw().CODEX_NOW;
  const ref0 = now?.ref || mobTrailRef();
  const trail = mobTrailRef();

  // panel registry — 8 builtins + every plugin panel (Dock v4's list).
  const builtinIds = Object.keys(builtinWin);
  let pluginPanels: Candidate[] = [];
  try {
    pluginPanels = ((mw().CODEX_PLUGINS_API && mw().CODEX_PLUGINS_API?.getPanels?.()) || [])
      .filter(p => !/^sys-/.test(p.pluginId)) // reader/shelves/oracle/marks live in the GRIP
      .map(p => ({ id: `plugin:${p.pluginId}:${p.id}`, glyph: p.glyph || "◆", label: String(p.label || p.id).toUpperCase() }));
  } catch {}

  // the hottest learned panel floats to the GRIP's right slot
  const freq = mobFreqLoad();
  const candidates: Candidate[] = [
    ...builtinIds.map((id): Candidate | null => {
      const entry = builtinWin[id];
      if (!entry) return null;
      return { id, glyph: entry.glyph, label: entry.title.split(" ")[0] ?? entry.title };
    }).filter((x): x is Candidate => x !== null),
    ...pluginPanels,
  ];
  let hot: Candidate | null = null;
  let hotScore = 0;
  for (const c of candidates) {
    const s = mobFreqScore(freq[c.id]);
    if (s > hotScore) { hot = c; hotScore = s; }
  }
  // const capture so TypeScript narrows `hot` correctly inside closures
  const hotPanel = hot;

  const openPanel = (id: string): void => {
    mobFreqRecord(id);
    onClose();
    if (mw().codexOpenPanel) mw().codexOpenPanel?.(id);
  };
  const verb = (kind: string): void => {
    if (!ref0) return;
    onClose();
    try { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind, ref: ref0 } })); } catch {}
  };

  return (
    <>
      <div className="cx-palm-scrim" onClick={onClose} aria-hidden="true" />
      <section className="cx-palm" role="dialog" aria-modal="true" aria-label="The palm" ref={ref}>
        <header className="cx-palm-head" ref={headRef}>
          <span className="cx-sheet-grab" aria-hidden="true" />
          {ref0 ? <span className="cx-palm-now">{ref0}</span> : <span className="cx-palm-now is-dim">THE PALM</span>}
        </header>

        <div className="cx-palm-grip" role="group" aria-label="Launchers">
          {MOB_GRIP.map(g => (
            <button key={g.id} className="cx-palm-launch" onClick={() => {
              onClose();
              if (g.open) onOpenSheet(g.open);
              else if (g.run) g.run();
            }} aria-label={g.label} title={g.label}>
              <i aria-hidden="true">{g.glyph}</i><span>{g.label}</span>
            </button>
          ))}
          {hotPanel ? (
            <button className="cx-palm-launch is-hot" onClick={() => openPanel(hotPanel.id)}
              aria-label={`${hotPanel.label} — your most-used panel`} title={`${hotPanel.label} — your most-used panel`}>
              <i aria-hidden="true">{hotPanel.glyph}</i><span>{hotPanel.label}</span>
            </button>
          ) : null}
        </div>

        <div className="cx-palm-verbs" role="group" aria-label="Verse actions">
          {MOB_VERBS.map(v => (
            <button key={v.kind} className="cx-palm-verb" disabled={!ref0}
              onClick={() => verb(v.kind)}
              title={ref0 ? `${v.label} — ${ref0}` : `${v.label} — open a verse first`}>
              <i aria-hidden="true">{v.glyph}</i><span>{v.label}</span>
            </button>
          ))}
          {trail ? (
            <button className="cx-palm-verb is-continue" onClick={() => {
              onClose();
              try { mw().codexJumpToRef?.(trail); } catch {}
            }} title={`Continue — ${trail}`}>
              <i aria-hidden="true">⟳</i><span>CONTINUE</span>
            </button>
          ) : null}
        </div>

        <div className="cx-palm-panels" role="group" aria-label="Panels">
          {builtinIds.map(id => {
            const entry = builtinWin[id];
            if (!entry) return null;
            return (
              <button key={id} className="cx-palm-chip" onClick={() => openPanel(id)} title={entry.title}>
                <i aria-hidden="true">{entry.glyph}</i><span>{entry.title}</span>
              </button>
            );
          })}
          {pluginPanels.map(p => (
            <button key={p.id} className="cx-palm-chip is-plugin" onClick={() => openPanel(p.id)} title={p.label}>
              <i aria-hidden="true">{p.glyph}</i><span>{p.label}</span>
            </button>
          ))}
          <button className="cx-palm-chip is-sys" data-tweaks-trigger
            onClick={() => { onClose(); try { window.postMessage({ type: "__activate_edit_mode" }, "*"); } catch {} }}
            title="Settings">
            <i aria-hidden="true">⚙</i><span>SETTINGS</span>
          </button>
        </div>
      </section>
    </>
  );
}

// ── THE SHELL ─────────────────────────────────────────────────────────────
export function CodexMobileShell({ builtinWin, builtinBody, busy, dark, onToggleTheme }: CodexMobileShellProps): React.ReactElement {
  const [sheets, setSheets] = useState<SheetDescriptor[]>([]);
  const [palm, setPalm] = useState(false);
  const [focus, setFocus] = useState(false);
  const [orbPos, setOrbPos] = useState<"left" | "center" | "right">(mobOrbPos);
  const [streak, setStreak] = useState(mobStreak);
  const readerWrapRef = useRef<HTMLDivElement>(null);
  const freeRef = useRef<boolean>(true); // no palm, no sheets → gestures own the Word

  const BW: Record<string, BuiltinWinEntry> = builtinWin || {};

  // normalize an open request to a sheet descriptor
  const sheetFor = useCallback((spec: string): SheetBase | null => {
    const s = String(spec || "");
    if (s === "library") return { kind: "library", title: "SHELVES", glyph: "☰" };
    if (s === "oracle")  return { kind: "oracle",  title: "ORACLE",  glyph: "◬" };
    if (s === "marks")   return { kind: "marks",   title: "MARKS",   glyph: "✦" };
    if (s.indexOf("builtin:") === 0) {
      const id = s.slice(8);
      const entry = BW[id];
      if (!entry) return null;
      return { kind: "builtin", id, title: entry.title, glyph: entry.glyph };
    }
    if (s.indexOf("plugin:") === 0) {
      const p = mobResolvePanel(s);
      return { kind: "plugin", id: s, title: String((p && p.label) || s.split(":").pop()).toUpperCase(), glyph: (p && p.glyph) || "◆" };
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BW]);

  const openSheet = useCallback((spec: string): boolean => {
    const d = sheetFor(spec);
    if (!d) return false;
    setPalm(false);
    setSheets(prev => {
      const key = d.kind + ":" + (d.id || "");
      const without = prev.filter(x => x.key !== key);
      const next = [...without, { ...d, key }];
      // max 2 deep — sheet over sheet swaps the first out
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
    return true;
  }, [sheetFor]);

  const closeTop = useCallback(() => setSheets(prev => prev.slice(0, -1)), []);
  const closeKey = useCallback((key: string) => setSheets(prev => prev.filter(s => s.key !== key)), []);
  const closeAll = useCallback(() => { setSheets([]); setPalm(false); }, []);

  // public router — app.jsx and the engines drive sheets through this
  useEffect(() => {
    mw().codexMobile = {
      on: () => true,
      open: (spec) => (spec === "palm" ? (setPalm(true), true) : openSheet(spec)),
      closeAll,
      focus: (v) => setFocus(f => (v === undefined ? !f : !!v)),
      state: () => ({ sheets: sheets.map(s => s.key), palm, focus, orb: orbPos }),
    };
    return () => { delete mw().codexMobile; };
  }, [openSheet, closeAll, sheets, palm, focus, orbPos]);

  // navigation closes the door — the palm remembers nothing open
  useEffect(() => {
    const onNav = (): void => { setSheets([]); setPalm(false); setStreak(mobStreak()); };
    window.addEventListener("codex:navigate", onNav);
    return () => window.removeEventListener("codex:navigate", onNav);
  }, []);

  // Esc — close palm, then the top sheet, then focus mode
  useEffect(() => {
    const onEsc = (): void => {
      if (palm) { setPalm(false); return; }
      if (sheets.length) { closeTop(); return; }
      if (focus) setFocus(false);
    };
    window.addEventListener("codex:escape", onEsc);
    return () => window.removeEventListener("codex:escape", onEsc);
  }, [palm, sheets.length, focus, closeTop]);

  // focus mode mirrors the desk's body class so instruments can react
  useEffect(() => {
    document.body.classList.toggle("cx-mfocus", !!focus);
    return () => document.body.classList.remove("cx-mfocus");
  }, [focus]);

  // pull-down-from-top on the Word = the omnibar
  freeRef.current = !palm && sheets.length === 0;
  useEffect(() => mobPullToOmni(readerWrapRef.current, () => freeRef.current), []);

  const setPos = useCallback((p: "left" | "center" | "right"): void => {
    setOrbPos(p);
    try { localStorage.setItem(MOB_ORB_KEY, p); } catch {}
  }, []);

  const bodyFor = (s: SheetDescriptor): React.ReactNode => {
    if (s.kind === "library") return mw().LibraryX ? React.createElement(mw().LibraryX!) : null;
    if (s.kind === "oracle")  return mw().OracleX ? React.createElement(mw().OracleX!) : null;
    if (s.kind === "marks")   return mw().MarksX ? React.createElement(mw().MarksX!) : null;
    if (s.kind === "builtin" && s.id) return builtinBody ? builtinBody(s.id) : null;
    if (s.kind === "plugin" && s.id)  return <MobilePluginBody panelId={s.id} />;
    return null;
  };

  return (
    <div className={`cx-mob ${focus ? "is-focus" : ""}`}>
      <div className="cx-mob-reader" ref={readerWrapRef}>
        {mw().CodexReaderX
          ? React.createElement(mw().CodexReaderX!, { surface: "mobile" })
          : <div className="cxr-status is-err"><b>READER PLUGIN MISSING</b><code>dist/reader.js failed to load</code></div>}
      </div>

      {!focus ? <MobileTrace dark={dark} onToggleTheme={onToggleTheme} /> : null}

      {sheets.map((s, i) => (
        <MobileSheet
          key={s.key}
          sheet={s}
          isTop={i === sheets.length - 1}
          canBack={sheets.length > 1 && i === sheets.length - 1}
          onClose={() => closeKey(s.key)}
          onBack={closeTop}
        >{bodyFor(s)}</MobileSheet>
      ))}

      {palm ? (
        <MobilePalm
          onClose={() => setPalm(false)}
          onOpenSheet={openSheet}
          builtinWin={BW}
        />
      ) : null}

      <MobileOrb
        busy={!!busy}
        streak={streak}
        pos={orbPos}
        onPos={setPos}
        onTap={() => setPalm(p => !p)}
        onLongPress={() => setFocus(f => !f)}
        hidden={palm}
      />
    </div>
  );
}
