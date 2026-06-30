// panels-gen — shared TypeScript types.
// Migrated from legacy/panels-gen.js — shapes are the contract for
// window.CODEX_PANELS, window.CODEX_PANELS_ENGINE, and window.CODEX_QUESTGEN.

// ── Engine ─────────────────────────────────────────────────────────────────────

export interface Engine {
  provider: string;
  model: string;
}

// ── Panel data (CODEX_PANELS.load → PanelData) ────────────────────────────────

export interface TalmudEntry {
  ref: string;
  heading: string;
  body: string;
  tag: string;
}

export interface CommentaryEntry {
  from: string;
  author: string;
  body: string;
}

export interface GematriaEntry {
  term: string;
  translit: string;
  meaning: string;
  value: number;
  system: string;
}

export interface GnosisEntry {
  sigil: string;
  title: string;
  body: string;
}

export interface CrossRef {
  ref: string;
  note: string;
}

export interface GematriaDeepCrossMatchEntry {
  ref: string;
  word: string;
  note: string;
}

export interface GematriaDeepCrossMatch {
  value: number;
  via_system: string;
  matches: GematriaDeepCrossMatchEntry[];
}

export interface GematriaDeepNotarikon {
  phrase: string;
  expansion: string;
}

export interface GematriaDeepTemurah {
  transform: string;
  result: string;
  note: string;
}

export interface GematriaDeepRabbinicSource {
  name: string;
  quote: string;
}

export interface KabbalahSefirotResonance {
  sefirah: string;
  value: number;
  note: string;
}

export interface KabbalahZoharCitation {
  ref: string;
  text: string;
}

export interface GematriaDeepKabbalah {
  sefirot_resonances: KabbalahSefirotResonance[];
  lurianic_frame: string;
  lurianic_note: string;
  partzuf: string;
  partzuf_note: string;
  zohar_citations: KabbalahZoharCitation[];
}

export interface GematriaDeep {
  _schema: 2;
  primary_word: string;
  primary_translit: string;
  primary_gloss: string;
  primary_lang: string;
  symbolic_meaning: string;
  cross_matches: GematriaDeepCrossMatch[];
  notarikon: GematriaDeepNotarikon[];
  temurah: GematriaDeepTemurah[];
  rabbinic_sources: GematriaDeepRabbinicSource[];
  ai_insight: string;
  kabbalah?: GematriaDeepKabbalah;
}

export interface PanelData {
  title: string;
  subtitle: string;
  talmud: TalmudEntry[];
  commentary: CommentaryEntry[];
  gematria: GematriaEntry[];
  gematriaNotes: string[];
  gematriaDeep?: GematriaDeep;
  gnosis: GnosisEntry[];
  crossRefs: CrossRef[];
  _provider?: string;
  _model?: string | null;
}

// ── Cache meta ─────────────────────────────────────────────────────────────────

export interface CacheStatEntry {
  ref: string;
  bytes: number;
  fetchedAt: number;
}

// ── Panel events (CODEX_PANELS.subscribe callback) ────────────────────────────

export type PanelEvent =
  | { type: "start"; bookId: string; chapter: string | number }
  | { type: "done"; bookId: string; chapter: string | number; data: PanelData }
  | { type: "error"; bookId: string; chapter: string | number; error: Error };

export type PanelListener = (event: PanelEvent) => void;

// ── Exegesis data ──────────────────────────────────────────────────────────────

export interface KeyTerm {
  term: string;
  original: string;
  translit: string;
  lexical_range: string;
  translation_choices: string;
}

export interface IntertextualEcho {
  ref: string;
  note: string;
}

export interface ExegeticalOption {
  view: string;
  scholars: string;
  argument: string;
}

export interface ExegesisData {
  _schema: 2;
  key_terms: KeyTerm[];
  literary_structure: string;
  historical_context: string;
  intertextual_echoes: IntertextualEcho[];
  exegetical_options: ExegeticalOption[];
  preferred_reading: string;
  theological_implication: string;
  applicational_pivot: string;
  _provider?: string;
  _model?: string | null;
}

// ── Translation Analysis data ──────────────────────────────────────────────────

export interface Rendering {
  translation: string;
  year: number;
  philosophy: string;
  text: string;
  key_choice: string;
}

export interface DivergencePoint {
  issue: string;
  options: string[];
  philosophy_split: string;
}

export interface TxAnalysisData {
  _schema: 2;
  verse_ref: string;
  renderings: Rendering[];
  divergence_points: DivergencePoint[];
  best_for_study: string;
  best_for_devotion: string;
  best_for_originalist: string;
  _provider?: string;
  _model?: string | null;
}

export interface TranslationInput {
  id: string;
  name?: string;
  year?: number | string;
  philosophy?: string;
  text?: string;
}

// ── Disarm data ────────────────────────────────────────────────────────────────

export interface DisarmEntry {
  verse: string;
  weaponization: string;
  quote: string;
  source: string;
  rebuttal: string;
}

export interface DisarmData {
  entries: DisarmEntry[];
  _provider?: string;
  _model?: string | null;
}

// ── Quest data (CODEX_QUESTGEN.generate → QuestModule) ────────────────────────

export type QuestKind = "read" | "find" | "connect" | "reflect";

export interface QuestMeta {
  id: string;
  type: "quest";
  title: string;
  tradition: string;
  domain: string;
  ring: string;
  estSteps: number;
  generated: true;
  fallback?: true;
  provider?: string;
  model?: string | null;
}

export interface QuestStep {
  kind: QuestKind;
  refs: string[];
  prompt: string;
  reveal: string;
}

export interface QuestModule {
  meta: QuestMeta;
  steps: QuestStep[];
}

// ── Load option types ──────────────────────────────────────────────────────────

export interface LoadOpts {
  provider?: string;
  model?: string;
  force?: boolean;
}

export interface ExegesisOpts {
  provider?: string;
  model?: string;
  force?: boolean;
  passageLabel?: string;
}

export interface TxAnalysisOpts {
  provider?: string;
  model?: string;
  force?: boolean;
  passageLabel?: string;
}

export interface DisarmPassage {
  bookId: string;
  chapter: string | number;
  book?: string;
}

export interface DisarmOpts {
  passage?: DisarmPassage;
  currentVerse?: string | number;
  lang?: string;
  engine?: Partial<Engine>;
  model?: string;
  force?: boolean;
  provider?: string;
}

export interface QuestGenOpts {
  provider?: string;
  model?: string;
  force?: boolean;
  tradition?: string;
  domain?: string;
  steps?: number;
}
