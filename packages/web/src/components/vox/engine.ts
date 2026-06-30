// vox — VoxEngine: a thin wrapper over speechSynthesis with chunking & callbacks
// (migrated verbatim from vox.jsx). The engine is a module-load singleton: on
// import it subscribes to the OS voice list exactly as the legacy IIFE did, so
// `window.CODEX_VOX` keeps the same surface and the same load-time side effect.

export interface VoxChunkMeta {
  ref?: string;
  verse?: number | string;
  isFirstSubchunk?: boolean;
}
export interface VoxChunk {
  text: string;
  meta?: VoxChunkMeta | null;
}

export interface VoxSpeakOptions {
  text?: string;
  chunks?: VoxChunk[];
  voice?: SpeechSynthesisVoice | null;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onWord?: (e: SpeechSynthesisEvent, i: number, chunk: VoxChunk) => void;
  onChunkStart?: (i: number, chunk: VoxChunk) => void;
  onEnd?: () => void;
  onError?: (e: unknown) => void;
}

export interface VoxEngineApi {
  voices(): SpeechSynthesisVoice[];
  onVoicesChanged(fn: (list: SpeechSynthesisVoice[]) => void): () => void;
  listByLang(): Record<string, SpeechSynthesisVoice[]>;
  chunkText(text: string | undefined, maxLen?: number): string[];
  speak(opts?: VoxSpeakOptions): void;
  pause(): void;
  resume(): void;
  stop(): void;
  isPlaying(): boolean;
  isPaused(): boolean;
  isAvailable(): boolean;
  // Future: assign a function here returning Promise<Blob> of synthesized
  // audio from a cloud provider (OpenAI/ElevenLabs/etc.) via /api/tts.
  cloudProvider: ((opts: VoxSpeakOptions) => Promise<Blob>) | null;
}

// ───────────────────────────────────────────────────────────────────────
// VoxEngine — thin wrapper over speechSynthesis with chunking & callbacks
// ───────────────────────────────────────────────────────────────────────
export const VoxEngine: VoxEngineApi = (() => {
  const SS: SpeechSynthesis | null = typeof window !== "undefined" ? window.speechSynthesis : null;
  let _voicesCache: SpeechSynthesisVoice[] = [];
  let _voicesReady = false;
  const _voiceListeners = new Set<(list: SpeechSynthesisVoice[]) => void>();

  function refreshVoices(): SpeechSynthesisVoice[] {
    if (!SS) return [];
    const list = SS.getVoices() || [];
    if (list.length) {
      _voicesCache = list;
      _voicesReady = true;
      for (const fn of _voiceListeners) { try { fn(list); } catch {} }
    }
    return list;
  }

  if (SS) {
    // Voices populate asynchronously on most browsers; subscribe.
    try {
      SS.onvoiceschanged = refreshVoices;
      refreshVoices();
    } catch {}
  }

  function voices(): SpeechSynthesisVoice[] {
    if (!_voicesReady) refreshVoices();
    return _voicesCache.slice();
  }

  function onVoicesChanged(fn: (list: SpeechSynthesisVoice[]) => void): () => void {
    _voiceListeners.add(fn);
    return () => _voiceListeners.delete(fn);
  }

  function listByLang(): Record<string, SpeechSynthesisVoice[]> {
    const out: Record<string, SpeechSynthesisVoice[]> = {};
    for (const v of voices()) {
      const code = ((v.lang || "").split(/[-_]/)[0] ?? "").toLowerCase() || "??";
      const arr = out[code] || (out[code] = []);
      arr.push(v);
    }
    return out;
  }

  // Some voice engines truncate long utterances (Chrome ~200 chars per
  // utterance is safest, some stall over 32KB total). Split on sentence
  // boundaries so the rhythm is preserved.
  function chunkText(text: string | undefined, maxLen = 200): string[] {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    if (clean.length <= maxLen) return [clean];
    const out: string[] = [];
    // First pass — split on sentence terminators.
    const sentences = clean.match(/[^.!?…—:;]+[.!?…—:;]?/g) || [clean];
    let buf = "";
    for (const s of sentences) {
      const piece = s.trim();
      if (!piece) continue;
      if ((buf + " " + piece).trim().length > maxLen) {
        if (buf) out.push(buf.trim());
        if (piece.length > maxLen) {
          // Hard split on word boundaries.
          const words = piece.split(/\s+/);
          let line = "";
          for (const w of words) {
            if ((line + " " + w).trim().length > maxLen) {
              if (line) out.push(line.trim());
              line = w;
            } else {
              line = line ? line + " " + w : w;
            }
          }
          if (line) buf = line;
          else buf = "";
        } else {
          buf = piece;
        }
      } else {
        buf = buf ? buf + " " + piece : piece;
      }
    }
    if (buf) out.push(buf.trim());
    return out;
  }

  let _currentUtterances: SpeechSynthesisUtterance[] = [];
  let _currentOnEnd: (() => void) | null = null;

  function stop(): void {
    if (!SS) return;
    try { SS.cancel(); } catch {}
    _currentUtterances = [];
    _currentOnEnd = null;
  }

  // speak({ text | chunks, voice, lang, rate, pitch, volume, onWord, onChunkStart, onEnd, onError })
  // - `text`: full string; will be auto-chunked.
  // - `chunks`: pre-chunked array of { text, meta? } — preferred when you
  //   want callbacks per logical unit (e.g. one chunk per verse).
  function speak(opts: VoxSpeakOptions = {}): void {
    if (!SS) { opts.onError && opts.onError(new Error("speechSynthesis unavailable")); return; }
    stop(); // never overlap
    const chunks = Array.isArray(opts.chunks) && opts.chunks.length
      ? opts.chunks
      : chunkText(opts.text).map((t) => ({ text: t }));
    if (!chunks.length) { opts.onEnd && opts.onEnd(); return; }

    const utts = chunks.map((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk.text);
      if (opts.voice)  u.voice = opts.voice;
      if (opts.lang)   u.lang = opts.lang;
      if (typeof opts.rate === "number")   u.rate = Math.max(0.1, Math.min(10, opts.rate));
      if (typeof opts.pitch === "number")  u.pitch = Math.max(0, Math.min(2, opts.pitch));
      if (typeof opts.volume === "number") u.volume = Math.max(0, Math.min(1, opts.volume));
      u.onstart = () => { opts.onChunkStart && opts.onChunkStart(i, chunk); };
      u.onboundary = (e) => { opts.onWord && opts.onWord(e, i, chunk); };
      u.onend = () => {
        if (i === chunks.length - 1) {
          _currentUtterances = [];
          _currentOnEnd = null;
          opts.onEnd && opts.onEnd();
        }
      };
      u.onerror = (e) => {
        // Don't treat "canceled" as a hard error — that's just stop().
        if (e && e.error === "canceled") return;
        opts.onError && opts.onError(e);
      };
      return u;
    });
    _currentUtterances = utts;
    _currentOnEnd = opts.onEnd || null;
    for (const u of utts) {
      try { SS.speak(u); } catch (e) { opts.onError && opts.onError(e); }
    }
  }

  function pause(): void  { try { SS && SS.pause();  } catch {} }
  function resume(): void { try { SS && SS.resume(); } catch {} }
  function isPlaying(): boolean { return !!(SS && SS.speaking); }
  function isPaused(): boolean  { return !!(SS && SS.paused); }
  function isAvailable(): boolean { return !!SS; }

  return {
    voices, onVoicesChanged, listByLang, chunkText,
    speak, pause, resume, stop,
    isPlaying, isPaused, isAvailable,
    // Future: assign a function here returning Promise<Blob> of synthesized
    // audio from a cloud provider (OpenAI/ElevenLabs/etc.) via /api/tts.
    cloudProvider: null,
  };
})();
