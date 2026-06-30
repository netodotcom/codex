// vox — VoxPanel and its panes (migrated verbatim from vox.jsx). Multilingual
// AI/natural-voice reading + a multi-tradition prayer guide. Render is kept as
// React.createElement (the classic factory) so the DOM output is byte-for-intent
// identical to the legacy IIFE. Pure logic lives in engine.ts / helpers.ts;
// presentation in styles.ts.
import React from "react";
import { VoxEngine, type VoxChunk } from "./engine.js";
import {
  bookName, activeTranslationLang, isNaturalVoice, langDisplay,
  verseNum, verseTextOf, loadChapterVerses, loadPrefs, savePrefs, loadPrayerFormats,
} from "./helpers.js";
import {
  panelStyle, sectionLabelStyle, naturalBadge, ctxStripStyle, selectStyle,
  btnPrimary, btnSecondary, nowSpeakingStyle, cardsGrid, cardStyle,
  cardTitleStyle, cardTraditionStyle, cardSummaryStyle, prayerBodyStyle,
  sectionStyle, activeSectionStyle, silenceSectionStyle, sectionTagStyle,
  sectionTextStyle, silenceDurStyle, badgeStyle,
} from "./styles.js";
import {
  vw,
  type VoxCtx, type VoxPrefs, type PrayerPack, type PrayerFormat,
  type PrayerSection, type VoxAiProvider,
} from "./vox-window.js";

const { useState, useEffect, useMemo, useCallback, useRef } = React;

interface GeneratedPrayer {
  formatId: string;
  tradition: string;
  text: string;
  sections: PrayerSection[];
}

interface ReadingPaneProps {
  ctx: VoxCtx;
  voices: SpeechSynthesisVoice[];
  grouped: Record<string, SpeechSynthesisVoice[]>;
  sortedLangCodes: string[];
  voiceId: string;
  pickVoice: (uri: string) => void;
  selectedVoice: SpeechSynthesisVoice | null;
  prefs: VoxPrefs;
  persistPrefs: (next: VoxPrefs) => void;
  source: string;
  setSource: (s: string) => void;
  customText: string;
  setCustomText: (s: string) => void;
  playing: boolean;
  paused: boolean;
  currentVerse: string | null;
  status: string;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  verseStep: (delta: number) => void;
}

interface PrayerPaneProps {
  ctx: VoxCtx;
  selectedVoice: SpeechSynthesisVoice | null;
  voices: SpeechSynthesisVoice[];
  voiceId: string;
  pickVoice: (uri: string) => void;
  grouped: Record<string, SpeechSynthesisVoice[]>;
  sortedLangCodes: string[];
  prefs: VoxPrefs;
}

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

// ───────────────────────────────────────────────────────────────────────
// VoxPanel — main component
// ───────────────────────────────────────────────────────────────────────
export function VoxPanel(ctx: VoxCtx): React.ReactElement {
  const [mode, setMode] = useState("reading"); // reading | prayer
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => VoxEngine.voices());
  const [voiceId, setVoiceId] = useState<string>(() => {
    try { return localStorage.getItem("codex.vox.selectedVoice") || ""; }
    catch { return ""; }
  });
  const [source, setSource] = useState("chapter"); // chapter | verse | custom
  const [customText, setCustomText] = useState("");
  const [prefs, setPrefs] = useState<VoxPrefs>(() => loadPrefs(voiceId));
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const cancelRef = useRef(false);

  // Refresh voices when the OS list arrives.
  useEffect(() => {
    const off = VoxEngine.onVoicesChanged((list) => setVoices(list.slice()));
    return off;
  }, []);

  // Auto-pick a voice that matches the active translation's language.
  const targetLang = activeTranslationLang(ctx.translation);
  useEffect(() => {
    if (voiceId) {
      // Validate it still exists.
      const v = voices.find((x) => x.voiceURI === voiceId);
      if (v) return;
    }
    if (!voices.length) return;
    // Prefer Natural/Enhanced voice matching the language.
    const matchLang = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(targetLang));
    const pool = matchLang.length ? matchLang : voices;
    const natural = pool.find(isNaturalVoice);
    const pick = natural || pool[0];
    if (pick) {
      setVoiceId(pick.voiceURI);
      try { localStorage.setItem("codex.vox.selectedVoice", pick.voiceURI); } catch {}
      setPrefs(loadPrefs(pick.voiceURI));
    }
  }, [voices, targetLang, ctx.translation]);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.voiceURI === voiceId) || null,
    [voices, voiceId],
  );

  function persistPrefs(next: VoxPrefs): void {
    setPrefs(next);
    if (voiceId) savePrefs(voiceId, next);
  }

  function pickVoice(uri: string): void {
    setVoiceId(uri);
    try { localStorage.setItem("codex.vox.selectedVoice", uri); } catch {}
    setPrefs(loadPrefs(uri));
  }

  // Group voices by language with quality badges.
  const grouped = useMemo(() => {
    const out: Record<string, SpeechSynthesisVoice[]> = {};
    for (const v of voices) {
      const code = ((v.lang || "").split(/[-_]/)[0] ?? "").toLowerCase() || "??";
      const arr = out[code] || (out[code] = []);
      arr.push(v);
    }
    // Sort each group: natural voices first, then alphabetical.
    for (const code of Object.keys(out)) {
      const list = out[code];
      if (!list) continue;
      list.sort((a, b) => {
        const na = isNaturalVoice(a) ? 0 : 1;
        const nb = isNaturalVoice(b) ? 0 : 1;
        if (na !== nb) return na - nb;
        return (a.name || "").localeCompare(b.name || "");
      });
    }
    return out;
  }, [voices]);

  const sortedLangCodes = useMemo(() => {
    const codes = Object.keys(grouped);
    codes.sort((a, b) => {
      // Active translation's language first
      if (a === targetLang) return -1;
      if (b === targetLang) return 1;
      return a.localeCompare(b);
    });
    return codes;
  }, [grouped, targetLang]);

  // ── Reading actions ─────────────────────────────────────────────────
  async function getReadingChunks(): Promise<VoxChunk[]> {
    if (source === "verse" && ctx.bookId && ctx.chapter && ctx.verse) {
      const verses = await loadChapterVerses(ctx.bookId, ctx.chapter, ctx.translation);
      const v = verses.find((x) => Number(verseNum(x)) === Number(ctx.verse));
      if (v) {
        const text = verseTextOf(v, ctx.translation);
        if (text) return [{ text, meta: { ref: `${ctx.bookId}.${ctx.chapter}.${ctx.verse}` } }];
      }
      return [];
    }
    if (source === "custom") {
      const t = customText.trim();
      if (!t) return [];
      return VoxEngine.chunkText(t).map((s) => ({ text: s }));
    }
    // chapter
    const verses = await loadChapterVerses(ctx.bookId, ctx.chapter, ctx.translation);
    if (!verses.length) return [];
    const out: VoxChunk[] = [];
    for (const v of verses) {
      const num = verseNum(v);
      const text = verseTextOf(v, ctx.translation).trim();
      if (!text) continue;
      const ref = `${ctx.bookId}.${ctx.chapter}.${num}`;
      // Each verse becomes one chunk for clean per-verse highlight; if a
      // verse is itself huge, chunkText will keep utterances under cap.
      const sub = VoxEngine.chunkText(text, 220);
      sub.forEach((piece, i) => {
        out.push({ text: piece, meta: { ref, verse: num, isFirstSubchunk: i === 0 } });
      });
    }
    return out;
  }

  function speakChunks(chunks: VoxChunk[], { rateOverride }: { rateOverride?: number } = {}): void {
    if (!chunks.length) { setStatus("Nothing to read."); return; }
    setStatus(""); setPlaying(true); setPaused(false); cancelRef.current = false;
    VoxEngine.speak({
      chunks,
      voice: selectedVoice,
      lang: selectedVoice ? selectedVoice.lang : undefined,
      rate: rateOverride != null ? rateOverride : prefs.rate,
      pitch: prefs.pitch,
      volume: prefs.volume,
      onChunkStart(i, chunk) {
        if (chunk.meta && chunk.meta.ref && chunk.meta.isFirstSubchunk !== false) {
          setCurrentVerse(chunk.meta.ref);
          try {
            window.dispatchEvent(new CustomEvent("codex:vox-progress", {
              detail: { verseRef: chunk.meta.ref, verse: chunk.meta.verse },
            }));
          } catch {}
        }
      },
      onEnd() { setPlaying(false); setPaused(false); setCurrentVerse(null); },
      onError(e) {
        setPlaying(false); setPaused(false);
        const o = e as { error?: string; message?: string } | null;
        if (!cancelRef.current) setStatus("Voice error: " + ((o && (o.error || o.message)) || "unknown"));
      },
    });
  }

  async function play(): Promise<void> {
    const chunks = await getReadingChunks();
    speakChunks(chunks);
  }
  function pause(): void { VoxEngine.pause(); setPaused(true); }
  function resume(): void { VoxEngine.resume(); setPaused(false); }
  function stop(): void {
    cancelRef.current = true;
    VoxEngine.stop();
    setPlaying(false); setPaused(false); setCurrentVerse(null);
  }

  // Verse-step ±: navigate the reader to the prev/next verse and (optionally)
  // restart playback at that verse.
  async function verseStep(delta: number): Promise<void> {
    const v = Math.max(1, (Number(ctx.verse) || 1) + delta);
    try {
      window.dispatchEvent(new CustomEvent("codex:navigate", {
        detail: { book: bookName(ctx.bookId), bookId: ctx.bookId, chapter: ctx.chapter, verse: v },
      }));
    } catch {}
  }

  // Listen for verse-menu shortcut from other plugins.
  useEffect(() => {
    function onSpeakReq(e: Event): void {
      const d = ((e as CustomEvent).detail || {}) as { text?: string; ref?: string };
      if (!d.text) return;
      const chunks = VoxEngine.chunkText(d.text).map((s) => ({
        text: s, meta: d.ref ? { ref: d.ref } : null,
      }));
      speakChunks(chunks);
    }
    function onStopReq(): void { stop(); }
    window.addEventListener("codex:vox-speak", onSpeakReq);
    window.addEventListener("codex:vox-stop", onStopReq);
    return () => {
      window.removeEventListener("codex:vox-speak", onSpeakReq);
      window.removeEventListener("codex:vox-stop", onStopReq);
    };
  }, [selectedVoice, prefs.rate, prefs.pitch, prefs.volume]);

  // Stop on unmount.
  useEffect(() => () => { try { VoxEngine.stop(); } catch {} }, []);

  // ── Render ──────────────────────────────────────────────────────────
  return React.createElement("div", { className: "cx-vox-panel", style: panelStyle },
    React.createElement(VoxHeader, { mode, setMode }),
    mode === "reading"
      ? React.createElement(ReadingPane, {
          ctx, voices, grouped, sortedLangCodes, voiceId, pickVoice,
          selectedVoice, prefs, persistPrefs, source, setSource,
          customText, setCustomText, playing, paused, currentVerse, status,
          play, pause, resume, stop, verseStep,
        })
      : React.createElement(PrayerPane, {
          ctx, selectedVoice, voices, voiceId, pickVoice,
          grouped, sortedLangCodes,
          prefs,
        }),
  );
}

// ───────────────────────────────────────────────────────────────────────
// Header (tab switch)
// ───────────────────────────────────────────────────────────────────────
function VoxHeader({ mode, setMode }: { mode: string; setMode: (m: string) => void }): React.ReactElement {
  const tabBtn = (id: string, label: string): React.ReactElement => React.createElement("button", {
    key: id, onClick: () => setMode(id), className: "cx-vox-tab",
    style: {
      flex: 1, padding: "10px 12px",
      background: mode === id ? "#1a2230" : "transparent",
      color: mode === id ? "#7ee0ff" : "#8b96a2",
      border: "1px solid " + (mode === id ? "#3a4a5e" : "#212a35"),
      borderBottom: mode === id ? "1px solid #1a2230" : "1px solid #212a35",
      cursor: "pointer", letterSpacing: "0.18em", fontSize: "11px",
      fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      fontWeight: 600,
    },
  }, label);

  return React.createElement("div", { className: "cx-vox-tabs", style: {
    display: "flex", borderBottom: "1px solid #212a35", marginBottom: 14,
  } }, tabBtn("reading", "◉ READING"), tabBtn("prayer", "✶ PRAYER"));
}

// ───────────────────────────────────────────────────────────────────────
// ReadingPane
// ───────────────────────────────────────────────────────────────────────
function ReadingPane({
  ctx, voices, grouped, sortedLangCodes, voiceId, pickVoice,
  selectedVoice, prefs, persistPrefs, source, setSource,
  customText, setCustomText, playing, paused, currentVerse, status,
  play, pause, resume, stop, verseStep,
}: ReadingPaneProps): React.ReactElement {
  if (!VoxEngine.isAvailable()) {
    return React.createElement("div", { style: { padding: 16, color: "#ffc46b" } },
      "Your browser does not expose speechSynthesis. Try Chrome, Edge, Safari, or Firefox.");
  }

  const refLabel = ctx.bookId && ctx.chapter
    ? `${bookName(ctx.bookId)} ${ctx.chapter}${ctx.verse ? ":" + ctx.verse : ""}`
    : "—";

  const radio = (val: string, label: string): React.ReactElement => React.createElement("label", {
    key: val,
    style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#c9d4dc", cursor: "pointer" },
  },
    React.createElement("input", {
      type: "radio", name: "vox-source", checked: source === val,
      onChange: () => setSource(val),
    }),
    label,
  );

  const playBtn = playing && !paused
    ? React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: pause, style: btnPrimary }, "❚❚ PAUSE")
    : playing && paused
    ? React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: resume, style: btnPrimary }, "▶ RESUME")
    : React.createElement("button", { className: "cx-vox-btn cx-vox-btn-primary", onClick: play, style: btnPrimary }, "▶ PLAY");

  return React.createElement("div", { style: { padding: "0 14px 16px" } },

    // Context strip
    React.createElement("div", { style: ctxStripStyle },
      React.createElement("span", { style: { color: "var(--cx-fg-dim, #8295ae)", letterSpacing: "0.16em", fontSize: 10 } }, "READING"),
      React.createElement("span", { style: { color: "#7ee0ff", fontWeight: 600 } }, refLabel),
    ),

    // Source picker
    React.createElement("div", { style: { marginBottom: 14 } },
      React.createElement("div", { style: sectionLabelStyle }, "SOURCE"),
      React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } },
        radio("chapter", "Current chapter"),
        radio("verse",   "Current verse only"),
        radio("custom",  "Custom text"),
      ),
      source === "custom" && React.createElement("textarea", {
        value: customText, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomText(e.target.value),
        placeholder: "Paste or type any text in any language…",
        rows: 4,
        style: {
          width: "100%", marginTop: 8, padding: 10,
          background: "#0a0f17", color: "#d8e0e8",
          border: "1px solid #232d3a", borderRadius: 6,
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 15, lineHeight: 1.5, resize: "vertical",
        },
      }),
    ),

    // Voice picker
    React.createElement("div", { style: { marginBottom: 14 } },
      React.createElement("div", { style: sectionLabelStyle },
        "VOICE",
        selectedVoice && isNaturalVoice(selectedVoice) &&
          React.createElement("span", { style: naturalBadge }, "★ NATURAL"),
      ),
      React.createElement("select", {
        value: voiceId, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => pickVoice(e.target.value),
        style: selectStyle,
      },
        !voices.length && React.createElement("option", { value: "" }, "Loading voices…"),
        sortedLangCodes.map((code) =>
          React.createElement("optgroup", { key: code, label: langDisplay(code) + (code === activeTranslationLang(ctx.translation) ? " · matches translation" : "") },
            (grouped[code] || []).map((v) => React.createElement("option", { key: v.voiceURI, value: v.voiceURI },
              v.name + (isNaturalVoice(v) ? "  ★" : "") + " · " + v.lang,
            )),
          ),
        ),
      ),
    ),

    // Sliders
    React.createElement("div", { style: { marginBottom: 14 } },
      React.createElement(Slider, {
        label: "Speed", min: 0.5, max: 2.0, step: 0.05,
        value: prefs.rate, onChange: (v: number) => persistPrefs({ ...prefs, rate: v }),
        format: (v: number) => v.toFixed(2) + "×",
      }),
      React.createElement(Slider, {
        label: "Pitch", min: 0.5, max: 2.0, step: 0.05,
        value: prefs.pitch, onChange: (v: number) => persistPrefs({ ...prefs, pitch: v }),
        format: (v: number) => v.toFixed(2),
      }),
      React.createElement(Slider, {
        label: "Volume", min: 0, max: 1.0, step: 0.05,
        value: prefs.volume, onChange: (v: number) => persistPrefs({ ...prefs, volume: v }),
        format: (v: number) => Math.round(v * 100) + "%",
      }),
    ),

    // Playback controls
    React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch", marginBottom: 12 } },
      playBtn,
      React.createElement("button", { onClick: stop, style: btnSecondary, disabled: !playing }, "■ STOP"),
      React.createElement("button", { onClick: () => verseStep(-1), style: btnSecondary, title: "Previous verse" }, "◀ VERSE"),
      React.createElement("button", { onClick: () => verseStep(+1), style: btnSecondary, title: "Next verse" }, "VERSE ▶"),
    ),

    // Status / now-speaking
    currentVerse && React.createElement("div", { style: nowSpeakingStyle },
      "▸ Speaking: ", React.createElement("b", { style: { color: "#7ee0ff" } }, currentVerse)),
    status && React.createElement("div", { style: { fontSize: 12, color: "#ffc46b", marginTop: 6 } }, status),

    React.createElement("div", { style: { marginTop: 18, fontSize: 11, color: "var(--cx-fg-dim, #8295ae)", lineHeight: 1.6 } },
      "Voice quality depends on your OS/browser. macOS & iOS Safari surface Apple's premium voices (★). On Linux you may see eSpeak fallback. Per-voice speed/pitch are saved automatically."),
  );
}

// ───────────────────────────────────────────────────────────────────────
// PrayerPane
// ───────────────────────────────────────────────────────────────────────
function PrayerPane({ ctx, selectedVoice, voices, voiceId, pickVoice, grouped, sortedLangCodes, prefs }: PrayerPaneProps): React.ReactElement {
  const [pack, setPack] = useState<PrayerPack | null>(null);
  const [err, setErr] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [situation, setSituation] = useState("");
  const [generated, setGenerated] = useState<GeneratedPrayer | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [genTradition, setGenTradition] = useState("Christian");
  const playSeqRef = useRef<{ idx: number; sections: PrayerSection[]; rate: number; canceled: boolean }>({ idx: 0, sections: [], rate: 0.85, canceled: false });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadPrayerFormats().then(setPack).catch((e) => setErr(String((e as { message?: string } | null)?.message || e)));
  }, []);

  useEffect(() => () => {
    try { VoxEngine.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const formats = (pack && pack.formats) || [];
  const selected = formats.find((f) => f.id === selectedId) || null;

  function startPrayer(format: PrayerFormat): void {
    try { VoxEngine.stop(); } catch {}
    setSelectedId(format.id);
    setActiveIdx(-1);
    setGenerated(null);
  }

  function playSection(idx: number): void {
    const seq = playSeqRef.current;
    if (seq.canceled) return;
    if (idx >= seq.sections.length) {
      setPlaying(false); setPaused(false); setActiveIdx(-1); return;
    }
    const s = seq.sections[idx];
    if (!s) return;
    setActiveIdx(idx);
    // Silence sections: wait `duration` seconds (in addition to TTS reading
    // the cue line if non-empty).
    const isSilence = s.type === "silence";
    const cueText = s.text || (isSilence ? "" : "");
    const advance = (): void => {
      if (seq.canceled) return;
      if (isSilence && s.duration) {
        // Hold silence with a soft countdown.
        const wait = Math.max(0, Number(s.duration) || 0) * 1000;
        setTimeout(() => playSection(idx + 1), wait);
      } else {
        playSection(idx + 1);
      }
    };
    if (!cueText) { advance(); return; }
    VoxEngine.speak({
      text: cueText,
      voice: selectedVoice,
      lang: selectedVoice ? selectedVoice.lang : undefined,
      rate: seq.rate,
      pitch: prefs.pitch,
      volume: prefs.volume,
      onEnd: () => {
        // Add a short reflective pause between sections.
        const gap = s.type === "petition" || s.type === "doxology" ? 700 : 400;
        setTimeout(advance, gap);
      },
      onError: () => advance(),
    });
  }

  function guide(format: PrayerFormat | null): void {
    if (!format) return;
    const sections = (generated && generated.formatId === format.id)
      ? generated.sections
      : (format.sections || []);
    if (!sections.length) return;
    const rate = (format.pace_rate || 0.82) * 1.0;
    playSeqRef.current = { idx: 0, sections, rate, canceled: false };
    setPlaying(true); setPaused(false); setActiveIdx(0);
    playSection(0);
  }

  function pause(): void { try { VoxEngine.pause(); } catch {} setPaused(true); }
  function resume(): void { try { VoxEngine.resume(); } catch {} setPaused(false); }
  function stop(): void {
    playSeqRef.current.canceled = true;
    try { VoxEngine.stop(); } catch {}
    setPlaying(false); setPaused(false); setActiveIdx(-1);
  }

  // ── Prayer timer ────────────────────────────────────────────────────
  function startTimer(seconds: number): void {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(true); setTimerRemaining(seconds);
    timerRef.current = setInterval(() => {
      setTimerRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current!); timerRef.current = null;
          setTimerActive(false);
          // Gentle audible cue.
          try { VoxEngine.speak({ text: "Amen.", voice: selectedVoice, rate: 0.8 }); } catch {}
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }
  function stopTimer(): void {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerActive(false); setTimerRemaining(0);
  }
  function fmtTime(s: number): string {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }

  // ── AI prayer generation ────────────────────────────────────────────
  async function generatePrayer(): Promise<void> {
    const sit = situation.trim();
    if (!sit) { setGenErr("Describe the situation first."); return; }
    setGenBusy(true); setGenErr(""); setGenerated(null);
    try {
      const tradition = genTradition || "Christian";
      const system = `You generate reverent, well-crafted prayers in the ${tradition} tradition. Use the form's conventions where applicable: invocation, body / petition, doxology, and a closing such as Amen. Be sincere, never theatrical. About 150 words. Output ONLY the prayer text, no preamble or commentary, no markdown headers.`;
      const ai = vw().CODEX_AI;
      const provider: VoxAiProvider | null = (ai && ai.getActiveProvider && ai.getActiveProvider()) || null;
      const body: { system: string; messages: Array<{ role: string; content: string }>; max_tokens: number; provider?: string; model?: string } = {
        system,
        messages: [{ role: "user", content: `Compose a prayer for this situation: ${sit}` }],
        max_tokens: 600,
      };
      if (provider && provider.provider) body.provider = provider.provider;
      if (provider && provider.model)    body.model    = provider.model;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as { text?: string; content?: string; message?: string; error?: string } | null;
      const txt = d && (d.text || d.content || d.message);
      if (!txt) throw new Error(d && d.error ? d.error : "AI engine returned no text.");
      // Split into sections by paragraph.
      const paras = String(txt).split(/\n{2,}|(?<=[.!?])\s{2,}/).map((s) => s.trim()).filter(Boolean);
      const sections: PrayerSection[] = paras.length
        ? paras.map((p, i) => ({
            type: i === 0 ? "invocation" : (i === paras.length - 1 ? "doxology" : "petition"),
            text: p,
          }))
        : [{ type: "petition", text: String(txt).trim() }];
      setGenerated({
        formatId: "petitionary-free",
        tradition,
        text: String(txt).trim(),
        sections,
      });
    } catch (e) {
      setGenErr(String((e as { message?: string } | null)?.message || e));
    } finally {
      setGenBusy(false);
    }
  }

  if (err) {
    return React.createElement("div", { style: { padding: 16, color: "#ffc46b" } },
      "Could not load prayer formats: ", err);
  }
  if (!pack) {
    return React.createElement("div", { style: { padding: 16, color: "var(--cx-fg-dim, #8295ae)" } },
      "Loading prayer formats…");
  }

  return React.createElement("div", { style: { padding: "0 14px 18px" } },

    React.createElement("div", { style: ctxStripStyle },
      React.createElement("span", { style: { color: "var(--cx-fg-dim, #8295ae)", letterSpacing: "0.16em", fontSize: 10 } }, "PRAYER"),
      React.createElement("span", { style: { color: "#ffc46b" } },
        `${formats.length} traditions`),
    ),

    // Tradition cards grid
    !selected && React.createElement("div", { style: cardsGrid },
      formats.map((f) => React.createElement("button", {
        key: f.id, onClick: () => startPrayer(f), className: "cx-vox-prayer-card",
        style: cardStyle,
      },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 } },
          React.createElement("div", { style: cardTitleStyle }, f.name),
          React.createElement("span", { style: badgeStyle(f.badge) }, f.badge || "—"),
        ),
        React.createElement("div", { style: cardTraditionStyle }, f.tradition),
        f.summary && React.createElement("div", { style: cardSummaryStyle }, f.summary),
      )),
    ),

    // Selected prayer view
    selected && React.createElement("div", null,
      React.createElement("button", {
        onClick: () => { stop(); setSelectedId(null); setGenerated(null); },
        style: { ...btnSecondary, marginBottom: 12 },
      }, "← All traditions"),

      React.createElement("div", { style: { marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 24, color: "#e8ecf2", lineHeight: 1.15 } },
            selected.name),
          React.createElement("div", { style: { fontSize: 11, color: "#8b96a2", letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 2 } },
            selected.tradition),
        ),
        React.createElement("span", { style: badgeStyle(selected.badge) }, selected.badge || "—"),
      ),

      // Voice override quick-pick for prayer mode
      React.createElement("div", { style: { marginBottom: 12 } },
        React.createElement("div", { style: { ...sectionLabelStyle, marginBottom: 4 } }, "VOICE"),
        React.createElement("select", {
          value: voiceId, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => pickVoice(e.target.value),
          style: selectStyle,
        },
          sortedLangCodes.map((code) =>
            React.createElement("optgroup", { key: code, label: langDisplay(code) },
              (grouped[code] || []).map((v) => React.createElement("option", { key: v.voiceURI, value: v.voiceURI },
                v.name + (isNaturalVoice(v) ? "  ★" : "") + " · " + v.lang,
              )),
            ),
          ),
        ),
      ),

      // Controls
      React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 } },
        !playing && React.createElement("button", { onClick: () => guide(selected), style: btnPrimary }, "✶ GUIDE ME"),
        playing && !paused && React.createElement("button", { onClick: pause, style: btnPrimary }, "❚❚ PAUSE"),
        playing && paused && React.createElement("button", { onClick: resume, style: btnPrimary }, "▶ RESUME"),
        playing && React.createElement("button", { onClick: stop, style: btnSecondary }, "■ STOP"),
      ),

      // Prayer body — render sections in big serif
      React.createElement("div", { style: prayerBodyStyle },
        ((generated && generated.formatId === selected.id) ? generated.sections : (selected.sections || []))
          .map((s, i) => React.createElement("div", {
            key: i,
            style: {
              ...sectionStyle,
              ...(activeIdx === i ? activeSectionStyle : null),
              ...(s.type === "silence" ? silenceSectionStyle : null),
            },
          },
            React.createElement("div", { style: sectionTagStyle }, s.type),
            React.createElement("div", { style: sectionTextStyle(selected.lang_default) }, s.text || (s.type === "silence" ? "…" : "")),
            s.type === "silence" && s.duration ? React.createElement("div", { style: silenceDurStyle }, `${s.duration}s`) : null,
          )),
      ),

      // AI personalization
      selected.id === "petitionary-free" && React.createElement("div", { style: { marginTop: 16, padding: 12, background: "#0e1320", border: "1px solid #232d3a", borderRadius: 8 } },
        React.createElement("div", { style: sectionLabelStyle }, "GENERATE A PRAYER"),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
          ["Christian","Catholic","Orthodox","Jewish","Messianic","Sufi","Gnostic","Hermetic","Quaker","New Age","Interfaith"].map((t) =>
            React.createElement("button", {
              key: t, onClick: () => setGenTradition(t),
              style: {
                fontSize: 11, padding: "3px 8px", borderRadius: 10, cursor: "pointer",
                border: "1px solid " + (genTradition === t ? "#7ee0ff" : "#2a3340"),
                background: genTradition === t ? "#13202e" : "transparent",
                color: genTradition === t ? "#7ee0ff" : "#8b96a2",
              },
            }, t),
          ),
        ),
        React.createElement("textarea", {
          value: situation, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setSituation(e.target.value),
          placeholder: "Describe the situation… e.g. anxiety before a job interview, grief over a friend, gratitude after recovery.",
          rows: 3,
          style: {
            width: "100%", padding: 10, marginBottom: 8,
            background: "#0a0f17", color: "#d8e0e8",
            border: "1px solid #232d3a", borderRadius: 6,
            fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 14, lineHeight: 1.5,
          },
        }),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: generatePrayer, disabled: genBusy, style: { ...btnPrimary, opacity: genBusy ? 0.5 : 1 } },
            genBusy ? "Composing…" : "✶ COMPOSE"),
          generated && React.createElement("button", { onClick: () => guide(selected), style: btnSecondary }, "▶ READ ALOUD"),
        ),
        genErr && React.createElement("div", { style: { fontSize: 12, color: "#ffc46b", marginTop: 8 } }, genErr),
      ),

      // Prayer timer
      React.createElement("div", { style: { marginTop: 16, padding: 12, background: "#0e1320", border: "1px solid #232d3a", borderRadius: 8 } },
        React.createElement("div", { style: { ...sectionLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" } },
          React.createElement("span", null, "TIMER"),
          timerActive && React.createElement("span", { style: { color: "#7ee0ff", fontFamily: "ui-monospace, monospace", fontSize: 14 } }, fmtTime(timerRemaining)),
        ),
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          [1, 3, 5, 10, 20].map((m) => React.createElement("button", {
            key: m, onClick: () => startTimer(m * 60), style: btnSecondary,
          }, `${m} min`)),
          timerActive && React.createElement("button", { onClick: stopTimer, style: { ...btnSecondary, color: "#ffc46b" } }, "Stop timer"),
        ),
      ),
    ),
  );
}

// ───────────────────────────────────────────────────────────────────────
// Slider component
// ───────────────────────────────────────────────────────────────────────
function Slider({ label, min, max, step, value, onChange, format }: SliderProps): React.ReactElement {
  return React.createElement("div", { style: { marginBottom: 8 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b96a2", letterSpacing: "0.10em", marginBottom: 2 } },
      React.createElement("span", null, label.toUpperCase()),
      React.createElement("span", { style: { color: "#c9d4dc", fontFamily: "ui-monospace, monospace" } }, format ? format(value) : value),
    ),
    React.createElement("input", {
      className: "cx-vox-slider",
      type: "range", min, max, step, value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value)),
      style: { width: "100%" },
    }),
  );
}
