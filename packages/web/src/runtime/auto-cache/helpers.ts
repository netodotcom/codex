// auto-cache — warm-up logic (faithful port from legacy/auto-cache.js).
// Triggers a background downloadAll() for the primary translation on first
// load, broadcasts progress events, and persists a flag to localStorage.
//
// Progress events (dispatched on window):
//   codex:autocache-start  { translation, total }
//   codex:autocache-tick   { translation, done, total }
//   codex:autocache-done   { translation, done, total }
//   codex:autocache-error  { translation, error }
//
// Storage:
//   localStorage["codex.autocache.v1"] = JSON({ done: ["kjv"], at: ts })
import type { AutoCacheFlag, ProgressInfo } from "./types.js";
import { acw } from "./auto-cache-window.js";

export const FLAG_LS = "codex.autocache.v1";
export const TWEAKS_LS = "codex.tweaks"; // app.jsx writes settings here
export const DEFAULT_TRANSLATION = "kjv";

// ---------- localStorage helpers ----------

export function loadFlag(): AutoCacheFlag {
  try {
    return (
      (JSON.parse(localStorage.getItem(FLAG_LS) ?? "null") as AutoCacheFlag | null) ?? {
        done: [],
        at: 0,
      }
    );
  } catch {
    return { done: [], at: 0 };
  }
}

export function saveFlag(f: AutoCacheFlag): void {
  try {
    localStorage.setItem(FLAG_LS, JSON.stringify(f));
  } catch {}
}

export function primaryTranslation(): string {
  try {
    const tw =
      (
        JSON.parse(localStorage.getItem(TWEAKS_LS) ?? "null") as
          | { primaryTranslation?: string }
          | null
      ) ?? {};
    return tw.primaryTranslation ?? DEFAULT_TRANSLATION;
  } catch {
    return DEFAULT_TRANSLATION;
  }
}

// ---------- Event helper ----------

export function emit(name: string, detail: Record<string, unknown>): void {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

// ---------- Warm-up ----------

export async function warmUp(): Promise<void> {
  const flag = loadFlag();
  const primary = primaryTranslation();

  // Already pre-cached this translation? Skip.
  if (flag.done.includes(primary)) return;

  // Wait until BIBLE module is ready (bible.js exposes window.BIBLE).
  let tries = 0;
  while (
    (!acw().BIBLE || !acw().BIBLE?.downloadAll || !acw().CODEX_DATA) &&
    tries < 50
  ) {
    await new Promise<void>((r) => setTimeout(r, 200));
    tries++;
  }
  // NOTE: preserved from legacy — guard only checks BIBLE, not CODEX_DATA.
  // If CODEX_DATA never arrived but BIBLE did, execution continues; the
  // CODEX_DATA.books access below will throw and bubble to schedule()'s
  // .catch(() => {}).
  if (!acw().BIBLE || !acw().BIBLE?.downloadAll) return;

  // If the user has already navigated extensively and most chapters
  // are present, skip — they're effectively cached already.
  try {
    const booksForStats = acw().CODEX_DATA?.books;
    if (booksForStats) {
      const stats = acw().BIBLE!.cacheStats(primary, booksForStats);
      if (stats && stats.fully) {
        flag.done.push(primary);
        flag.at = Date.now();
        saveFlag(flag);
        emit("codex:autocache-done", {
          translation: primary,
          done: stats.cached ?? 0,
          total: stats.total ?? 0,
        });
        return;
      }
    }
  } catch {}

  // NOTE: preserved from legacy — CODEX_DATA.books accessed without null-guard.
  // If CODEX_DATA is absent (BIBLE arrived but CODEX_DATA poll timed out and the
  // cacheStats try/catch above swallowed the miss), this throws TypeError which
  // is caught by schedule()'s .catch(() => {}).
  const books = acw().CODEX_DATA!.books;
  const total = books.reduce((n, b) => n + (b.chapters ?? 0), 0);

  emit("codex:autocache-start", { translation: primary, total });

  let done = 0;
  let lastTickAt = 0;
  const onProgress = (info: ProgressInfo): void => {
    // NOTE: preserved from legacy — `||` treats 0-progress as "not reported";
    // falls back to incrementing done by 1 instead.
    done = (info.done || info.completed || 0) || (done + 1);
    const now = Date.now();
    // Throttle UI updates to ~5/sec.
    if (now - lastTickAt > 200) {
      lastTickAt = now;
      emit("codex:autocache-tick", { translation: primary, done, total });
    }
  };

  // Stagger the burst: downloadAll enqueues every chapter (~1189 tasks)
  // at once. The schedule() idle-gate already waits for first paint, but
  // give the reader a few extra seconds to settle so this background
  // warm-up never collides with the user's first navigation/prefetch.
  await new Promise<void>((r) => setTimeout(r, 4000));

  try {
    const ctrl: unknown = acw().BIBLE!.downloadAll(primary, books, onProgress);
    // downloadAll returns a controller — wait on its done promise if
    // exposed, or poll cacheStats as a fallback.
    if (ctrl != null && typeof (ctrl as { then?: unknown }).then === "function") {
      await (ctrl as Promise<void>);
    } else if (
      ctrl != null &&
      (ctrl as { done?: unknown }).done != null &&
      typeof (ctrl as { done: { then?: unknown } }).done.then === "function"
    ) {
      await (ctrl as { done: Promise<void> }).done;
    } else {
      // Fallback poll loop (~3 min worst case).
      for (let i = 0; i < 900; i++) {
        await new Promise<void>((r) => setTimeout(r, 200));
        try {
          const s = acw().BIBLE!.cacheStats(primary, books);
          if (s && s.fully) break;
        } catch {}
      }
    }
    flag.done.push(primary);
    flag.at = Date.now();
    saveFlag(flag);
    emit("codex:autocache-done", { translation: primary, done, total });
  } catch (e: unknown) {
    // NOTE: preserved from legacy — e && e.message || e error-string pattern.
    emit("codex:autocache-error", {
      translation: primary,
      error: String(e instanceof Error ? e.message : e),
    });
  }
}

// ---------- Scheduler ----------

export function schedule(): void {
  const start = (): void => {
    warmUp().catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => setTimeout(start, 1500), { timeout: 6000 });
  } else {
    setTimeout(start, 4000);
  }
}
