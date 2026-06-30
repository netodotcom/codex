// panels — offline translation-download state machine (Backlog 4.1). Migrated
// from panels.jsx. Module-scope state drives window.BIBLE.downloadAll so a
// download survives panel switches; the truth is exposed via window.CODEX_TP +
// window.CODEX_TRANS_STATE (the cross-file door other surfaces read). Importing
// this module registers those globals (side-effect), matching the legacy.

interface DlBook {
  id: string;
  chapters?: number;
}
interface DlTranslation {
  id: string;
  name: string;
  source?: string;
}
interface DlProgress {
  done?: number;
  total?: number;
  complete?: boolean;
  aborted?: boolean;
}
interface DlController {
  abort?(): void;
  then?(onOk: () => void, onErr: () => void): void;
  done?: { then(onOk: () => void, onErr: () => void): void };
}
interface DlEntry extends DlProgress {
  controller: DlController | null;
  auto?: boolean;
}
interface BibleApi {
  downloadAll(id: string, books: DlBook[], onProgress: (p: DlProgress) => void): DlController;
  cacheStats(id: string, books: DlBook[]): { fully?: boolean; cached?: number } | null;
  removeTranslation?(id: string): void;
}
interface DlWindow {
  BIBLE?: BibleApi;
  CODEX_DATA?: { books: DlBook[] };
  CODEX_TP?: Record<string, unknown>;
  CODEX_TRANS_STATE?: unknown;
}
function dw(): DlWindow {
  return window as unknown as DlWindow;
}

const TP_AUTO_BUNDLE_KEY = "codex.tp.autobundle.v1";
const _dlState = new Map<string, DlEntry>();
const _dlListeners = new Set<() => void>();
const _autoBundleQueue: Array<{ t: DlTranslation; books: DlBook[] }> = [];
let _autoBundleActive: string | null = null;
const _autoBundleTried = new Set<string>();

function _dlNotify(): void {
  for (const fn of _dlListeners)
    try {
      fn();
    } catch {
      /* ignore */
    }
}
function _toast(msg: string, kind = "info"): void {
  try {
    window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } }));
  } catch {
    /* ignore */
  }
}
function _autoBundleEnabled(): boolean {
  try {
    const v = localStorage.getItem(TP_AUTO_BUNDLE_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function _autoBundleDrain(): void {
  if (_autoBundleActive) return;
  const next = _autoBundleQueue.shift();
  if (!next) return;
  const { t, books } = next;
  const BIBLE = dw().BIBLE;
  if (!BIBLE) return;
  try {
    const s = BIBLE.cacheStats(t.id, books);
    if (s && s.fully) {
      _autoBundleDrain();
      return;
    }
  } catch {
    /* ignore */
  }
  const existing = _dlState.get(t.id);
  if (existing && existing.controller && !existing.complete && !existing.aborted) {
    _autoBundleDrain();
    return;
  }
  _autoBundleActive = t.id;
  const total = books.reduce((n, b) => n + (b.chapters || 0), 0);
  _dlState.set(t.id, { done: 0, total, controller: null, auto: true });
  _dlNotify();
  const ctrl = BIBLE.downloadAll(t.id, books, (p) => {
    _dlState.set(t.id, { ...p, controller: ctrl, auto: true });
    try {
      window.dispatchEvent(new CustomEvent("codex:autocache-tick", { detail: { translation: t.id, done: p.done || 0, total: p.total || total } }));
    } catch {
      /* ignore */
    }
    _dlNotify();
  });
  _dlState.set(t.id, { done: 0, total, controller: ctrl, auto: true });
  try {
    window.dispatchEvent(new CustomEvent("codex:autocache-start", { detail: { translation: t.id, total } }));
  } catch {
    /* ignore */
  }
  _dlNotify();
  const finish = (): void => {
    try {
      window.dispatchEvent(new CustomEvent("codex:autocache-done", { detail: { translation: t.id, done: total, total } }));
    } catch {
      /* ignore */
    }
    _autoBundleActive = null;
    _autoBundleDrain();
  };
  if (ctrl && typeof ctrl.then === "function") {
    ctrl.then(finish, finish);
  } else if (ctrl && ctrl.done && typeof ctrl.done.then === "function") {
    ctrl.done.then(finish, finish);
  } else {
    const poll = (): void => {
      try {
        const s = BIBLE.cacheStats(t.id, books);
        if (s && s.fully) return finish();
        const cur = _dlState.get(t.id);
        if (!cur || cur.aborted || cur.complete) return finish();
      } catch {
        /* ignore */
      }
      setTimeout(poll, 800);
    };
    setTimeout(poll, 800);
  }
}

function maybeAutoBundle(t: DlTranslation, books: DlBook[]): void {
  const BIBLE = dw().BIBLE;
  if (!t || !books || !_autoBundleEnabled()) return;
  if (!BIBLE || !BIBLE.downloadAll || !BIBLE.cacheStats) return;
  if (t.source === "bundle") return;
  if (_autoBundleTried.has(t.id)) return;
  let stats;
  try {
    stats = BIBLE.cacheStats(t.id, books);
  } catch {
    return;
  }
  if (!stats || (stats.cached ?? 0) > 0) {
    _autoBundleTried.add(t.id);
    return;
  }
  _autoBundleTried.add(t.id);
  _autoBundleQueue.push({ t, books });
  _toast(`Bundling ${t.name} for offline use…`, "info");
  _autoBundleDrain();
}

function transStartDownload(t: DlTranslation, opts: { silent?: boolean } = {}): void {
  const data = dw().CODEX_DATA;
  const BIBLE = dw().BIBLE;
  if (!data || !BIBLE?.downloadAll) return;
  const cur = _dlState.get(t.id);
  if (cur?.controller && !cur?.complete) return;
  const total = data.books.reduce((s, b) => s + (b.chapters || 0), 0);
  const controller = BIBLE.downloadAll(t.id, data.books, (p) => {
    _dlState.set(t.id, { ...p, controller });
    _dlNotify();
  });
  _dlState.set(t.id, { done: 0, total, controller });
  _dlNotify();
  if (!opts.silent) _toast(`Saving ${t.name} offline…`, "info");
}

function transStopDownload(t: DlTranslation): void {
  const s = _dlState.get(t.id);
  s?.controller?.abort?.();
  _toast(`Paused ${t.name} download`, "warn");
}

function transClearOffline(t: DlTranslation, opts: { skipConfirm?: boolean } = {}): void {
  const BIBLE = dw().BIBLE;
  if (!opts.skipConfirm && !window.confirm(`Remove offline copy of ${t.name}? Active reading will re-fetch as you go.`)) return;
  try {
    if (BIBLE && typeof BIBLE.removeTranslation === "function") {
      BIBLE.removeTranslation(t.id);
    } else {
      const raw = JSON.parse(localStorage.getItem("codex.bible.cache.v2") || "{}") as Record<string, unknown>;
      for (const k of Object.keys(raw)) if (k.endsWith(`.${t.id}`)) delete raw[k];
      localStorage.setItem("codex.bible.cache.v2", JSON.stringify(raw));
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("codex:translations-changed", { detail: { id: t.id } }));
  } catch {
    /* ignore */
  }
  _dlState.delete(t.id);
  _autoBundleTried.delete(t.id);
  _dlNotify();
}

// Register the cross-file globals (side-effect on import).
try {
  dw().CODEX_TP = Object.assign(dw().CODEX_TP || {}, {
    maybeAutoBundle,
    autoBundleEnabled: _autoBundleEnabled,
    setAutoBundle(on: boolean) {
      try {
        localStorage.setItem(TP_AUTO_BUNDLE_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
  });
  dw().CODEX_TRANS_STATE = {
    get: (id: string) => _dlState.get(id),
    subscribe: (fn: () => void) => {
      _dlListeners.add(fn);
      return () => _dlListeners.delete(fn);
    },
    start: transStartDownload,
    stop: transStopDownload,
    clear: transClearOffline,
    maybeAutoBundle,
  };
} catch {
  /* ignore */
}

export { transStartDownload, transStopDownload, transClearOffline, maybeAutoBundle };
