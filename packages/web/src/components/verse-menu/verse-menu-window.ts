// verse-menu — typed window boundary (migrated from verse-menu.jsx).
// READS: window.t (i18n), window.codexOpenOmni (omnibar seed).
// SETS:  window.VerseMenu (the React component — written by index.tsx on module load).
// Never use `window as any`; all runtime globals go through vmw() here.

export interface VerseMenuWindow {
  /** i18n lookup — falls back to the key when no translation is found. */
  t?: (k: string) => string | null | undefined;
  /** Opens the omnibar pre-seeded with the given text string. */
  codexOpenOmni?: (seed: string) => void;
  /** The VerseMenu React component — set by index.tsx at load time. */
  VerseMenu?: unknown;
}

export function vmw(): VerseMenuWindow {
  return window as unknown as VerseMenuWindow;
}
