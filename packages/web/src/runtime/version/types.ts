// version — shared types for the version engine.

export interface CodexVersion {
  v: string;      // user-facing app version
  sw: string;     // service-worker cache generation
  notes: string[]; // what's-new notes (first 4 shown in the card)
}
