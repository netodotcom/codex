// panels — i18n boundary (Backlog 4.1). Mirrors the legacy `(window.t && window.t(k)) || fallback`
// pattern: use the global translator if present, else the inline fallback string.
// (The migrated @codex/core i18n becomes the source once the i18n layer is wired
// into window; until then this preserves exact behavior.)
interface TWindow {
  t?: (key: string) => string;
}

export function tx(key: string, fallback: string): string {
  const fn = (window as unknown as TWindow).t;
  if (fn) {
    const v = fn(key);
    // i18n returns the key itself on a miss → treat that as "use the fallback".
    if (v && v !== key) return v;
  }
  return fallback;
}
