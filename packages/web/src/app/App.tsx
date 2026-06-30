// app — the application shell / orchestrator (migrated from app.jsx). Owns the
// passage + marks + desk state, wires every window.codex* API and the runtime
// globals, handles global keyboard navigation, and renders the desk/mobile
// surfaces (the reader, panels, oracle, marks are window-provided plugins) plus
// the migrated Settings panel. Faithful port; two latent legacy bugs resolved:
// the dead onSelectMark/onClearMark/onMarkCurrent (one referenced an undefined
// setLeftOpen) are dropped, and the 'm' shortcut's bare book/chapter refs (a
// ReferenceError surviving only via Babel var-hoisting) now read `passage`.
import React from "react";
import { useTweaks } from "../components/settings/useTweaks.js";
import { useSolarClock } from "../components/reader/useSolarClock.js";
import { TweaksPanel } from "../components/settings/TweaksPanel.js";
import { TweakSection, TweakColor, TweakToggle, TweakSlider } from "../components/settings/controls.js";
import { AIModelSection } from "../components/settings/AIModelSection.js";
import { LightThemePicker } from "../components/settings/LightThemePicker.js";
import { DeskTrace, DeskWin, FooterBar, LangPicker } from "./chrome.js";
import { WelcomeTour, WelcomeBack } from "./welcome.js";
import { ToastDock } from "./toast.js";
import { ApiKeysSection } from "./ApiKeysSection.js";
import { SyncSection } from "./sync.js";
import { OfflineStatus, CachedPanelsBrowser, OfflineBiblesPanel } from "./offline.js";
import { parseRef } from "./parse-ref.js";
import { TWEAK_DEFAULTS, HIGHLIGHT_COLORS, ACCENT_MAP, type AppTweaks } from "./constants.js";
import { deskLoad, deskSave, deskPanelsLoad, deskPanelsSave, deskCapable, BUILTIN_WIN } from "./desk.js";
import { aw, tt, cxToast } from "./app-window.js";

const { useState, useEffect, useMemo, useRef, useCallback } = React;

interface AppVerse {
  n: number;
  [k: string]: unknown;
}
interface AppPassage {
  bookId: string;
  chapter: number;
  book: string;
  title: string;
  subtitle: string;
  verses: AppVerse[];
  loading: boolean;
  error: string | null;
}
interface PassageLoc {
  bookId: string;
  chapter: number;
  verse: number;
}
interface Highlight {
  color: string;
  ts: number;
  note: string;
}
interface VerseMenuState {
  verse: AppVerse;
  anchor: DOMRect;
  loc?: { bookId: string; book?: string; chapter: number };
}
interface ProviderRegState {
  available: boolean;
  models?: Array<{ id: string; label: string; tier?: string }>;
}
type PanelStatus = { loading: boolean; error: string | null };
type PanelMeta = { fromCache: boolean; fetchedAt: number; seed?: boolean; fresh?: boolean };

export function App(): React.ReactElement {
  const [tRaw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const t = tRaw as unknown as AppTweaks;
  useEffect(() => {
    aw().applyCodexLang?.(t.lang || "en");
  }, [t.lang]);
  useEffect(() => {
    aw().applyCodexDrift?.(!!t.hermeneuticDriftCompensation);
  }, [t.hermeneuticDriftCompensation]);
  const { now, solar, dark } = useSolarClock(!!t.autoTheme, !!t.manualDark);
  const data = aw().CODEX_DATA;

  const [primary, setPrimary] = useState(t.primaryTranslation);

  const [, _bumpTrans] = useState(0);
  useEffect(() => {
    const fn = (): void => _bumpTrans((n) => n + 1);
    window.addEventListener("codex:translations-changed", fn);
    return () => window.removeEventListener("codex:translations-changed", fn);
  }, []);

  const [availableProviders, setAvailableProviders] = useState<Record<string, ProviderRegState>>({
    anthropic: { available: false, models: [] },
    xai: { available: false, models: [] },
    groq: { available: false, models: [] },
    ollama: { available: false, models: [] },
  });
  useEffect(() => {
    const probe = (): Promise<void> =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d: { providers?: Record<string, ProviderRegState> }) => {
          if (d && d.providers) setAvailableProviders(d.providers);
        })
        .catch(() => {});
    void probe();
    const onChange = (): void => void probe();
    window.addEventListener("codex:engine-change", onChange);
    return () => window.removeEventListener("codex:engine-change", onChange);
  }, []);
  const [compareSet, setCompareSet] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("codex.compareSet");
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      /* ignore */
    }
    return ["web", "clementine"];
  });
  const [sideBySide, setSideBySide] = useState(!!t.sideBySide);
  const [redLetter, setRedLetter] = useState(!!t.redLetter);
  const [gnosisOn, setGnosisOn] = useState(false);
  const [currentVerse, _setCurrentVerse] = useState<number>(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) return (JSON.parse(raw) as PassageLoc).verse || 1;
    } catch {
      /* ignore */
    }
    return 1;
  });
  const setCurrentVerse = useCallback((n: number): void => {
    _setCurrentVerse(n);
    setPassageLoc((p) => ({ ...p, verse: n }));
  }, []);

  const [pluginVersion, setPluginVersion] = useState(0);
  void pluginVersion;
  useEffect(() => {
    const onReg = (): void => setPluginVersion((v) => v + 1);
    window.addEventListener("codex:plugin-registered", onReg);
    if (aw().CODEX_PLUGINS_API && aw().CODEX_PLUGINS_API!.list().length) setPluginVersion((v) => v + 1);
    return () => window.removeEventListener("codex:plugin-registered", onReg);
  }, []);

  const [schizoEligible, setSchizoEligible] = useState(false);

  const [panelData, setPanelData] = useState<Record<string, unknown> | null>(null);
  const [panelStatus, setPanelStatus] = useState<PanelStatus>({ loading: false, error: null });
  const [panelMeta, setPanelMeta] = useState<PanelMeta>({ fromCache: false, fetchedAt: 0 });
  const [disarmData, setDisarmData] = useState<Record<string, unknown> | null>(null);
  const [disarmStatus, setDisarmStatus] = useState<PanelStatus>({ loading: false, error: null });
  const [disarmMeta, setDisarmMeta] = useState<PanelMeta>({ fromCache: false, fetchedAt: 0 });

  const [passageLoc, setPassageLoc] = useState<PassageLoc>(() => {
    try {
      const raw = localStorage.getItem("codex.passageLoc");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PassageLoc>;
        return { verse: 1, bookId: data.defaultPassage.bookId, chapter: data.defaultPassage.chapter, ...parsed };
      }
    } catch {
      /* ignore */
    }
    return { bookId: data.defaultPassage.bookId, chapter: data.defaultPassage.chapter, verse: 1 };
  });
  const [passage, setPassage] = useState<AppPassage>({
    bookId: passageLoc.bookId,
    chapter: passageLoc.chapter,
    book: data.books.find((b) => b.id === passageLoc.bookId)?.name || "?",
    title: "",
    subtitle: "",
    verses: [],
    loading: true,
    error: null,
  });

  const showAchievements = useCallback((newlyUnlocked: Array<{ icon?: string; title?: string; desc?: string }> | undefined): void => {
    if (!newlyUnlocked || !newlyUnlocked.length) return;
    newlyUnlocked.forEach((a) => {
      if (!a) return;
      cxToast({ variant: "mark", icon: a.icon || "▦", label: "Achievement", title: a.title || "", desc: a.desc || "", kind: "ok" });
    });
  }, []);

  useEffect(() => {
    const on = !!(schizoEligible && t.schizo);
    document.body.classList.toggle("is-schizo", on);
    return () => {
      document.body.classList.toggle("is-schizo", false);
    };
  }, [schizoEligible, t.schizo]);

  useEffect(() => {
    const focused = passage.bookId === "act" && passage.chapter === 16 && currentVerse === 26;
    setSchizoEligible((prev) => {
      if (focused && !prev) {
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "⚯ a door opened in the settings panel", kind: "ok" } }));
        } catch {
          /* ignore */
        }
      }
      return focused;
    });
  }, [passage.bookId, passage.chapter, currentVerse]);

  const loadDisarmData = useCallback((bookId: string, chapter: number): void => {
    const seed = data.seedPanels[`${bookId}.${chapter}`];
    if (seed && seed.disarm) {
      setDisarmData(seed.disarm as Record<string, unknown>);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: true, fetchedAt: 0, seed: true });
      return;
    }
    const P = aw().CODEX_PANELS;
    if (!P?.loadDisarm) return;
    const cached = P.getDisarmCached(bookId, chapter);
    if (cached) {
      const meta = P.getDisarmMeta(bookId, chapter);
      setDisarmData(cached);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: true, fetchedAt: meta?.fetchedAt || 0 });
      return;
    }
    setDisarmData(null);
    setDisarmStatus({ loading: false, error: null });
    setDisarmMeta({ fromCache: false, fetchedAt: 0 });
  }, []);

  const loadPanelData = useCallback(
    async (bookId: string, chapter: number, bookName: string): Promise<void> => {
      loadDisarmData(bookId, chapter);
      const seed = data.seedPanels[`${bookId}.${chapter}`];
      if (seed) {
        setPanelData(seed);
        setPanelStatus({ loading: false, error: null });
        setPanelMeta({ fromCache: true, fetchedAt: 0, seed: true });
        return;
      }
      const P = aw().CODEX_PANELS!;
      const cached = P.getCached(bookId, chapter);
      if (cached) {
        const meta = P.getCachedMeta(bookId, chapter);
        setPanelData(cached);
        setPanelStatus({ loading: false, error: null });
        setPanelMeta({ fromCache: true, fetchedAt: meta?.fetchedAt || 0 });
        return;
      }
      setPanelData(null);
      setPanelStatus({ loading: true, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: 0 });
      try {
        const generated = await P.load(bookId, chapter, bookName, { provider: t.provider, model: t.model });
        setPanelData(generated);
        setPanelStatus({ loading: false, error: null });
        setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
      } catch (e) {
        setPanelStatus({ loading: false, error: String((e as Error).message || e) });
      }
    },
    [loadDisarmData],
  );

  const regenerateDisarm = useCallback(async (): Promise<void> => {
    const P = aw().CODEX_PANELS;
    if (!P?.loadDisarm) return;
    try {
      P.purgeDisarm(passage.bookId, passage.chapter);
    } catch {
      /* ignore */
    }
    setDisarmData(null);
    setDisarmStatus({ loading: true, error: null });
    setDisarmMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await P.loadDisarm({ passage, currentVerse, provider: t.provider, model: t.model, force: true });
      setDisarmData(generated);
      setDisarmStatus({ loading: false, error: null });
      setDisarmMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setDisarmStatus({ loading: false, error: String((e as Error).message || e) });
    }
  }, [passage, currentVerse, t.provider, t.model]);

  const regeneratePanels = useCallback(async (): Promise<void> => {
    const P = aw().CODEX_PANELS!;
    P.purge(passage.bookId, passage.chapter);
    setPanelData(null);
    setPanelStatus({ loading: true, error: null });
    setPanelMeta({ fromCache: false, fetchedAt: 0 });
    try {
      const generated = await P.load(passage.bookId, passage.chapter, passage.book, { force: true, provider: t.provider, model: t.model });
      setPanelData(generated);
      setPanelStatus({ loading: false, error: null });
      setPanelMeta({ fromCache: false, fetchedAt: Date.now(), fresh: true });
    } catch (e) {
      setPanelStatus({ loading: false, error: String((e as Error).message || e) });
    }
  }, [passage.bookId, passage.chapter, passage.book]);

  const loadPassage = useCallback(
    async (bookId: string, chapter: number, verse = 1): Promise<void> => {
      const book = data.books.find((b) => b.id === bookId);
      if (!book) return;
      const chap = Math.max(1, Math.min(chapter, book.chapters));
      try {
        const raw = localStorage.getItem("codex.lastChapter.v1");
        const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        map[bookId] = chap;
        localStorage.setItem("codex.lastChapter.v1", JSON.stringify(map));
      } catch {
        /* ignore */
      }
      setPassageLoc({ bookId, chapter: chap, verse });
      _setCurrentVerse(verse);
      setPassage((p) => ({ ...p, bookId, chapter: chap, book: book.name, verses: [], loading: true, error: null }));
      void loadPanelData(bookId, chap, book.name);
      try {
        const trs = Array.from(new Set([primary, ...compareSet]));
        const verses = (await aw().BIBLE.loadMulti(bookId, chap, trs)) as AppVerse[];
        const seed = data.seedPanels[`${bookId}.${chap}`];
        const cachedPanel = aw().CODEX_PANELS?.getCached(bookId, chap);
        const panel = (seed || cachedPanel) as { title?: string; subtitle?: string } | undefined;
        setPassage({ bookId, chapter: chap, book: book.name, title: panel?.title || `${book.name} ${chap}`, subtitle: panel?.subtitle || "", verses, loading: false, error: null });
        try {
          aw().CODEX_SEARCH?.ingestPassage?.({ bookId, chapter: chap, verses, primary });
        } catch {
          /* ignore */
        }
        try {
          const nextCh = chap + 1;
          if (nextCh <= (book.chapters || 0)) {
            const run = (): void => {
              try {
                aw().BIBLE.loadChapter(bookId, nextCh, primary)?.catch?.(() => {});
              } catch {
                /* ignore */
              }
            };
            if ("requestIdleCallback" in window) {
              (window as unknown as { requestIdleCallback(cb: () => void, opts?: { timeout: number }): void }).requestIdleCallback(() => setTimeout(run, 250), { timeout: 4000 });
            } else {
              setTimeout(run, 1200);
            }
          }
        } catch {
          /* ignore */
        }
      } catch (e) {
        setPassage((p) => ({ ...p, loading: false, error: String((e as Error).message || e) }));
      }
    },
    [primary, compareSet, loadPanelData],
  );

  useEffect(() => {
    const onLang = (): void => {
      if (passage.bookId && passage.chapter) void loadPanelData(passage.bookId, passage.chapter, passage.book);
    };
    window.addEventListener("codex:lang", onLang);
    return () => window.removeEventListener("codex:lang", onLang);
  }, [passage.bookId, passage.chapter, passage.book, loadPanelData]);

  useEffect(() => {
    if (!passage.book || !passage.chapter) return;
    const detail = { book: passage.book, bookId: passage.bookId, chapter: passage.chapter };
    try {
      window.dispatchEvent(new CustomEvent("codex:navigate", { detail }));
    } catch {
      /* ignore */
    }
    const E = aw().CODEX_ENGAGE;
    if (E) {
      E.trackChapter(passage.bookId, passage.chapter);
      E.saveSession(passage.bookId, passage.chapter, passage.book || "");
      const newAch = E.checkAchievements();
      if (newAch && newAch.length) showAchievements(newAch);
    }
    aw().CODEX_PLUGINS_API?.onNavigate(passage.book, passage.chapter);
  }, [passage.bookId, passage.chapter, passage.book]);

  useEffect(() => {
    if (!passage.book || !passage.chapter || !currentVerse) return;
    const ref = { book: passage.book, bookId: passage.bookId, chapter: passage.chapter, verse: currentVerse, translation: primary };
    try {
      window.dispatchEvent(new CustomEvent("codex:verse-select", { detail: { ref } }));
    } catch {
      /* ignore */
    }
    aw().CODEX_PLUGINS_API?.onVerseSelect(ref);
  }, [passage.bookId, passage.chapter, passage.book, currentVerse, primary]);

  useEffect(() => {
    if (!passage.book || !passage.chapter) return;
    try {
      const v = currentVerse || 1;
      aw().CODEX_NOW = { ref: `${passage.book} ${passage.chapter}:${v}`, book: passage.book, bookId: passage.bookId, chapter: passage.chapter, verse: v, translation: primary };
      window.dispatchEvent(new CustomEvent("codex:now", { detail: aw().CODEX_NOW }));
    } catch {
      /* ignore */
    }
  }, [passage.bookId, passage.chapter, passage.book, currentVerse, primary]);

  useEffect(() => {
    if (panelData && (!passage.title || passage.title === `${passage.book} ${passage.chapter}`)) {
      setPassage((p) => ({ ...p, title: (panelData["title"] as string) || p.title, subtitle: (panelData["subtitle"] as string) || p.subtitle }));
    }
  }, [panelData]);

  useEffect(() => {
    void loadPassage(passageLoc.bookId, passageLoc.chapter, passageLoc.verse || currentVerse || 1);
  }, [primary, JSON.stringify(compareSet)]);

  useEffect(() => {
    try {
      localStorage.setItem("codex.passageLoc", JSON.stringify(passageLoc));
    } catch {
      /* ignore */
    }
  }, [passageLoc]);

  const [highlights, setHighlights] = useState<Record<string, Highlight>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}") as Record<string, Highlight | string>;
      const migrated: Record<string, Highlight> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") migrated[k] = { color: v, ts: Date.now(), note: "" };
        else migrated[k] = v;
      }
      return migrated;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("codex.highlights.v1", JSON.stringify(highlights));
    } catch {
      /* ignore */
    }
  }, [highlights]);

  const toggleHighlight = useCallback(
    (bookId: string, chapter: number, n: number, color: string | null, verseText?: string): void => {
      const key = `${bookId}.${chapter}.${n}`;
      const c = color || t.highlightColor || "amber";
      setHighlights((h) => {
        const next = { ...h };
        const cur = next[key];
        if (cur && cur.color === c) {
          delete next[key];
        } else {
          next[key] = { color: c, ts: Date.now(), note: cur?.note || (verseText ? verseText.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ") + "…" : "") };
          aw().CODEX_ENGAGE?.trackHighlight();
        }
        return next;
      });
    },
    [t.highlightColor],
  );

  const clearHighlight = useCallback((bookId: string, chapter: number, n: number): void => {
    const key = `${bookId}.${chapter}.${n}`;
    setHighlights((h) => {
      const next = { ...h };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    const onAdd = (e: Event): void => {
      const detail = (e as CustomEvent<{ ref?: string; title?: string }>).detail;
      const ref = detail?.ref;
      if (typeof ref !== "string") return;
      const [bookId, ch, vn] = ref.split(".");
      const chapter = parseInt(ch ?? "", 10);
      const n = parseInt(vn ?? "", 10);
      if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(n)) return;
      setHighlights((h) => {
        const key = `${bookId}.${chapter}.${n}`;
        if (h[key]) return h;
        return { ...h, [key]: { color: t.highlightColor || "amber", ts: Date.now(), note: detail?.title || "" } };
      });
    };
    window.addEventListener("codex:bookmark-added", onAdd);
    return () => window.removeEventListener("codex:bookmark-added", onAdd);
  }, [t.highlightColor]);

  useEffect(() => {
    if (!(schizoEligible && t.schizo)) return undefined;
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = (node.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "=" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      const raw = window.prompt("⚯ Cipher search — gematria value:", "666");
      if (!raw) return;
      const n = parseInt(String(raw).replace(/^=/, "").trim(), 10);
      if (!Number.isFinite(n)) return;
      const idx = aw().CODEX_GEMATRIA_INDEX;
      const fire = (matches: Array<{ ref?: string; word?: string; system?: string }> | undefined): void => {
        window.dispatchEvent(new CustomEvent("codex:cipher-search", { detail: { value: n, matches } }));
        if (!matches || !matches.length) {
          cxToast(`⚯ No verses in your library sum to ${n}.`, "warn");
          return;
        }
        const preview = matches.slice(0, 8).map((m) => `• ${m.ref}  (${m.word} · ${m.system})`).join("\n");
        const go = window.confirm(`⚯ ${matches.length} match${matches.length === 1 ? "" : "es"} for ${n}\n\n${preview}\n\nJump to first match?`);
        if (!go) return;
        const ref = matches[0]?.ref || "";
        const [bookId, chStr, vStr] = ref.split(".");
        const ch = parseInt(chStr ?? "", 10);
        const vN = parseInt(vStr ?? "", 10);
        if (bookId && Number.isFinite(ch)) void loadPassage(bookId, ch, Number.isFinite(vN) ? vN : 1);
      };
      try {
        if (idx && idx.ensure) idx.ensure().then(() => fire(idx.find(n) || [])).catch(() => fire([]));
        else if (idx && idx.find) fire(idx.find(n) || []);
        else fire([]);
      } catch {
        fire([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [schizoEligible, t.schizo, loadPassage]);

  const PINS_KEY = "codex.marks.pinned.v1";
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  void pinnedSet;

  const marks = useMemo(() => {
    return Object.entries(highlights)
      .map(([key, v]) => {
        const [bookId, ch, n] = key.split(".");
        const book = data.books.find((b) => b.id === bookId);
        return {
          key,
          bookId: bookId ?? "",
          chapter: parseInt(ch ?? "", 10),
          verse: parseInt(n ?? "", 10),
          color: v.color || "amber",
          ts: v.ts || 0,
          note: v.note || "",
          ref: book ? `${book.name} ${ch}:${n}` : `${bookId} ${ch}:${n}`,
          pinned: pinnedSet.has(key),
        };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.ts - a.ts;
      });
  }, [highlights, data.books, pinnedSet]);

  const [verseMenu, setVerseMenu] = useState<VerseMenuState | null>(null);
  const openVerseMenu = useCallback((v: AppVerse, anchor: DOMRect): void => setVerseMenu({ verse: v, anchor }), []);
  const closeVerseMenu = useCallback(() => setVerseMenu(null), []);

  const [verseMap, setVerseMap] = useState<{ verse: AppVerse; refStr: string; text: string } | null>(null);
  const openVerseMap = useCallback((v: AppVerse, refStr: string, text: string): void => setVerseMap({ verse: v, refStr, text }), []);
  const closeVerseMap = useCallback(() => setVerseMap(null), []);

  const [verseArt, setVerseArt] = useState<{ verse: AppVerse; refStr: string; text: string } | null>(null);
  const openVerseArt = useCallback((v: AppVerse, refStr: string, text: string): void => setVerseArt({ verse: v, refStr, text }), []);
  const closeVerseArt = useCallback(() => setVerseArt(null), []);

  const [verseCompare, setVerseCompare] = useState<{ verse: AppVerse; refStr: string } | null>(null);
  const openVerseCompare = useCallback((v: AppVerse, refStr: string): void => setVerseCompare({ verse: v, refStr }), []);
  const closeVerseCompare = useCallback(() => setVerseCompare(null), []);

  const [verseMirror, setVerseMirror] = useState<{ verse: AppVerse; refStr: string; text: string } | null>(null);
  const openVerseMirror = useCallback((v: AppVerse, refStr: string, text: string): void => setVerseMirror({ verse: v, refStr, text }), []);
  const closeVerseMirror = useCallback(() => setVerseMirror(null), []);

  const [verseSword, setVerseSword] = useState<{ verse: AppVerse; refStr: string; text: string } | null>(null);
  const openVerseSword = useCallback((v: AppVerse, refStr: string, text: string): void => setVerseSword({ verse: v, refStr, text }), []);
  const closeVerseSword = useCallback(() => setVerseSword(null), []);

  const [constOpen, setConstOpen] = useState(false);
  useEffect(() => {
    aw().codexOpenConstellation = () => setConstOpen(true);
    return () => {
      delete aw().codexOpenConstellation;
    };
  }, []);

  const [omniOpen, setOmniOpen] = useState<boolean | { seed: string }>(false);
  useEffect(() => {
    aw().codexOpenOmni = (seed?: string) => setOmniOpen(typeof seed === "string" && seed ? { seed } : true);
    return () => {
      delete aw().codexOpenOmni;
    };
  }, []);

  useEffect(() => {
    if (!passage.bookId || !passage.chapter) return;
    try {
      const book = data.books.find((b) => b.id === passage.bookId);
      const ref = `${book ? book.name : passage.bookId} ${passage.chapter}`;
      const trail = JSON.parse(localStorage.getItem("codex.trail") || "[]") as Array<{ ref: string; at: number }>;
      if (trail.length && trail[trail.length - 1]?.ref === ref) return;
      trail.push({ ref, at: Date.now() });
      localStorage.setItem("codex.trail", JSON.stringify(trail.slice(-100)));
    } catch {
      /* ignore */
    }
  }, [passage.bookId, passage.chapter]);

  const [opsOpen, setOpsOpen] = useState<{ seed: string } | null>(null);
  const openOps = useCallback((seed?: string): void => setOpsOpen({ seed: seed || "" }), []);
  const closeOps = useCallback(() => setOpsOpen(null), []);
  useEffect(() => {
    aw().codexOpenOps = openOps;
    return () => {
      if (aw().codexOpenOps === openOps) delete aw().codexOpenOps;
    };
  }, [openOps]);

  useEffect(() => {
    const onOsOpen = (e: Event): void => {
      const { kind, ref } = (e as CustomEvent<{ kind?: string; ref?: string }>).detail || {};
      if (!kind || !ref) return;
      const p = parseRef(ref, data.books);
      if (!p) return;
      try {
        aw().codexJumpToRef?.(ref);
      } catch {
        /* ignore */
      }
      setTimeout(async () => {
        let text = "";
        try {
          const chData = await aw().BIBLE.loadChapter(p.bookId, p.chapter, primary);
          const vs = chData || [];
          const v = Array.isArray(vs) ? vs.find((x) => (x.verse || x.n) === p.verse) : null;
          text = v ? String(v.text || "").trim() : "";
        } catch {
          /* ignore */
        }
        const verse: AppVerse = { n: p.verse };
        const open = {
          map: () => openVerseMap(verse, ref, text),
          mirror: () => openVerseMirror(verse, ref, text),
          sword: () => openVerseSword(verse, ref, text),
          art: () => openVerseArt(verse, ref, text),
          compare: () => openVerseCompare(verse, ref),
        }[kind];
        if (open) open();
      }, 700);
    };
    window.addEventListener("codex:os-open", onOsOpen);
    return () => window.removeEventListener("codex:os-open", onOsOpen);
  }, [primary, openVerseMap, openVerseMirror, openVerseSword, openVerseArt, openVerseCompare]);

  const [installPrompt, setInstallPrompt] = useState<{ prompt(): void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const isIOS = useMemo(() => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent), []);
  useEffect(() => {
    const onPrompt = (e: Event): void => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt(): void; userChoice: Promise<{ outcome: string }> });
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const triggerInstall = useCallback(async (): Promise<void> => {
    if (installed) return;
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isIOS) {
      cxToast("Install on iPhone/iPad: tap Share (↑), then “Add to Home Screen”, then Add. CODEX runs full-screen and fully offline.", "info");
      return;
    }
    cxToast("No install prompt yet — refresh once or twice. CODEX installs in Chrome, Edge, Brave, Arc, Safari (iOS), and Samsung Internet.", "info");
  }, [installed, installPrompt, isIOS]);

  const SENSITIVE_PREFIXES = ["codex.api.keys", "codex.anthropic.key", "codex.sync.github.token", "codex.sync.firebase", "codex.btc.token", "codex.session.", "codex.oracle"];
  const isSensitive = (k: string): boolean => SENSITIVE_PREFIXES.some((p) => k.startsWith(p));

  const exportAll = useCallback(() => {
    const dataMap: Record<string, unknown> = {};
    let marksCount = 0;
    let panelsCount = 0;
    let biblesCount = 0;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("codex.")) continue;
      if (isSensitive(k)) continue;
      const raw = localStorage.getItem(k);
      try {
        dataMap[k] = JSON.parse(raw || "null");
      } catch {
        dataMap[k] = raw;
      }
      if (k === "codex.highlights.v1" && dataMap[k] && typeof dataMap[k] === "object") marksCount = Object.keys(dataMap[k] as object).length;
      if (k.startsWith("codex.panels.v1.")) panelsCount++;
      if (k.startsWith("codex.bible.")) biblesCount++;
    }
    const payload = {
      format: "codex.export",
      version: 1,
      app: "CODEX Bible Study",
      exportedAt: new Date().toISOString(),
      summary: { marks: marksCount, panels: panelsCount, bibleCacheBuckets: biblesCount, keys: Object.keys(dataMap).length },
      data: dataMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `codex-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, []);

  const importPick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (): Promise<void> => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const obj = JSON.parse(text) as { format?: string; data?: Record<string, unknown>; summary?: { marks?: number; panels?: number; keys?: number }; exportedAt?: string };
        if (obj.format !== "codex.export" || !obj.data || typeof obj.data !== "object") {
          cxToast("This isn't a CODEX export file (missing format/data).", "err");
          return;
        }
        const incoming = Object.keys(obj.data).filter((k) => k.startsWith("codex.") && !isSensitive(k));
        if (!incoming.length) {
          cxToast("Export contains no codex.* data.", "warn");
          return;
        }
        const summary = obj.summary ? `Marks: ${obj.summary.marks ?? "?"}\nPanels: ${obj.summary.panels ?? "?"}\nKeys: ${obj.summary.keys ?? incoming.length}` : `Keys: ${incoming.length}`;
        if (!window.confirm(`Import will REPLACE all current CODEX data:\n\n${summary}\n\nFrom: ${obj.exportedAt || "(unknown date)"}\n\nContinue?`)) return;
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("codex.") && !isSensitive(k)) localStorage.removeItem(k);
        }
        for (const k of incoming) {
          const v = obj.data[k];
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
        window.location.reload();
      } catch (e) {
        cxToast("Import failed: " + ((e as Error).message || e), "err");
      }
    };
    input.click();
  }, []);

  const [distractionFree, setDistractionFree] = useState(!!t.distractionFree);
  useEffect(() => {
    setDistractionFree(!!t.distractionFree);
  }, [t.distractionFree]);
  const toggleDistractionFree = useCallback(() => {
    const v = !distractionFree;
    setDistractionFree(v);
    setTweak("distractionFree", v);
  }, [distractionFree]);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const acquireLock = useCallback(async (): Promise<void> => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: string): Promise<WakeLockSentinel> } };
    if (!("wakeLock" in navigator) || wakeLockRef.current) return;
    try {
      const lock = await nav.wakeLock!.request("screen");
      lock.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
      wakeLockRef.current = lock;
    } catch {
      /* ignore */
    }
  }, []);
  const releaseLock = useCallback(async (): Promise<void> => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        /* ignore */
      }
      wakeLockRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (t.caffeinate) void acquireLock();
    else void releaseLock();
    return () => {
      void releaseLock();
    };
  }, [t.caffeinate]);
  useEffect(() => {
    const onVis = (): void => {
      if (t.caffeinate && document.visibilityState === "visible") void acquireLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [t.caffeinate]);

  const [deskMode, setDeskMode] = useState(deskCapable);
  useEffect(() => {
    const sync = (): void => setDeskMode(deskCapable());
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(min-width: 881px) and (pointer: fine)");
      mq.addEventListener("change", sync);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        mq?.removeEventListener("change", sync);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const [desk, setDesk] = useState(deskLoad);
  useEffect(() => {
    deskSave(desk);
    try {
      window.dispatchEvent(new CustomEvent("codex:desk", { detail: { ...desk } }));
    } catch {
      /* ignore */
    }
  }, [desk]);

  const [deskPanels, setDeskPanels] = useState<string[]>(deskPanelsLoad);
  useEffect(() => {
    deskPanelsSave(deskPanels);
    try {
      window.dispatchEvent(new CustomEvent("codex:desk-panels", { detail: { open: deskPanels.slice() } }));
    } catch {
      /* ignore */
    }
  }, [deskPanels]);
  const focusBuiltinWin = useCallback((id: string): void => {
    try {
      const bd = document.querySelector(`[data-wm-id="win:builtin:${id}"]`) as HTMLElement | null;
      if (bd) {
        bd.style.display = "";
        bd.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      }
    } catch {
      /* ignore */
    }
  }, []);
  const openBuiltinPanel = useCallback(
    (id: string): void => {
      if (!BUILTIN_WIN[id]) return;
      if (id === "gnosis") setGnosisOn(true);
      setDeskPanels((p) => {
        if (p.includes(id)) {
          focusBuiltinWin(id);
          return p;
        }
        return [...p, id];
      });
      requestAnimationFrame(() => focusBuiltinWin(id));
    },
    [focusBuiltinWin],
  );
  const closeBuiltinPanel = useCallback((id: string): void => {
    setDeskPanels((p) => p.filter((x) => x !== id));
  }, []);
  useEffect(() => {
    aw().codexDeskPanels = {
      on: () => deskMode,
      list: () => deskPanels.slice(),
      open: openBuiltinPanel,
      close: closeBuiltinPanel,
      toggle: (id: string) => {
        if (!BUILTIN_WIN[id]) return;
        if (deskPanels.includes(id)) closeBuiltinPanel(id);
        else openBuiltinPanel(id);
      },
    };
    return () => {
      delete aw().codexDeskPanels;
    };
  }, [deskMode, deskPanels, openBuiltinPanel, closeBuiltinPanel]);
  useEffect(() => {
    const onBuiltin = (e: Event): void => {
      const id = (e as CustomEvent<{ tabId?: string }>).detail?.tabId;
      if (!id || !BUILTIN_WIN[id]) return;
      if (deskMode) {
        openBuiltinPanel(id);
        return;
      }
      if (id === "gnosis") setGnosisOn(true);
      aw().codexMobile?.open("builtin:" + id);
    };
    window.addEventListener("codex:open-builtin-tab", onBuiltin);
    return () => window.removeEventListener("codex:open-builtin-tab", onBuiltin);
  }, [deskMode, openBuiltinPanel]);
  useEffect(() => {
    document.body.classList.toggle("cx-focus", !!(deskMode && desk.focus && desk.reader));
  }, [deskMode, desk.focus, desk.reader]);
  useEffect(() => {
    aw().codexDesk = {
      on: () => deskMode,
      state: () => ({ ...desk }),
      open: (k: string) => setDesk((d) => ({ ...d, [k]: true })),
      close: (k: string) => setDesk((d) => ({ ...d, [k]: false })),
      toggle: (k: string) => setDesk((d) => ({ ...d, [k]: !(d as unknown as Record<string, boolean>)[k] })),
      focus: (v?: boolean) => setDesk((d) => ({ ...d, focus: v === undefined ? !d.focus : !!v, reader: true })),
    };
    return () => {
      delete aw().codexDesk;
    };
  }, [deskMode, desk]);

  const [pinnedReaders, setPinnedReaders] = useState<Array<{ id: string; now: { bookId: string; book?: string; chapter: number; verse: number } }>>(() => {
    try {
      if (new URLSearchParams(window.location.search).get("surface")) return [];
    } catch {
      /* ignore */
    }
    try {
      const arr = JSON.parse(localStorage.getItem("codex.pinnedReaders.v1") || "null") as Array<{ id: string; now: { bookId: string; book?: string; chapter: number; verse: number } }> | null;
      if (Array.isArray(arr)) return arr.filter((p) => p && p.id && p.now && p.now.bookId).slice(0, 8);
    } catch {
      /* ignore */
    }
    return [];
  });
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("surface")) return;
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem("codex.pinnedReaders.v1", JSON.stringify(pinnedReaders));
    } catch {
      /* ignore */
    }
  }, [pinnedReaders]);
  useEffect(() => {
    aw().codexNewReader = (seed) => {
      const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const N = aw().CODEX_NOW;
      const src = seed && seed.bookId ? seed : N && N.bookId ? N : { bookId: "jhn", book: "John", chapter: 1, verse: 1 };
      setPinnedReaders((rs) => [...rs, { id, now: { bookId: src.bookId!, book: src.book, chapter: src.chapter || 1, verse: src.verse || 1 } }]);
      return id;
    };
    return () => {
      delete aw().codexNewReader;
    };
  }, []);
  const updatePinnedReader = useCallback((id: string, n: { bookId?: string; book?: string; chapter?: number; verse?: number }): void => {
    if (!n || !n.bookId) return;
    setPinnedReaders((rs) => {
      const i = rs.findIndex((p) => p.id === id);
      if (i < 0) return rs;
      const cur = rs[i]!.now || {};
      if (cur.bookId === n.bookId && cur.chapter === n.chapter && cur.verse === n.verse) return rs;
      const next = rs.slice();
      next[i] = { ...rs[i]!, now: { bookId: n.bookId!, book: n.book, chapter: n.chapter || 1, verse: n.verse || 1 } };
      return next;
    });
  }, []);
  const closePinnedReader = useCallback((id: string): void => {
    setPinnedReaders((rs) => rs.filter((p) => p.id !== id));
  }, []);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const kbdModalRef = useRef<HTMLDivElement>(null);
  const kbdReturnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (showShortcuts) {
      kbdReturnFocusRef.current = document.activeElement && document.activeElement !== document.body ? (document.activeElement as HTMLElement) : null;
      requestAnimationFrame(() => {
        const modal = kbdModalRef.current;
        if (!modal) return;
        const closeBtn = modal.querySelector(".cx-kbd-x") as HTMLElement | null;
        (closeBtn || modal).focus?.();
      });
    } else {
      const prev = kbdReturnFocusRef.current;
      kbdReturnFocusRef.current = null;
      if (prev && typeof prev.focus === "function" && document.contains(prev)) prev.focus();
    }
  }, [showShortcuts]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [xrefThread, setXrefThread] = useState<string[]>([]);
  const [wbDismissed, setWbDismissed] = useState(false);

  useEffect(() => {
    const E = aw().CODEX_ENGAGE;
    if (E) {
      const newAch = E.trackSession();
      if (newAch && newAch.length) showAchievements(newAch);
    }
  }, []);

  useEffect(() => {
    try {
      const eng = aw().CODEX_ENGAGEMENT;
      if (eng && typeof eng.setConfig === "function") {
        const n = Number(t.continuityThreshold);
        eng.setConfig({ dailyThreshold: n > 0 ? n : 1 });
      }
    } catch {
      /* ignore */
    }
  }, [t.continuityThreshold]);

  useEffect(() => {
    if (t.continuityEnabled === false) return;
    const tt2 = (k: string, f: string): string => {
      try {
        const v = aw().t && aw().t!(k);
        return v && v !== k ? v : f;
      } catch {
        return f;
      }
    };
    const onMilestone = (e: Event): void => {
      const d = (e as CustomEvent<{ label?: string; labelEn?: string; kind?: string; domain?: string }>).detail || {};
      const label = d.label || d.labelEn || "";
      if (d.kind === "mastery-level") {
        cxToast({ variant: "mark", icon: "▦", label: tt2("cx.mastery.title", "Mastery"), title: d.domain ? tt2("cx.domain." + d.domain, d.domain) : label || "", desc: label, kind: "ok" });
      } else if (d.kind === "quest-complete") {
        cxToast({ variant: "mark", icon: "✦", label: tt2("cx.quest.title", "Quest"), title: tt2("cx.quest.complete", "Closed"), desc: label, kind: "ok" });
      } else {
        cxToast({ variant: "mark", icon: "▦", label: tt2("cx.milestone.title", "Milestone"), title: label, desc: "", kind: "info" });
      }
    };
    const onTick = (e: Event): void => {
      const d = (e as CustomEvent<{ statusText?: string; status?: string; current?: number; streak?: number }>).detail || {};
      const statusText = d.statusText || d.status || tt2("cx.continuity.title", "Continuity");
      const current = d.current != null ? d.current : d.streak != null ? d.streak : "";
      cxToast({ variant: "mark", icon: "⌁", label: tt2("cx.continuity.title", "Continuity"), title: String(statusText), desc: current === "" ? "" : "streak " + current, kind: "info" });
    };
    window.addEventListener("codex:milestone", onMilestone);
    window.addEventListener("codex:continuity-tick", onTick);
    return () => {
      window.removeEventListener("codex:milestone", onMilestone);
      window.removeEventListener("codex:continuity-tick", onTick);
    };
  }, [t.continuityEnabled]);

  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    let firstRun = false;
    try {
      const seen = localStorage.getItem("codex.firstRun.v2") || localStorage.getItem("codex.firstRun.v1");
      firstRun = !seen;
      if (!localStorage.getItem("codex.firstRun.v2")) localStorage.setItem("codex.firstRun.v2", JSON.stringify({ completed: Date.now(), migrated: !firstRun }));
    } catch {
      /* ignore */
    }
    if (firstRun) {
      const id = setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "Welcome.  ≣ books · ⋮ study tools · tap any verse.", kind: "info" } }));
        } catch {
          /* ignore */
        }
      }, 1400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, []);
  useEffect(() => {
    const openTour = (): void => setTourOpen(true);
    window.addEventListener("codex:open-tour", openTour);
    return () => window.removeEventListener("codex:open-tour", openTour);
  }, []);
  const closeTour = useCallback(() => {
    try {
      localStorage.setItem("codex.firstRun.v2", JSON.stringify({ completed: Date.now() }));
    } catch {
      /* ignore */
    }
    setTourOpen(false);
  }, []);

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  useEffect(() => {
    const on = (): void => setIsOnline(true);
    const off = (): void => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ── Global keyboard navigation ──────────────────────────────────────────
  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (node.isContentEditable) return true;
      return false;
    };
    const flashVerse = (el: HTMLElement | null): void => {
      if (!el) return;
      el.classList.add("cx-kbd-flash");
      setTimeout(() => el.classList.remove("cx-kbd-flash"), 220);
    };
    const verseNodes = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(".cx-verse, .cx-verse-row"));
    const scrollToVerse = (dir: number): void => {
      const nodes = verseNodes();
      if (!nodes.length) return;
      const vnOf = (n: HTMLElement): number => Number(n.getAttribute("data-vn") || n.dataset?.["vn"]);
      let idx = nodes.findIndex((n) => vnOf(n) === currentVerse);
      if (idx < 0) {
        const mid = window.innerHeight / 2;
        let best = Infinity;
        idx = 0;
        nodes.forEach((n, i) => {
          const r = n.getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - mid);
          if (d < best) {
            best = d;
            idx = i;
          }
        });
      }
      const next = Math.max(0, Math.min(nodes.length - 1, idx + dir));
      const target = nodes[next];
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      flashVerse(target);
      const landed = vnOf(target);
      if (Number.isFinite(landed)) setCurrentVerse(landed);
    };
    const dispatchShortcut = (action: string): void => {
      window.dispatchEvent(new CustomEvent("codex:shortcut", { detail: { action } }));
    };
    const prevChapter = (): void => {
      if (passage.chapter > 1) void loadPassage(passage.bookId, passage.chapter - 1, 1);
      else {
        const idx = data.books.findIndex((b) => b.id === passage.bookId);
        if (idx > 0) void loadPassage(data.books[idx - 1]!.id, data.books[idx - 1]!.chapters, 1);
      }
    };
    const nextChapter = (): void => {
      const book = data.books.find((b) => b.id === passage.bookId);
      if (book && passage.chapter < book.chapters) void loadPassage(passage.bookId, passage.chapter + 1, 1);
      else {
        const idx = data.books.findIndex((b) => b.id === passage.bookId);
        if (idx >= 0 && idx < data.books.length - 1) void loadPassage(data.books[idx + 1]!.id, 1, 1);
      }
    };
    const overlayOwnsKeys = (): boolean => {
      if (searchOpen || showShortcuts || omniOpen || constOpen || verseMenu) return true;
      try {
        const m = aw().codexMobile;
        if (m) {
          const s = m.state();
          if (s.palm || (s.sheets && s.sheets.length)) return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };
    const reducedMotion = (): boolean => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    };
    const readerScroller = (): HTMLElement | null => document.querySelector(".cxr-scroll");
    const jumpEdgeVerse = (which: "first" | "last"): void => {
      const nodes = verseNodes();
      if (!nodes.length) return;
      const target = which === "first" ? nodes[0] : nodes[nodes.length - 1];
      if (!target) return;
      target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: which === "first" ? "start" : "end" });
      flashVerse(target);
      const vn = Number(target.getAttribute("data-vn") || target.dataset?.["vn"]);
      if (Number.isFinite(vn)) setCurrentVerse(vn);
    };

    const onKey = (e: KeyboardEvent): void => {
      const target = e.target;
      const typing = isTyping(target);

      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
          e.preventDefault();
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          e.preventDefault();
          return;
        }
        if (deskMode && desk.focus) {
          setDesk((d) => ({ ...d, focus: false }));
          e.preventDefault();
          return;
        }
        window.dispatchEvent(new CustomEvent("codex:escape"));
        setVerseMenu(null);
        return;
      }
      if (showShortcuts && e.key === "Tab" && kbdModalRef.current) {
        const modal = kbdModalRef.current;
        const focusables = Array.from(modal.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length) {
          const first = focusables[0]!;
          const last = focusables[focusables.length - 1]!;
          const active = document.activeElement;
          if (e.shiftKey && (active === first || !modal.contains(active))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
            e.preventDefault();
            first.focus();
          }
        } else {
          e.preventDefault();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOmniOpen((o) => !o);
        return;
      }

      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;
      if (k === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (k === "ArrowDown" || k === "ArrowUp") {
        if (overlayOwnsKeys()) return;
        e.preventDefault();
        scrollToVerse(k === "ArrowDown" ? +1 : -1);
        return;
      }
      if (k === "ArrowRight" || k === "ArrowLeft") {
        if (overlayOwnsKeys()) return;
        e.preventDefault();
        if (k === "ArrowRight") nextChapter();
        else prevChapter();
        return;
      }
      if (k === "PageDown" || k === "PageUp") {
        if (overlayOwnsKeys()) return;
        const sc = readerScroller();
        if (!sc) return;
        e.preventDefault();
        sc.scrollBy({ top: (k === "PageDown" ? 1 : -1) * Math.max(120, Math.round(sc.clientHeight * 0.85)), behavior: reducedMotion() ? "auto" : "smooth" });
        return;
      }
      if (k === "Home" || k === "End") {
        if (overlayOwnsKeys()) return;
        e.preventDefault();
        jumpEdgeVerse(k === "Home" ? "first" : "last");
        return;
      }
      if (k === "Enter") {
        const row = (target as HTMLElement | null)?.closest?.(".cx-verse, .cx-verse-row") as HTMLElement | null;
        if (row) {
          e.preventDefault();
          const n = Number(row.getAttribute("data-vn") || row.dataset?.["vn"]);
          const v = passage.verses.find((x) => x.n === n) || passage.verses.find((x) => x.n === currentVerse);
          if (v) openVerseMenu(v, row.getBoundingClientRect());
          return;
        }
      }
      if (/^[1-9]$/.test(k)) {
        const tabs = (aw().railTabs ? aw().railTabs!() : null) || [{ id: "trans" }, { id: "talmud" }, { id: "comm" }, { id: "gem" }, { id: "gnosis" }];
        const idx = Number(k) - 1;
        if (idx < tabs.length) {
          e.preventDefault();
          aw().codexOpenPanel?.(tabs[idx]!.id);
        }
        return;
      }

      switch (k) {
        case "j":
        case "J":
          e.preventDefault();
          scrollToVerse(+1);
          return;
        case "k":
        case "K":
          e.preventDefault();
          scrollToVerse(-1);
          return;
        case "h":
        case "H":
          e.preventDefault();
          prevChapter();
          return;
        case "l":
        case "L":
          e.preventDefault();
          nextChapter();
          return;
        case "o":
        case "O":
          e.preventDefault();
          if (deskMode) setDesk((d) => ({ ...d, oracle: !d.oracle, focus: false }));
          else aw().codexMobile?.open("oracle");
          dispatchShortcut("toggle-oracle");
          return;
        case "b":
        case "B":
          e.preventDefault();
          if (deskMode) setDesk((d) => ({ ...d, marks: !d.marks, focus: false }));
          else aw().codexMobile?.open("marks");
          dispatchShortcut("toggle-bookmarks");
          return;
        case "n":
        case "N": {
          e.preventDefault();
          let visible = false;
          try {
            visible = localStorage.getItem("codex.notes.visible") === "1";
            localStorage.setItem("codex.notes.visible", visible ? "0" : "1");
          } catch {
            /* ignore */
          }
          if (!t.notesEnabled) setTweak("notesEnabled", true);
          window.dispatchEvent(new CustomEvent("codex:notes:toggle"));
          dispatchShortcut("toggle-notes");
          return;
        }
        case "m":
        case "M":
          e.preventDefault();
          if (verseMap) {
            closeVerseMap();
          } else {
            // (legacy referenced bare book/chapter here — a ReferenceError that
            // only survived via Babel var-hoisting; resolved to `passage`.)
            const cv = currentVerse || 1;
            const bk = data.books.find((b) => b.id === passage.bookId);
            const bookName = bk?.name || passage.book;
            const refStr = `${bookName} ${passage.chapter}:${cv}`;
            openVerseMap({ n: cv }, refStr, "");
          }
          dispatchShortcut("toggle-map");
          return;
        case "t":
        case "T":
          e.preventDefault();
          if (deskMode) {
            aw().codexDeskPanels?.toggle("trans");
            setDesk((d) => (d.focus ? { ...d, focus: false } : d));
          } else {
            aw().codexMobile?.open("builtin:trans");
          }
          dispatchShortcut("open-translations");
          return;
        case "s":
        case "S": {
          e.preventDefault();
          const v = !sideBySide;
          setSideBySide(v);
          setTweak("sideBySide", v);
          return;
        }
        case "f":
        case "F":
          e.preventDefault();
          if (deskMode) setDesk((d) => ({ ...d, focus: !d.focus, reader: true }));
          else aw().codexMobile?.focus();
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showShortcuts, searchOpen, passage, currentVerse, sideBySide, gnosisOn, data, loadPassage, openVerseMenu, t.notesEnabled, deskMode, desk.focus, omniOpen, constOpen, verseMenu]);

  useEffect(() => {
    setPrimary(t.primaryTranslation);
  }, [t.primaryTranslation]);
  useEffect(() => {
    setSideBySide(!!t.sideBySide);
  }, [t.sideBySide]);
  useEffect(() => {
    setRedLetter(!!t.redLetter);
  }, [t.redLetter]);
  useEffect(() => {
    try {
      localStorage.setItem("codex.compareSet", JSON.stringify(compareSet));
    } catch {
      /* ignore */
    }
  }, [compareSet]);

  const onToggleCompare = useCallback((id: string): void => {
    setCompareSet((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const jumpToRef = useCallback(
    (refStr: string): void => {
      const loc = parseRef(refStr, data.books);
      if (loc) void loadPassage(loc.bookId, loc.chapter, loc.verse);
    },
    [data.books, loadPassage],
  );

  useEffect(() => {
    aw().codexJumpToRef = jumpToRef;
  }, [jumpToRef]);
  useEffect(() => {
    aw().codexSelectVerse = (n: number) => {
      if (Number.isFinite(n)) setCurrentVerse(n);
    };
    return () => {
      delete aw().codexSelectVerse;
    };
  }, []);
  useEffect(() => {
    aw().codexGoto = (bookId: string, ch?: number, v?: number) => {
      if (!bookId) return;
      void loadPassage(bookId, ch || 1, v || 1);
    };
    return () => {
      delete aw().codexGoto;
    };
  }, [loadPassage]);
  useEffect(() => {
    aw().codexOpenVerseMenu = (n: number, rect: DOMRect, loc?: { v?: number; bookId?: string; book?: string; chapter?: number }) => {
      if (loc && loc.v && rect) {
        setVerseMenu({ verse: { n: loc.v }, anchor: rect, loc: { bookId: loc.bookId ?? "", book: loc.book, chapter: loc.chapter ?? 1 } });
        return;
      }
      const v = passage.verses.find((x) => x.n === n);
      if (v && rect) openVerseMenu(v, rect);
    };
    return () => {
      delete aw().codexOpenVerseMenu;
    };
  }, [passage.verses, openVerseMenu]);
  useEffect(() => {
    const reload = (): void => {
      try {
        const raw = JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}") as Record<string, Highlight>;
        setHighlights((h) => (JSON.stringify(h) === JSON.stringify(raw) ? h : raw));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("codex:marks-changed", reload);
    return () => window.removeEventListener("codex:marks-changed", reload);
  }, []);

  useEffect(() => {
    const onJump = (e: Event): void => {
      const r = (e as CustomEvent<{ ref?: string }>).detail?.ref;
      if (r) jumpToRef(r);
    };
    window.addEventListener("codex:jump-ref", onJump);
    return () => window.removeEventListener("codex:jump-ref", onJump);
  }, [jumpToRef]);

  const scrollAndFlash = useCallback((n: number): void => {
    try {
      const sel = `.cx-verse[data-vn='${n}'], .cx-verse-row[data-vn='${n}']`;
      const el = (document.querySelector(sel) || document.querySelector(".cx-verse.is-hl, .cx-verse-row.is-hl")) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("cx-kbd-flash");
      setTimeout(() => el.classList.remove("cx-kbd-flash"), 220);
    } catch {
      /* ignore */
    }
  }, []);

  const parseKeyVerse = (key: string): number => {
    const parts = String(key || "").split(".");
    const v = parseInt(parts[2] ?? "", 10);
    return Number.isFinite(v) ? v : 1;
  };
  const keyToRef = useCallback(
    (key: string): string | null => {
      const parts = String(key || "").split(".");
      const bookId = (parts[0] || "").toLowerCase();
      const ch = parseInt(parts[1] ?? "", 10);
      const v = parseInt(parts[2] ?? "", 10);
      if (!bookId || !Number.isFinite(ch)) return null;
      const book = (data.books || []).find((b) => b.id === bookId);
      if (!book) return null;
      return `${book.name} ${ch}${Number.isFinite(v) ? ":" + v : ""}`;
    },
    [data.books],
  );
  useEffect(() => {
    const onXrefJump = (e: Event): void => {
      const d = (e as CustomEvent<{ key?: string; ref?: string; push?: boolean }>).detail || {};
      const key = d.key || "";
      if (!key) return;
      if (d.push !== false) setXrefThread((prev) => [...prev, key]);
      const ref = d.ref || keyToRef(key);
      if (ref) {
        try {
          window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref, source: "xref" } }));
        } catch {
          /* ignore */
        }
      }
      requestAnimationFrame(() => scrollAndFlash(parseKeyVerse(key)));
    };
    const onXrefBack = (): void => {
      setXrefThread((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice(0, -1);
        const top = next.length ? next[next.length - 1]! : null;
        if (top) {
          const ref = keyToRef(top);
          if (ref) {
            try {
              window.dispatchEvent(new CustomEvent("codex:jump-ref", { detail: { ref, source: "xref" } }));
            } catch {
              /* ignore */
            }
          }
          requestAnimationFrame(() => scrollAndFlash(parseKeyVerse(top)));
        }
        return next;
      });
    };
    window.addEventListener("codex:xref-jump", onXrefJump);
    window.addEventListener("codex:xref-back", onXrefBack);
    return () => {
      window.removeEventListener("codex:xref-jump", onXrefJump);
      window.removeEventListener("codex:xref-back", onXrefBack);
    };
  }, [scrollAndFlash, keyToRef]);

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("codex:xref-thread", { detail: { thread: xrefThread } }));
    } catch {
      /* ignore */
    }
  }, [xrefThread]);

  useEffect(() => {
    const onOpen = (): void => {
      if (deskMode) setDesk((d) => (d.library ? d : { ...d, library: true, focus: false }));
      else aw().codexMobile?.open("library");
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent("codex:focus-lib-search"));
        } catch {
          /* ignore */
        }
      }, 60);
    };
    window.addEventListener("codex:open-library", onOpen);
    return () => window.removeEventListener("codex:open-library", onOpen);
  }, [deskMode]);

  useEffect(() => {
    const onOpenPanel = (e: Event): void => {
      const d = (e as CustomEvent<{ panelId?: string; pluginId?: string; ctx?: { verse?: number; ref?: { verse?: number; bookId?: string; chapter?: number }; bookId?: string; chapter?: number } }>).detail || {};
      let id = d.panelId || "";
      if (!id) return;
      if (!d.pluginId && BUILTIN_WIN[id]) {
        const vb = d.ctx && (d.ctx.verse || (d.ctx.ref && d.ctx.ref.verse));
        if (vb) setCurrentVerse(vb);
        if (deskMode && aw().codexDeskPanels) {
          aw().codexDeskPanels!.open(id);
          return;
        }
        if (!deskMode) {
          if (id === "gnosis") setGnosisOn(true);
          aw().codexMobile?.open("builtin:" + id);
          return;
        }
        return;
      }
      if (d.pluginId && id.indexOf(":") === -1) id = `${d.pluginId}:${id}`;
      if (id.indexOf("plugin:") !== 0) id = `plugin:${id}`;
      const v = d.ctx && (d.ctx.verse || (d.ctx.ref && d.ctx.ref.verse));
      if (v) setCurrentVerse(v);
      if (id === "plugin:crossrefs-tsk:crossrefs") {
        const c = (d.ctx && (d.ctx.ref || d.ctx)) || {};
        const bId = c.bookId;
        const ch = c.chapter;
        const vn = (c as { verse?: number }).verse;
        if (bId && ch) setXrefThread([`${String(bId).toLowerCase()}.${ch}.${vn || 1}`]);
      }
      if (deskMode && aw().codexOpenWindow) {
        const glyph = (aw().CODEX_PLUGINS_API?.getPanels?.() || []).find((p) => `plugin:${p.pluginId}:${p.id}` === id)?.glyph;
        if (aw().codexOpenWindow!({ id, glyph })) return;
      }
      if (!deskMode) aw().codexMobile?.open(id);
    };
    window.addEventListener("codex:open-panel", onOpenPanel);
    return () => window.removeEventListener("codex:open-panel", onOpenPanel);
  }, [deskMode]);

  useEffect(() => {
    const onCloseRails = (): void => {
      aw().codexMobile?.closeAll();
    };
    window.addEventListener("codex:close-rails", onCloseRails);
    return () => window.removeEventListener("codex:close-rails", onCloseRails);
  }, []);

  useEffect(() => {
    const onSet = (e: Event): void => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id) setPrimary(id);
    };
    window.addEventListener("codex:set-primary", onSet);
    return () => window.removeEventListener("codex:set-primary", onSet);
  }, []);

  const setPrimaryAndPersist = (id: string): void => {
    setPrimary(id);
    setTweak("primaryTranslation", id);
    try {
      window.dispatchEvent(new CustomEvent("codex:primary", { detail: { id } }));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    aw().codexSetPrimary = setPrimaryAndPersist;
    return () => {
      delete aw().codexSetPrimary;
    };
  });

  const accent = ACCENT_MAP[t.accent] || ACCENT_MAP["cyan"]!;
  const driftAccent = { dark: "#39ff7a", light: "#0c5a30", glow: "rgba(57, 255, 122, 0.45)" };
  const useAccent = t.hermeneuticDriftCompensation ? driftAccent : accent;
  const themeStyle = {
    "--cx-accent": dark ? useAccent.dark : useAccent.light,
    "--cx-accent-glow": useAccent.glow,
    "--cx-oracle-fs": `${t.oracleFontScale || 14}px`,
  } as React.CSSProperties;

  const W = aw();

  return (
    <div
      className={`cx-app ${dark ? "is-dark" : "is-light"} ${t.scanlines ? "has-scan" : ""} font-${t.scriptureFont} ${deskMode ? "" : "is-mob"} ${distractionFree ? "is-distraction-free" : ""} ${t.hermeneuticDriftCompensation ? "is-drift" : ""} ${schizoEligible && t.schizo ? "is-schizo" : ""}`}
      style={themeStyle}
    >
      {deskMode ? (
        <DeskTrace
          now={now}
          dark={dark}
          autoTheme={!!t.autoTheme}
          onToggleTheme={() => {
            if (t.autoTheme) setTweak("autoTheme", false);
            setTweak("manualDark", !dark);
          }}
        />
      ) : null}

      {tourOpen ? <WelcomeTour onClose={closeTour} /> : null}

      {(() => {
        const briefEl = !wbDismissed ? (
          <WelcomeBack
            onContinue={(session) => {
              void loadPassage(session.bookId, session.chapter, 1);
              setWbDismissed(true);
            }}
            onDismiss={() => setWbDismissed(true)}
            onDiscoveryClick={(disc) => {
              if (disc.ref) {
                const firstRef = disc.ref.split(/\s*[↔→←]\s*/)[0]!.trim();
                const loc = parseRef(firstRef, data.books);
                if (loc) void loadPassage(loc.bookId, loc.chapter, loc.verse || 1);
              }
              setWbDismissed(true);
            }}
          />
        ) : null;

        const centerColEl = (
          <div className="cx-center-col">
            {t.continuityEnabled !== false && W.CODEX_CONTINUITY && W.CODEX_CONTINUITY.Mount ? React.createElement(W.CODEX_CONTINUITY.Mount) : null}
            {W.CodexReaderX ? (
              React.createElement(W.CodexReaderX, { surface: "main" })
            ) : (
              <div className="cxr-status is-err">
                <b>READER PLUGIN MISSING</b>
                <code>dist/reader.js failed to load</code>
              </div>
            )}
          </div>
        );

        const builtinBody = (id: string): React.ReactNode => {
          switch (id) {
            case "trans":
              return W.CodexTranslationsX ? React.createElement(W.CodexTranslationsX, { primary, onPrimary: setPrimaryAndPersist, compareSet, onToggleCompare, passage, currentVerse }) : null;
            case "talmud":
              return W.TalmudPanel ? React.createElement(W.TalmudPanel, { panelData, status: panelStatus, meta: panelMeta, passage, onRegenerate: regeneratePanels }) : null;
            case "comm":
              return W.CommentaryPanel ? React.createElement(W.CommentaryPanel, { panelData, status: panelStatus, meta: panelMeta, passage, onRegenerate: regeneratePanels, onJumpRef: jumpToRef }) : null;
            case "gem":
              return W.GematriaPanel ? React.createElement(W.GematriaPanel, { panelData, status: panelStatus, meta: panelMeta, passage, onRegenerate: regeneratePanels }) : null;
            case "gnosis":
              return W.GnosisPanel ? React.createElement(W.GnosisPanel, { panelData, status: panelStatus, meta: panelMeta, passage, gnosisOn, onToggleGnosis: setGnosisOn, onRegenerate: regeneratePanels }) : null;
            case "disarm":
              return W.DisarmPanel ? React.createElement(W.DisarmPanel, { panelData: disarmData, status: disarmStatus, meta: disarmMeta, passage, currentVerse, onRegenerate: regenerateDisarm }) : null;
            case "exeg":
              return W.ExegesisPanel ? React.createElement(W.ExegesisPanel, { passage, currentVerse }) : null;
            case "txan":
              return W.TranslationAnalysisPanel ? React.createElement(W.TranslationAnalysisPanel, { passage, currentVerse, primary, compareSet, onJumpRef: jumpToRef }) : null;
            default:
              return null;
          }
        };

        if (deskMode) {
          const vvCount = passage.verses.filter((v) => v[primary] != null && v[primary] !== "").length || passage.verses.length || 0;
          const refCtx = `${passage.book || ""} ${passage.chapter}:${currentVerse || 1}`;
          return (
            <div className="cx-desk">
              {briefEl ? <div className="cx-desk-brief">{briefEl}</div> : null}
              {desk.library ? (
                <DeskWin id="sys:library" glyph="☰" title="Library" onClose={() => setDesk((d) => ({ ...d, library: false }))} bodyClass="cx-desk-body-rail">
                  {W.LibraryX ? React.createElement(W.LibraryX) : null}
                </DeskWin>
              ) : null}
              {desk.reader ? (
                <DeskWin
                  id="sys:reader"
                  glyph="✦"
                  title={`${passage.book || "Scripture"} ${passage.chapter}`}
                  ctx={`${vvCount} VV · ${(primary || "").toUpperCase()}`}
                  onClose={() => setDesk((d) => ({ ...d, reader: false, focus: false }))}
                  onFocusMode={() => setDesk((d) => ({ ...d, focus: !d.focus }))}
                  focusOn={desk.focus}
                  bodyClass="cx-desk-body-reader"
                  headerExtra={W.CxrSpawn ? React.createElement(W.CxrSpawn) : null}
                >
                  {centerColEl}
                </DeskWin>
              ) : null}
              {pinnedReaders.map((p) => (
                <DeskWin key={p.id} id={`pinned:${p.id}`} glyph="⧉" title={`${p.now.book || p.now.bookId} ${p.now.chapter}`} ctx="PINNED" onClose={() => closePinnedReader(p.id)} bodyClass="cx-desk-body-reader">
                  {W.CodexReaderX ? React.createElement(W.CodexReaderX, { surface: "window", independent: true, initialNow: p.now, onNowChange: (n: { bookId?: string; book?: string; chapter?: number; verse?: number }) => updatePinnedReader(p.id, n) }) : null}
                </DeskWin>
              ))}
              {deskPanels.map((pid) =>
                BUILTIN_WIN[pid] ? (
                  <DeskWin key={pid} id={`builtin:${pid}`} glyph={BUILTIN_WIN[pid]!.glyph} title={BUILTIN_WIN[pid]!.title} ctx={refCtx} onClose={() => closeBuiltinPanel(pid)} bodyClass="cx-desk-body-panel">
                    {builtinBody(pid)}
                  </DeskWin>
                ) : null,
              )}
              {desk.oracle && W.OracleX ? (
                <DeskWin id="sys:oracle" glyph="◬" title="Oracle" ctx={`${passage.book || ""} ${passage.chapter}:${currentVerse || 1}`} onClose={() => setDesk((d) => ({ ...d, oracle: false }))} bodyClass="cx-desk-body-rail">
                  {React.createElement(W.OracleX)}
                </DeskWin>
              ) : null}
              {desk.marks && W.MarksX ? (
                <DeskWin id="sys:marks" glyph="⌖" title="Marks" onClose={() => setDesk((d) => ({ ...d, marks: false }))} bodyClass="cx-desk-body-rail">
                  {React.createElement(W.MarksX)}
                </DeskWin>
              ) : null}
            </div>
          );
        }

        return W.CodexMobileShell ? (
          React.createElement(W.CodexMobileShell, {
            builtinWin: BUILTIN_WIN,
            builtinBody,
            busy: !!(panelStatus.loading || disarmStatus.loading),
            dark,
            onToggleTheme: () => {
              if (t.autoTheme) setTweak("autoTheme", false);
              setTweak("manualDark", !dark);
            },
          })
        ) : (
          <div className="cx-mob">
            <div className="cx-mob-reader">
              {W.CodexReaderX ? (
                React.createElement(W.CodexReaderX, { surface: "mobile" })
              ) : (
                <div className="cxr-status is-err">
                  <b>READER PLUGIN MISSING</b>
                  <code>dist/reader.js failed to load</code>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {deskMode ? (
        <FooterBar
          currentVerse={currentVerse}
          passage={passage}
          gnosisOn={gnosisOn}
          onToggleGnosis={setGnosisOn}
          compareCount={compareSet.length}
          distractionFree={distractionFree}
          onToggleDistractionFree={toggleDistractionFree}
          onShowShortcuts={() => setShowShortcuts(true)}
          onOpenReels={() => {
            aw().codexOpenPanel?.("plugin:reels:reels");
          }}
          isOnline={isOnline}
        />
      ) : null}

      {schizoEligible && t.schizo ? (
        <div className="cx-schizo-sigil" aria-hidden="true" title="Schizo Mode active">⚯</div>
      ) : null}

      <ToastDock />

      {searchOpen && W.CODEX_SearchBar
        ? React.createElement(W.CODEX_SearchBar, {
            open: true,
            onClose: () => setSearchOpen(false),
            onNavigate: (bookId: string, chapter: number, verse: number) => {
              try {
                void loadPassage(bookId, chapter, verse || 1);
              } catch {
                /* ignore */
              }
            },
          })
        : null}

      {showShortcuts ? (
        <div className="cx-kbd-overlay" onClick={() => setShowShortcuts(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="cx-kbd-modal" ref={kbdModalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <div className="cx-kbd-hd">
              <b>Keyboard shortcuts</b>
              <button className="cx-kbd-x" onClick={() => setShowShortcuts(false)} aria-label="Close">×</button>
            </div>
            <div className="cx-kbd-grid">
              {(
                [
                  ["J / ↓", "Next verse"],
                  ["K / ↑", "Previous verse"],
                  ["H / ←", "Previous chapter"],
                  ["L / →", "Next chapter"],
                  ["PgDn / PgUp", "Scroll a screenful"],
                  ["Home / End", "First / last verse"],
                  ["⌘/Ctrl + K", "Omnibar — ask anything"],
                  ["1 – 9", deskMode ? "Open the Nth panel window" : "Open the Nth panel sheet"],
                  ["O", deskMode ? "Oracle window" : "Oracle sheet"],
                  ["B", deskMode ? "Marks window" : "Marks sheet"],
                  ["N", "Toggle notes"],
                  ["M", "Toggle verse map"],
                  ["T", deskMode ? "Translations window" : "Translations sheet"],
                  ["S", "Toggle side-by-side"],
                  ["F", "Focus — just the Word"],
                  ["Enter", "Open verse menu (on a verse)"],
                  ["?", "Show this overlay"],
                  ["Esc", "Close popovers / overlays"],
                ] as Array<[string, string]>
              ).map(([key, label]) => (
                <React.Fragment key={key}>
                  <kbd className="cx-kbd-key">{key}</kbd>
                  <span className="cx-kbd-lbl">{label}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="cx-kbd-ft">Press <kbd className="cx-kbd-key">?</kbd> any time to reopen.</div>
          </div>
        </div>
      ) : null}

      {verseMenu && W.VerseMenu
        ? (() => {
            const vmLoc = verseMenu.loc || passage;
            const vmKey = `${vmLoc.bookId}.${vmLoc.chapter}.${verseMenu.verse?.n}`;
            return React.createElement(W.VerseMenu, {
              anchor: verseMenu.anchor,
              verse: verseMenu.verse,
              passage: vmLoc,
              primary,
              highlightColor: t.highlightColor,
              currentHighlight: highlights[vmKey]?.color || null,
              onClose: closeVerseMenu,
              onToggleHighlight: () => {
                const v = verseMenu.verse;
                if (!v) return;
                if (highlights[vmKey]) {
                  clearHighlight(vmLoc.bookId, vmLoc.chapter, v.n);
                  return;
                }
                const text = (v[primary] as string) || (v["kjv"] as string) || (v["web"] as string) || "";
                toggleHighlight(vmLoc.bookId, vmLoc.chapter, v.n, null, text);
              },
            });
          })()
        : null}

      {verseMap && W.VerseMap ? React.createElement(W.VerseMap, { verse: verseMap.verse, refStr: verseMap.refStr, verseText: verseMap.text, passage, primary, onClose: closeVerseMap }) : null}
      {verseArt && W.VerseArt ? React.createElement(W.VerseArt, { verse: verseArt.verse, refStr: verseArt.refStr, verseText: verseArt.text, passage, primary, onClose: closeVerseArt }) : null}
      {W.Notes && t.notesEnabled ? React.createElement(W.Notes, { passage, currentVerse, onJumpTo: ({ ref }: { ref: string }) => jumpToRef(ref), onDisable: () => setTweak("notesEnabled", false) }) : null}
      {verseCompare && W.VerseCompare ? React.createElement(W.VerseCompare, { verse: verseCompare.verse, refStr: verseCompare.refStr, passage, primary, onClose: closeVerseCompare }) : null}
      {verseMirror && W.VerseMirror ? React.createElement(W.VerseMirror, { verse: verseMirror.verse, refStr: verseMirror.refStr, verseText: verseMirror.text, passage, primary, onClose: closeVerseMirror, onJumpRef: jumpToRef }) : null}
      {verseSword && W.VerseSword ? React.createElement(W.VerseSword, { verse: verseSword.verse, refStr: verseSword.refStr, verseText: verseSword.text, passage, primary, onClose: closeVerseSword, onJumpRef: jumpToRef }) : null}
      {opsOpen && W.VerseOps ? React.createElement(W.VerseOps, { seed: opsOpen.seed, onClose: closeOps, onJumpRef: jumpToRef }) : null}
      {omniOpen && W.Omnibar ? React.createElement(W.Omnibar, { onClose: () => setOmniOpen(false), seed: typeof omniOpen === "object" ? omniOpen.seed : "" }) : null}
      {constOpen && W.VerseConstellation ? React.createElement(W.VerseConstellation, { onClose: () => setConstOpen(false) }) : null}

      <TweaksPanel title={tt("settings")}>
        <TweakSection label={tt("language")} />
        <LangPicker value={t.lang || "en"} onChange={(v) => setTweak("lang", v)} />

        <TweakSection label="AI Engines" />
        <ApiKeysSection />

        <TweakSection label="AI Model" />
        <AIModelSection
          provider={t.provider || "anthropic"}
          model={t.model || "claude-haiku-4-5-20251001"}
          availableProviders={availableProviders}
          onChange={({ provider, model }) => {
            setTweak("provider", provider);
            if (model) setTweak("model", model);
          }}
        />

        <TweakSection label="Cross-device sync" />
        <SyncSection />

        <TweakSection label={tt("install")} />
        <button
          className={`cx-install-btn ${installed ? "is-installed" : ""}`}
          onClick={triggerInstall}
          disabled={installed}
          title={installed ? "CODEX is installed and runs fully offline." : isIOS ? "Tap to see iPhone / iPad install steps." : "Install CODEX as a real app — works offline, lives on your dock."}
        >
          {installed ? (
            <>
              <span className="cx-install-glyph">✓</span>
              <span>
                <b>{W.t?.("installed") || "INSTALLED"}</b>
                <i>{W.t?.("installed.sub") || "running as a standalone app · offline-ready"}</i>
              </span>
            </>
          ) : (
            <>
              <span className="cx-install-glyph">⤓</span>
              <span>
                <b>{W.t?.("install.codex") || "INSTALL CODEX"}</b>
                <i>{isIOS ? W.t?.("install.ios.sub") || "tap for iPhone / iPad steps" : W.t?.("install.sub") || "one tap · offline · home-screen icon"}</i>
              </span>
            </>
          )}
        </button>

        <TweakSection label={W.t?.("look") || "Look"} />
        <TweakColor
          label={tt("look.accent")}
          value={ACCENT_MAP[t.accent]!.dark}
          options={Object.values(ACCENT_MAP).map((a) => a.dark)}
          onChange={(v) => {
            const key = Object.keys(ACCENT_MAP).find((k) => ACCENT_MAP[k]!.dark === v) || "cyan";
            setTweak("accent", key);
          }}
        />
        <TweakToggle label={tt("look.scanlines")} value={!!t.scanlines} onChange={(v) => setTweak("scanlines", v)} />
        {schizoEligible ? (
          <div className="cx-schizo-toggle">
            <TweakToggle label="Schizo Mode" value={!!t.schizo} onChange={(v) => setTweak("schizo", v)} />
          </div>
        ) : null}
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, letterSpacing: ".04em" }}>Day-mode palette</div>
        <LightThemePicker />

        <TweakSection label={tt("marks")} />
        <TweakColor
          label={tt("marks.color")}
          value={HIGHLIGHT_COLORS[t.highlightColor]?.swatch || HIGHLIGHT_COLORS["amber"]!.swatch}
          options={Object.values(HIGHLIGHT_COLORS).map((c) => c.swatch)}
          onChange={(v) => {
            const key = Object.keys(HIGHLIGHT_COLORS).find((k) => HIGHLIGHT_COLORS[k]!.swatch === v) || "amber";
            setTweak("highlightColor", key);
          }}
        />
        <button
          className="cx-mini-btn"
          style={{ marginTop: 6 }}
          onClick={() => {
            if (marks.length === 0) return;
            const msg = (tt("marks.clear.confirm") || "Clear all {n} marks?").replace("{n}", String(marks.length));
            if (window.confirm(msg)) setHighlights({});
          }}
        >
          {tt("marks.clear")} ({marks.length})
        </button>

        <TweakSection label={tt("reading")} />
        <TweakToggle label={tt("reading.caffeinate")} value={!!t.caffeinate} onChange={(v) => setTweak("caffeinate", v)} />
        <TweakToggle label={tt("reading.notes")} value={!!t.notesEnabled} onChange={(v) => setTweak("notesEnabled", v)} />
        <TweakToggle label="Auto-bundle translations as I read" value={W.CODEX_TP?.autoBundleEnabled?.() ?? true} onChange={(v) => W.CODEX_TP?.setAutoBundle?.(v)} />
        <TweakSlider label={tt("reading.oracle.fs")} value={t.oracleFontScale || 14} min={11} max={20} unit="px" onChange={(v) => setTweak("oracleFontScale", v)} />
        {!("wakeLock" in navigator) ? <p className="cx-export-hint" style={{ marginTop: -2 }}>{tt("reading.caffeinate.unsupported")}</p> : null}

        <TweakSection label="Modules" />
        <div className="cx-export-row">
          <button className="cx-mini-btn" title="Browse and install plugin modules" onClick={() => aw().codexOpenPanel?.("plugin:module-marketplace:market")}>Open Marketplace</button>
        </div>
        <p className="cx-export-hint">Install, update, and manage plugin modules from the Marketplace.</p>

        <TweakSection label={tt("data.portable")} />
        <div className="cx-export-row">
          <button className="cx-mini-btn" onClick={exportAll} title="Download every mark, cached chapter, panel, and setting as one JSON file">{tt("data.export")}</button>
          <button className="cx-mini-btn" onClick={importPick} title="Restore from a CODEX export file">{tt("data.import")}</button>
        </div>
        <p className="cx-export-hint">{tt("data.hint")}</p>

        <TweakSection label={tt("cache")} />
        <OfflineStatus bookLookup={data.books} />
        <CachedPanelsBrowser onJump={jumpToRef} bookLookup={data.books} />
        <button
          className="cx-mini-btn"
          onClick={async () => {
            if (!window.confirm("Clear all cached chapters and panels? Your marks and settings stay.")) return;
            for (const k of Object.keys(localStorage)) {
              if (/^codex\.(bible|panels|redletter)\./i.test(k)) localStorage.removeItem(k);
            }
            if (window.caches) {
              for (const n of await caches.keys()) await caches.delete(n);
            }
            window.location.reload();
          }}
        >
          {tt("cache.clear")}
        </button>

        <TweakSection label="Offline · Bibles" />
        <OfflineBiblesPanel bookLookup={data.books} />

        <TweakSection label="Advanced inference" />
        <TweakToggle label="Hermeneutic drift compensation" value={!!t.hermeneuticDriftCompensation} onChange={(v) => setTweak("hermeneuticDriftCompensation", v)} />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>Cross-corpus inferential broadening. Experimental.</p>

        <TweakSection label="First impression" />
        <TweakToggle
          label="Boot intro sequence"
          value={!!t.bootIntro}
          onChange={(v) => {
            setTweak("bootIntro", v);
            try {
              localStorage.setItem("codex.bootIntro", v ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
        />
        <p className="cx-export-hint" style={{ marginTop: -2, opacity: 0.55 }}>Terminal-style cold boot on launch. Off = jump straight to scripture.</p>

        <TweakSection label="Keyboard" />
        <button className="cx-mini-btn" onClick={() => setShowShortcuts(true)} title="Show keyboard shortcut reference (or press ?)">⌨ SHOW KEYBOARD SHORTCUTS (?)</button>
        <p className="cx-export-hint" style={{ marginTop: -2 }}>Full keyboard navigation: J/K to scroll verses, H/L for chapters, 1–9 for panels, O/B/N/M/T/S/F for features, ? for the full list, Esc to close popovers.</p>

        <TweakSection label="Danger zone" />
        <button
          className="cx-mini-btn cx-reset-btn"
          onClick={() => {
            if (!window.confirm("Reset all settings to factory defaults?\n\nThis clears: theme, accent, font size, language, API keys, drift mode, and every UI tweak.\n\nKeeps: your marks, notes, cached scripture, panels, conversations.")) return;
            try {
              localStorage.removeItem("codex.tweaks.v1");
              localStorage.removeItem("codex.api.keys.v1");
              localStorage.removeItem("codex.lrail.width");
              localStorage.removeItem("codex.rrail.width");
              localStorage.removeItem("codex.tp.lang.order.v1");
              localStorage.removeItem("codex.tp.lang.collapsed.v1");
              localStorage.removeItem("codex.tp.trans.order.v1");
              localStorage.removeItem("codex.oracle.quickHidden");
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          title="Wipe every preference and reload — leaves your marks, notes, and cached scripture untouched."
        >
          ↺ RESET FACTORY SETTINGS
        </button>
        <p className="cx-export-hint" style={{ marginTop: -2 }}>Wipes settings + API keys only. Your marks, notes, and cached scripture survive. (Use the cache button above for those.)</p>
      </TweaksPanel>
    </div>
  );
}
