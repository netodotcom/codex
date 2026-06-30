// reader (soul) — THE READER (migrated verbatim from reader.jsx). The MAIN
// plugin: first chip on the dock, body of the desk's reader window, center
// column on mobile, and a floating MONAD window anywhere else. One component,
// every surface. A thin projection over the immortal engines (law 5).
//
// Props: surface · independent (pinned cursor — does NOT follow codex:now)
//        · initialNow {bookId, book, chapter, verse} · onNowChange(now)
import React from "react";
import { sw } from "./soul-window.js";
import type { SoulVerse, PanelData, GlossEntry, NowPos } from "./soul-window.js";
import { cxrTweaks, cxrSetTweak } from "./tweaks.js";
import {
  readerLoad,
  readerHighlights,
  READER_HL,
  READER_FONTS,
  type ReaderMarks,
} from "./source.js";
import { cxrGlossAnchor, CXR_OVERLAYS, type OverlayKey } from "./gloss.js";
import { CxrText, type Gold } from "./CxrText.js";
import { CxrGloss, type GlossItem } from "./CxrGloss.js";

const { useState, useEffect, useRef, useMemo } = React;

export interface CodexReaderXProps {
  surface?: string;
  independent?: boolean;
  initialNow?: NowPos;
  onNowChange?: (now: ReaderNow) => void;
}

// Resolved cursor — chapter is always present at runtime (the bus and seeds all
// carry it); the window boundary narrows external NowPos to this on entry.
interface ReaderNow {
  bookId: string;
  book?: string;
  chapter: number;
  verse?: number;
  ref?: string;
}

interface ReaderState {
  verses: SoulVerse[] | null;
  translation: string;
  fallback: boolean;
  loading: boolean;
  err: string | null;
}

interface GlossMap {
  ch: GlossItem[];
  [verse: string]: GlossItem[];
}

export function CodexReaderX({ surface, independent, initialNow, onNowChange }: CodexReaderXProps = {}): React.ReactElement {
  const cdx = sw().CODEX_DATA;
  const data = {
    books: (cdx && cdx.books) || [],
    translations: (cdx && cdx.translations) || [],
  };
  // Position: follow the app's cursor (window.CODEX_NOW + codex:now bus) —
  // unless this reader is INDEPENDENT (a pinned secondary reader).
  const [now, setNow] = useState<ReaderNow>(() => {
    // A provided seed wins the first paint: pinned readers (independent)
    // keep it forever; MONAD windows (ctx) start there then follow the bus.
    if (initialNow && initialNow.bookId) {
      const b = data.books.find((x) => x.id === initialNow.bookId);
      return { bookId: initialNow.bookId, book: (b && b.name) || initialNow.book || initialNow.bookId, chapter: initialNow.chapter || 1, verse: initialNow.verse || 1 };
    }
    const n = sw().CODEX_NOW;
    if (n && n.bookId) return n as ReaderNow;
    try {
      const loc = JSON.parse(localStorage.getItem("codex.passageLoc") || "null") as { bookId?: string; chapter?: number; verse?: number } | null;
      if (loc && loc.bookId) {
        const b = data.books.find((x) => x.id === loc.bookId);
        return { bookId: loc.bookId, book: b ? b.name : loc.bookId, chapter: loc.chapter || 1, verse: loc.verse || 1 };
      }
    } catch { /* bad cache — fall through */ }
    return { bookId: "jhn", book: "John", chapter: 1, verse: 1 };
  });
  const [primary, setPrimary] = useState<string>(() =>
    cxrTweaks().primaryTranslation
    || (sw().CODEX_DATA && sw().CODEX_DATA!.tweaks && sw().CODEX_DATA!.tweaks!.primaryTranslation)
    || "web");
  const [state, setState] = useState<ReaderState>({ verses: null, translation: primary, fallback: false, loading: true, err: null });
  const [redOn, setRedOn] = useState<boolean>(() => {
    const t = sw().CODEX_DATA && sw().CODEX_DATA!.tweaks;
    return t ? t.redLetter !== false : true;
  });
  const [fs, setFs] = useState<number>(() =>
    (sw().CODEX_DATA && sw().CODEX_DATA!.tweaks && sw().CODEX_DATA!.tweaks!.fontScale) || 19);
  const [marks, setMarks] = useState<ReaderMarks>(readerHighlights);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadSeq = useRef(0);

  // ── v11.3 SOUL state: overlays, the golden Name, panel companion. ─────
  const [ov, setOv] = useState<{ gnosis: boolean; talmud: boolean; comm: boolean }>(() => {
    const tw = cxrTweaks();
    return { gnosis: !!tw.overlayGnosis, talmud: !!tw.overlayTalmud, comm: !!tw.overlayCommentary };
  });
  const [gold, setGold] = useState<Gold>(() => {
    const tw = cxrTweaks();
    return { on: tw.divineGold !== false, hebrew: !!tw.divineHebrew };
  });
  // { data, late (arrived after the text — shimmer), loading }
  const [panelS, setPanelS] = useState<{ data: PanelData | null; late: boolean; loading: boolean }>({ data: null, late: false, loading: false });
  const [openGloss, setOpenGloss] = useState<Record<string, boolean>>({});
  const wantOv = ov.gnosis || ov.talmud || ov.comm;

  // Settings panel (or any agent) flips the same tweak keys → stay in sync.
  useEffect(() => {
    const onTweak = (e: Event) => {
      const d = ((e as CustomEvent).detail || {}) as Record<string, unknown>;
      if ("overlayGnosis" in d || "overlayTalmud" in d || "overlayCommentary" in d) {
        const tw = cxrTweaks();
        setOv({ gnosis: !!tw.overlayGnosis, talmud: !!tw.overlayTalmud, comm: !!tw.overlayCommentary });
      }
      if ("divineGold" in d || "divineHebrew" in d) {
        const tw = cxrTweaks();
        setGold({ on: tw.divineGold !== false, hebrew: !!tw.divineHebrew });
      }
    };
    window.addEventListener("tweakchange", onTweak);
    return () => window.removeEventListener("tweakchange", onTweak);
  }, []);

  const toggleOv = (k: OverlayKey) => {
    const def = CXR_OVERLAYS.find((o) => o.k === k);
    const next = !ov[k];
    setOv((o) => ({ ...o, [k]: next }));
    if (def) cxrSetTweak(def.tweak, next);
    if (next) {
      try {
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type: `${k}-read`, ref: `${now.bookId}.${now.chapter}.${now.verse || 1}`, weight: 2 },
        }));
      } catch { /* no window */ }
    }
  };

  // Bus: the app cursor moves → the reader follows (main reader only).
  // Primary changes ride the codex:primary event for every reader.
  useEffect(() => {
    const onNow = (e: Event) => { const n = (e as CustomEvent<NowPos>).detail || sw().CODEX_NOW; if (n && n.bookId) setNow(n as ReaderNow); };
    const onPrimary = (e: Event) => { const ce = e as CustomEvent<{ id?: string }>; const id = ce.detail && ce.detail.id; if (id) setPrimary(id); };
    const onMarks = () => setMarks(readerHighlights());
    if (!independent) window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:primary", onPrimary);
    window.addEventListener("codex:marks-changed", onMarks);
    window.addEventListener("storage", onMarks);
    return () => {
      if (!independent) window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:primary", onPrimary);
      window.removeEventListener("codex:marks-changed", onMarks);
      window.removeEventListener("storage", onMarks);
    };
  }, [independent]);

  // Independent readers report their pinned cursor up (window title, persistence).
  useEffect(() => {
    if (independent && typeof onNowChange === "function") {
      try { onNowChange(now); } catch { /* host hiccup */ }
    }
    // eslint-disable-next-line
  }, [independent, now.bookId, now.chapter, now.verse]);

  // Load the chapter whenever position/translation changes.
  useEffect(() => {
    let dead = false;
    const seq = ++loadSeq.current;
    setState((s) => ({ ...s, loading: true, err: null }));
    readerLoad(now.bookId, now.chapter, primary)
      .then((r) => {
        if (dead || seq !== loadSeq.current) return;
        setState({ verses: r.verses, translation: r.translation, fallback: r.fallback, loading: false, err: null });
      })
      .catch((e: unknown) => {
        if (dead || seq !== loadSeq.current) return;
        const msg = (e as { message?: string } | null)?.message;
        setState({ verses: null, translation: primary, fallback: false, loading: false, err: String(msg || e) });
      });
    return () => { dead = true; };
  }, [now.bookId, now.chapter, primary]);

  const book = data.books.find((b) => b.id === now.bookId);
  const bookName = (book && book.name) || now.book || now.bookId;
  const chapters = (book && book.chapters) || 1;

  // ── Panel companion: AI title + overlay glosses. Seeds and the
  // localStorage cache render instantly; otherwise we listen on the
  // CODEX_PANELS bus (the app pipeline generates for the main cursor) and —
  // when an overlay is ENGAGED for an un-companioned chapter (secondary
  // readers, cold caches) — trigger the existing pipeline ourselves.
  useEffect(() => {
    let dead = false;
    const P = sw().CODEX_PANELS;
    const cdxData = sw().CODEX_DATA;
    const seedMap = cdxData && cdxData.seedPanels;
    const seed = seedMap ? seedMap[`${now.bookId}.${now.chapter}`] : null;
    const cached = seed || (P && P.getCached ? P.getCached(now.bookId, now.chapter) : null);
    setPanelS({ data: cached || null, late: false, loading: false });
    setOpenGloss({});
    let unsub: (() => void) | null = null;
    if (P && P.subscribe) {
      unsub = P.subscribe((ev) => {
        if (dead || !ev || ev.bookId !== now.bookId || +(ev.chapter as number) !== +now.chapter) return;
        if (ev.type === "start") setPanelS((s) => ({ ...s, loading: true }));
        else if (ev.type === "done") setPanelS({ data: ev.data || null, late: true, loading: false });
        else if (ev.type === "error") setPanelS((s) => ({ ...s, loading: false }));
      });
    }
    if (!cached && wantOv && P && P.load) {
      const tw = cxrTweaks();
      setPanelS((s) => ({ ...s, loading: true }));
      P.load(now.bookId, now.chapter, bookName, { provider: tw.provider, model: tw.model })
        .then((d) => { if (!dead) setPanelS({ data: d, late: true, loading: false }); })
        .catch(() => { if (!dead) setPanelS((s) => ({ ...s, loading: false })); });
    }
    return () => { dead = true; if (unsub) unsub(); };
    // eslint-disable-next-line
  }, [now.bookId, now.chapter, wantOv]);

  // ── SCROLL-TO-TOP ON PAGE TURN (all form factors) — the human eye goes
  // to the first verse when the chapter changes; the machine must follow.
  const locKey = `${now.bookId}:${now.chapter}`;
  const prevLocRef = useRef(locKey);
  const needTopRef = useRef(false);
  useEffect(() => {
    if (prevLocRef.current === locKey) return;
    prevLocRef.current = locKey;
    needTopRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0; // no flash of the old position
  }, [locKey]);
  useEffect(() => {
    if (!needTopRef.current || state.loading) return;
    needTopRef.current = false;
    const el = scrollRef.current;
    if (!el || el.scrollTop === 0) return;
    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* no matchMedia */ }
    try { el.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }
    catch { el.scrollTop = 0; }
  }, [state.loading, state.verses]);

  // ── Touch: horizontal swipe on the scripture = chapter turn (the reader
  // keeps this gesture on every surface; vertical scroll always wins). ──
  const swipeNav = useRef<{ prev: () => void; next: () => void }>({ prev: () => {}, next: () => {} });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let x0 = 0, y0 = 0, t0 = 0, live = false;
    const start = (e: TouchEvent) => {
      const t = e.touches && e.touches[0];
      if (!t || (e.touches && e.touches.length > 1)) { live = false; return; }
      live = true; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
      if (dt > 600) return;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (dx < 0) swipeNav.current.next(); else swipeNav.current.prev();
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const go = (bookId: string, ch: number, v?: number) => {
    const b = data.books.find((x) => x.id === bookId);
    if (independent) {
      setNow({ bookId, book: (b && b.name) || bookId, chapter: ch, verse: v || 1 });
      return;
    }
    const w = sw();
    if (w.codexGoto) w.codexGoto(bookId, ch, v || 1);
    else if (w.codexJumpToRef) w.codexJumpToRef(`${(b && b.name) || bookId} ${ch}${v ? ":" + v : ""}`);
    else setNow({ bookId, book: (b && b.name) || bookId, chapter: ch, verse: v || 1 });
  };
  const prev = () => {
    if (now.chapter > 1) return go(now.bookId, now.chapter - 1);
    const i = data.books.findIndex((b) => b.id === now.bookId);
    const pb = data.books[i - 1];
    if (i > 0 && pb) go(pb.id, pb.chapters || 1);
  };
  const next = () => {
    if (now.chapter < chapters) return go(now.bookId, now.chapter + 1);
    const i = data.books.findIndex((b) => b.id === now.bookId);
    const nb = data.books[i + 1];
    if (i >= 0 && i < data.books.length - 1 && nb) go(nb.id, 1);
  };
  // feed the touch-swipe effect (stable ref, fresh closures)
  swipeNav.current = { prev, next };

  const selectVerse = (n: number) => {
    if (independent) { setNow((cur) => ({ ...cur, verse: n })); return; }
    const w = sw();
    if (w.codexSelectVerse) w.codexSelectVerse(n);
    else go(now.bookId, now.chapter, n);
  };
  const openMenu = (n: number, el: Element | null) => {
    selectVerse(n);
    const w = sw();
    if (!w.codexOpenVerseMenu || !el) return;
    const rect = el.getBoundingClientRect();
    if (independent) {
      // pinned readers carry their own location into the menu
      const v = (state.verses || []).find((x) => x.n === n);
      if (v) w.codexOpenVerseMenu(n, rect, { bookId: now.bookId, book: bookName, chapter: now.chapter, v });
      return;
    }
    w.codexOpenVerseMenu(n, rect);
  };
  // Double-tap (or double-click) a verse opens its menu without breaking
  // single-tap select — the first tap selects, a quick second tap opens.
  const lastTapRef = useRef<{ n: number; t: number }>({ n: 0, t: 0 });
  const tapVerse = (n: number, el: Element) => {
    const tNow = Date.now();
    const last = lastTapRef.current;
    if (last.n === n && tNow - last.t < 350) {
      lastTapRef.current = { n: 0, t: 0 };
      openMenu(n, el);
      return;
    }
    lastTapRef.current = { n, t: tNow };
    selectVerse(n);
  };

  const cycleFont = () => {
    const i = READER_FONTS.indexOf(fs);
    const v = READER_FONTS[(i + 1) % READER_FONTS.length] || 19;
    setFs(v);
    try { const td = sw().CODEX_DATA && sw().CODEX_DATA!.tweaks; if (td) td.fontScale = v; } catch { /* read-only data */ }
  };
  const toggleRed = () => setRedOn((v) => !v);

  const tr = state.translation;
  const trMeta = (data.translations || []).find((t) => t.id === tr);
  const verses = state.verses || [];

  // ── Distribute engaged-overlay glosses: verse-anchored where the data
  // names a verse, chapter-level margin presence otherwise. ──
  const glossMap = useMemo<GlossMap>(() => {
    const map: GlossMap = { ch: [] };
    const p = panelS.data;
    if (!p || !wantOv) return map;
    const last = verses.length ? verses[verses.length - 1] : undefined;
    const maxV = last ? last.n : 999;
    const add = (list: GlossEntry[] | undefined, ovKey: OverlayKey) => {
      (list || []).forEach((e, i) => {
        if (!e || (!e.body && !e.heading && !e.title)) return;
        const g: GlossItem = { ov: ovKey, e, key: `${ovKey}.${i}` };
        const n = cxrGlossAnchor(e, now.chapter, maxV);
        if (n) { (map[n] = map[n] || []).push(g); } else { map.ch.push(g); }
      });
    };
    if (ov.gnosis) add(p.gnosis, "gnosis");
    if (ov.talmud) add(p.talmud, "talmud");
    if (ov.comm) add(p.commentary, "comm");
    return map;
  }, [panelS.data, ov.gnosis, ov.talmud, ov.comm, verses, now.chapter, wantOv]);

  const toggleGloss = (key: string) => setOpenGloss((o) => ({ ...o, [key]: !o[key] }));
  const renderGlosses = (list: GlossItem[] | undefined): React.ReactElement[] => (list || []).map((g) => (
    <CxrGloss key={g.key} g={g} open={!!openGloss[g.key]} onToggle={() => toggleGloss(g.key)} />
  ));

  const titleTxt = (panelS.data && panelS.data.title) || `${bookName} ${now.chapter}`;
  const subTxt = (panelS.data && panelS.data.subtitle) || "";
  const tFn = sw().t;
  const redLabel = (tFn && tFn("reader.redletter")) || "RED-LETTER";

  return (
    <div className={`cxr ${surface ? "is-" + surface : ""} ${independent ? "is-pinned" : ""}`} style={{ "--cxr-fs": fs + "px" } as React.CSSProperties}>
      {/* ── bar: where am I, where next — nothing else ─────────────────── */}
      <header className="cxr-bar">
        <button className="cxr-nav" onClick={prev} aria-label="Previous chapter" title="Previous chapter (H)">‹</button>
        <button
          className="cxr-loc"
          onClick={independent ? undefined : () => { try { window.dispatchEvent(new CustomEvent("codex:open-library")); } catch { /* no window */ } const w = sw(); if (w.codexDesk) w.codexDesk.open("library"); }}
          title={independent ? "Pinned reader — its own cursor · navigate with ‹ ›" : "Open the library"}
        >
          <b>{bookName}</b>
          <i>{now.chapter}<small>/{chapters}</small></i>
        </button>
        <button className="cxr-nav" onClick={next} aria-label="Next chapter" title="Next chapter (L)">›</button>
        <span className="cxr-bar-gap" />
        <span className="cxr-ovs" role="group" aria-label="Reading overlays">
          {CXR_OVERLAYS.map((o) => (
            <button
              key={o.k}
              className={`cxr-chip cxr-chip-ov is-${o.k} ${ov[o.k] ? "is-on" : ""}`}
              data-ov={o.k}
              onClick={() => toggleOv(o.k)}
              aria-pressed={ov[o.k]}
              title={`${o.hint} — ${ov[o.k] ? "engaged · click to rest" : "click to engage"}`}
            >{o.glyph}</button>
          ))}
          {wantOv && panelS.loading ? <span className="cxr-orb" title="the layer is being drafted…" /> : null}
        </span>
        <button
          className={`cxr-chip cxr-chip-red ${redOn ? "is-on" : ""}`}
          onClick={toggleRed}
          aria-pressed={redOn}
          title={redOn ? "Words of Jesus painted red (from the WEB red-letter markup) — click to mute" : "Red letters muted — click to paint the words of Jesus"}
        ><i aria-hidden /><span>{redLabel}</span></button>
        <button className="cxr-chip" onClick={cycleFont} title={`Scripture size · ${fs}px`}>Aa</button>
        <button
          className="cxr-chip cxr-chip-tr"
          onClick={() => { try { const w = sw(); if (w.codexOpenPanel) w.codexOpenPanel("trans"); else window.dispatchEvent(new CustomEvent("codex:open-builtin-tab", { detail: { tabId: "trans" } })); } catch { /* no window */ } }}
          title={trMeta ? `${trMeta.name} (${trMeta.year || ""}) — click for translations` : "Translations"}
        >{(tr || "").toUpperCase()}</button>
      </header>

      {/* ── the workflow made visible: a book served from another corpus ── */}
      {state.fallback && !state.loading ? (
        <div className="cxr-served" role="note">
          ⇄ {bookName} is not in {(primary || "").toUpperCase()} — served from{" "}
          <b>{trMeta ? trMeta.name : tr.toUpperCase()}</b>
          <button className="cxr-served-keep" onClick={() => { const w = sw(); if (w.codexSetPrimary) w.codexSetPrimary(tr); }}
            title="Make this the primary translation">KEEP</button>
        </div>
      ) : null}

      {/* ── scripture — serif, serene, free of chrome (law 7) ──────────── */}
      <div className="cxr-scroll" ref={scrollRef}>
        {state.loading ? (
          <div className="cxr-status"><span className="cxr-pulse" aria-hidden />FETCHING {bookName.toUpperCase()} {now.chapter}…</div>
        ) : state.err ? (
          <div className="cxr-status is-err">
            <b>THE PAGE IS DARK</b>
            <code>{state.err}</code>
            <button onClick={() => go(now.bookId, now.chapter)}>↻ RETRY</button>
          </div>
        ) : (
          <div className="cxr-verses" style={{ fontSize: "var(--cxr-fs)" }}>
            {/* ── the AI page title — serif heading, shimmer-in when the
                title arrives after the text; book+chapter until then. ── */}
            <header className={`cxr-title ${panelS.late && panelS.data && panelS.data.title ? "is-arrived" : ""}`}>
              <h1 className="cxr-title-main">{titleTxt}</h1>
              <p className="cxr-title-sub">{subTxt || " "}</p>
            </header>
            {glossMap.ch.length ? (
              <div className="cxr-glosses-ch">{renderGlosses(glossMap.ch)}</div>
            ) : null}
            {wantOv && panelS.loading && !panelS.data ? (
              <div className="cxr-gloss-wait"><span className="cxr-orb" aria-hidden />THE LAYER IS BEING DRAFTED…</div>
            ) : null}
            {verses.map((v) => {
              const text = (v[tr] as string | undefined) || "";
              const isRed = redOn && (v._jesusVerse || (v.red && v.red[tr]));
              const mk = marks[`${now.bookId}.${now.chapter}.${v.n}`];
              const isCur = v.n === (now.verse || 0);
              const glosses = glossMap[v.n];
              return (
                <React.Fragment key={v.n}>
                  <div
                    data-vn={v.n}
                    tabIndex={0}
                    className={`cx-verse-row cxr-v ${isCur ? "is-hl" : ""} ${isRed ? "is-red" : ""} ${mk ? "has-mark" : ""}`}
                    style={mk ? { "--cxr-mark": READER_HL[mk.color ?? ""] || READER_HL.amber } as React.CSSProperties : undefined}
                    onClick={(e) => tapVerse(v.n, e.currentTarget)}
                    onContextMenu={(e) => { e.preventDefault(); openMenu(v.n, e.currentTarget); }}
                  >
                    <button
                      className="cxr-vn"
                      onClick={(e) => { e.stopPropagation(); openMenu(v.n, e.currentTarget); }}
                      aria-label={`Verse ${v.n} — open verse menu`}
                      title="Verse menu"
                    >{v.n}</button>
                    <CxrText text={text} gold={gold} />
                  </div>
                  {glosses ? renderGlosses(glosses) : null}
                </React.Fragment>
              );
            })}
            {!verses.length ? (
              <div className="cxr-status">NO VERSES — this chapter came back empty from every source.</div>
            ) : null}
            <footer className="cxr-end" aria-hidden>
              ✦ {bookName} {now.chapter} · {verses.length} vv · {(tr || "").toUpperCase()}
              {trMeta && trMeta.license ? ` · ${trMeta.license}` : ""}
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
