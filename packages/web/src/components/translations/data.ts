// translations — language metadata + dot glyphs (migrated verbatim from
// translations.jsx). Used by the panel, TxCard, and helpers.

export const TX_LANG_NAMES: Record<string, string> = {
  EN: "English",   ES: "Español",   DE: "Deutsch",   PT: "Português",
  FR: "Français",  LA: "Latina",    HE: "עברית",    EL: "Ἑλληνική",
  HI: "हिन्दी",
};

export const TX_LANG_ORDER: string[] = ["EN", "ES", "FR", "DE", "PT", "LA", "HE", "EL", "HI"];

export type OfflineKind = "full" | "part" | "net";

export const TX_DOT: Record<OfflineKind, string> = { full: "●", part: "◐", net: "○" };
