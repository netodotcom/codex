// plans — domain types (migrated from plans.jsx). A "plan" is a CODEX_MODULES
// module: { meta, days }. parseReading classifies a reading ref into a scripture
// / talmud / unknown shape. Continuity mirrors the unified engagement snapshot.

export interface PlanMeta {
  id: string;
  name: string;
  days: number;
  description: string;
  // Bundled previews flag themselves partial; the card shows "· preview".
  _partial?: boolean;
}

export interface PlanDay {
  day: number;
  readings: string[];
  // Torah-triennial days carry a parshah + liturgical year.
  parshah?: string;
  year?: number | string;
}

export interface Plan {
  meta: PlanMeta;
  days: PlanDay[];
}

export interface ParsedReading {
  kind: "talmud" | "unknown" | "scripture";
  label: string;
  navRef: string | null;
  book?: string;
  start?: number;
  end?: number;
}

// Unified continuity snapshot (window.CODEX_ENGAGEMENT.continuity()).
export interface Continuity {
  current?: number;
  longest?: number;
}
