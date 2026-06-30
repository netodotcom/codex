// panels — shared panel data + prop types (Backlog 4.1).
import type { CacheMeta, PanelStatusState } from "./chrome.js";

export interface TalmudEntry {
  ref?: string;
  heading?: string;
  body?: string;
  tag?: string;
}

export interface CommentaryEntry {
  from?: string;
  author?: string;
  body?: string;
}

export interface CrossRef {
  ref: string;
  note?: string;
}

export interface GnosisEntry {
  sigil?: string;
  title?: string;
  body?: string;
}

export interface GematriaEntry {
  term: string;
  translit?: string;
  meaning?: string;
  value: number;
  system?: string;
}

export interface PanelData {
  title?: string;
  subtitle?: string;
  talmud: TalmudEntry[];
  commentary: CommentaryEntry[];
  gematria: GematriaEntry[];
  gematriaNotes?: string[];
  gnosis: GnosisEntry[];
  crossRefs: CrossRef[];
  [key: string]: unknown;
}

export interface Passage {
  book: string;
  chapter: number;
}

export interface PanelProps {
  panelData: PanelData | null;
  status: PanelStatusState;
  meta?: CacheMeta | null;
  passage: Passage;
  onRegenerate: () => void;
}
