// verse-mirror — pure helpers + shared constants (migrated verbatim from
// verse-mirror.jsx). mirrorJumpRef has a window-boundary read but its logic
// is testable; everything else is side-effect-free.
import { mw } from "./verse-mirror-window.js";

// ── Schema version ────────────────────────────────────────────────────────
export const MIRROR_SCHEMA_V = 2;

// ── AI prompt ─────────────────────────────────────────────────────────────
// Verbatim from the legacy — content must not change.
export const MIRROR_PROMPT = `You are CODEX MIRROR — a comparative-historian and scholar of biblical resonance through history. For the given verse, return a single JSON object surveying its historical parallels, modern geopolitical resonances, prophetic interpretive traditions, and canonical cross-references. Calm, scholarly, neutral. No prose outside the JSON. No fences.

Schema:
{
  "theme":     "1 short clause naming the verse's central theme that drives the mirroring (e.g. 'covenant fidelity tested by exile').",
  "summary":   "2 sentences situating the verse's enduring resonance — why scholars + theologians return to it across history.",
  "verseYear": <integer year the verse's events happened (or book written for non-narrative), negative = BCE>,
  "pattern":   "1 sentence naming the recurring STRUCTURAL pattern the parallels share (e.g. 'an empire at its peak humiliated within a generation of deifying itself') — the shape an analyst would flag.",

  "historicalParallels": [
    // 4-6 events FROM HISTORY that mirror this passage. Span multiple eras
    // and geographies. Each: a real event with verifiable name + approximate
    // date. The 'connection' is a SCHOLARLY observation, never a sermon.
    {
      "era":        "Era / period (e.g. '6th cent. BCE', 'Reformation')",
      "year":       <integer year, negative = BCE; best estimate>,
      "event":      "Named event (e.g. 'Babylonian conquest of Judah')",
      "place":      "Geographic centre (e.g. 'Jerusalem')",
      "lat":        <decimal latitude of that place>,
      "lng":        <decimal longitude>,
      "intensity":  <0-100 — strength of the scholarly resonance: how directly and how often scholars have drawn this parallel>,
      "connection": "1-2 sentences on the parallel — what scholars notice. Cite the figure/source if well-known.",
      "wiki":       "EN-Wikipedia article slug if confident (e.g. 'Council_of_Nicaea'). Empty string if unsure."
    }
  ],

  "modernResonances": [
    // 2-5 RECENT geopolitical events (last ~30 years, prefer last 10) where
    // commentators / theologians / journalists have drawn parallels with
    // this passage. Cite the OBSERVER, not just the event, when the parallel
    // is contested. Don't invent events.
    {
      "year":       <integer year>,
      "event":      "Real, named event",
      "place":      "Geographic centre",
      "lat":        <decimal latitude>,
      "lng":        <decimal longitude>,
      "intensity":  <0-100 — strength/frequency of the drawn parallel>,
      "contested":  <true if the parallel is disputed or partisan>,
      "connection": "1-2 sentences — who has drawn the parallel and why. Note when contested.",
      "wiki":       "EN-Wikipedia article slug if confident. Empty string if unsure."
    }
  ],

  "propheticReadings": [
    // 3-5 entries surveying how DIFFERENT eschatological schools read the
    // verse. ALWAYS multiple traditions side-by-side (you are a surveyor,
    // not an advocate). Possible: 'Premillennial', 'Amillennial',
    // 'Postmillennial', 'Preterist', 'Historicist', 'Idealist',
    // 'Dispensationalist', 'Rabbinic', 'Patristic', 'Apocalyptic-Gnostic'.
    {
      "tradition":      "Tradition name",
      "interpretation": "1-3 sentences — calm scholarly summary, never endorsement.",
      "keyVoice":       "1-line cite of a representative voice. Empty string if not famous."
    }
  ],

  "crossReferences": [
    // 4-8 canonical cross-refs — verses that resonate with this one.
    { "ref": "Book ch:vv", "note": "1 short clause — under 12 words." }
  ],

  "caveats": [
    // 1-3 short scholarly caveats — interpretive limits, contested
    // attributions, genre constraints.
    "..."
  ]
}

Rules:
- Real events only. No invented figures. If unsure of a date, best estimate marked 'c.' in the era.
- lat/lng must be real-world coordinates of the named place. No invented numbers.
- intensity reflects the documented weight of the parallel in scholarship/commentary — not drama.
- Multiple prophetic traditions ALWAYS. Never just one — the value is in the spread.
- Modern resonances must cite a real observer when the parallel is non-obvious; set contested honestly.
- crossReferences use canonical book names ("John 1:1", "1 Corinthians 13:4-8").
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON object.`;

// ── Mirror data types (schema v2) ─────────────────────────────────────────

export interface HistoricalEvent {
  era?: string;
  year: number;
  event: string;
  place?: string;
  lat?: number;
  lng?: number;
  intensity?: number;
  connection?: string;
  wiki?: string;
}

export interface ModernResonance {
  year: number;
  event: string;
  place?: string;
  lat?: number;
  lng?: number;
  intensity?: number;
  contested?: boolean;
  connection?: string;
  wiki?: string;
}

export interface PropheticReading {
  tradition: string;
  interpretation: string;
  keyVoice?: string;
}

export interface CrossRef {
  ref: string;
  note: string;
}

export interface MirrorData {
  theme?: string;
  summary?: string;
  verseYear?: number;
  pattern?: string;
  historicalParallels?: HistoricalEvent[];
  modernResonances?: ModernResonance[];
  propheticReadings?: PropheticReading[];
  crossReferences?: CrossRef[];
  caveats?: string[];
  _schema?: number;
}

export type EventKind = "hist" | "mod";

export interface CombinedEvent {
  id: string;
  kind: EventKind;
  year: number;
  event: string;
  place?: string;
  lat?: number;
  lng?: number;
  intensity?: number;
  connection?: string;
  wiki?: string;
  era?: string;
  contested?: boolean;
}

// ── mirrorJumpRef ─────────────────────────────────────────────────────────
// Navigate the reader to a cross-reference. Prefer the prop wired from
// app.jsx; fall back to the global jump fn so the Mirror still works when
// opened from contexts that don't pass onJumpRef.
export function mirrorJumpRef(
  onJumpRef: ((ref: string) => void) | undefined,
  ref: string,
): void {
  if (typeof onJumpRef === "function") { onJumpRef(ref); return; }
  const fn = mw().codexJumpToRef;
  if (typeof fn === "function") fn(ref);
}
