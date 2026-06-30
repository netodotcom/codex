// data — shared TypeScript types. Faithfully mirrors the shape of
// window.CODEX_DATA assigned by legacy/data.js.

// ── Books ─────────────────────────────────────────────────────────────────────

export type Canon =
  | "deuterocanon"
  | "orthodox"
  | "ethiopian"
  | "armenian"
  | "syriac"
  | "coptic"
  | "pseudepigrapha";

/** Protestant canon book (OT or NT). No `canon` field. */
export interface ProtestantBook {
  readonly id: string;
  readonly name: string;
  readonly testament: "OT" | "NT";
  readonly chapters: number;
}

/** Deuterocanonical / Apocryphal / Pseudepigraphal book. Always carries `canon`. */
export interface DeuterocanonicalBook {
  readonly id: string;
  readonly name: string;
  readonly testament: "DC";
  readonly canon: Canon;
  readonly chapters: number;
}

export type BookEntry = ProtestantBook | DeuterocanonicalBook;

// ── Translations ──────────────────────────────────────────────────────────────

export type TranslationSource = "bible-api" | "bolls" | "bundle";
export type OfflinePriority = "must";

/** ISO 639-1 language tags used in the registry. */
export type LangTag = "EN" | "ES" | "DE" | "PT" | "FR" | "LA" | "HE" | "EL" | "HI" | "HY";

/** Canon scope tags used in translation entries. */
export type CanonTag =
  | "protestant"
  | "ot"
  | "nt"
  | "deuterocanon"
  | "orthodox"
  | "ethiopian"
  | "armenian"
  | "syriac"
  | "coptic"
  | "pseudepigrapha";

export interface TranslationMirror {
  readonly kind: "bible-api" | "bolls";
  readonly apiId: string;
}

export interface TranslationEntry {
  readonly id: string;
  readonly name: string;
  readonly year: string;
  readonly license: string;
  readonly glyph: string;
  readonly lang: LangTag;
  readonly source: TranslationSource;
  readonly apiId: string;
  readonly mirrors?: TranslationMirror[];
  readonly bundle?: string;
  readonly offlinePriority?: OfflinePriority;
  readonly canons?: CanonTag[];
}

// ── Default passage ───────────────────────────────────────────────────────────

export interface DefaultPassage {
  readonly bookId: string;
  readonly chapter: number;
}

// ── Seed panel sub-types ──────────────────────────────────────────────────────

export interface TalmudEntry {
  readonly ref: string;
  readonly heading: string;
  readonly body: string;
  readonly tag: string;
}

export interface CommentaryEntry {
  readonly from: string;
  readonly author: string;
  readonly body: string;
}

export interface GematriaEntry {
  readonly term: string;
  readonly translit: string;
  readonly meaning: string;
  readonly value: number;
  readonly system: string;
}

export interface GnosisEntry {
  readonly sigil: string;
  readonly title: string;
  readonly body: string;
}

export interface CrossRef {
  readonly ref: string;
  readonly note: string;
}

export interface DisarmEntry {
  readonly verse: string;
  readonly weaponization: string;
  readonly quote: string;
  readonly source: string;
  readonly rebuttal: string;
}

export interface DisarmBlock {
  readonly entries: DisarmEntry[];
}

export interface SeedPanel {
  readonly title: string;
  readonly subtitle: string;
  readonly talmud: TalmudEntry[];
  readonly commentary: CommentaryEntry[];
  readonly gematria: GematriaEntry[];
  readonly gematriaNotes: string[];
  readonly gnosis: GnosisEntry[];
  readonly crossRefs: CrossRef[];
  readonly disarm: DisarmBlock;
}

// ── Top-level CODEX_DATA shape ────────────────────────────────────────────────

export interface CodexData {
  readonly books: BookEntry[];
  readonly translations: TranslationEntry[];
  readonly defaultPassage: DefaultPassage;
  readonly seedPanels: Record<string, SeedPanel>;
}
