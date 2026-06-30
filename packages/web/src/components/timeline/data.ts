// timeline — era/category metadata + the cached event loader (migrated from
// timeline.jsx). The engines outlive the skin; this is the same data surface v1
// exposed (ERAS / CATEGORIES / loadEvents).

export interface Era {
  id: string;
  label: string;
  tint: string;
}
export interface Category {
  id: string;
  label: string;
  glyph: string;
}
export interface TimelineEvent {
  id: string;
  year: number;
  year_range?: [number, number];
  era: string;
  category: string;
  title: string;
  summary?: string;
  scripture?: string[];
  people?: string[];
  places?: string[];
}

// Order matters (chronological).
export const ERAS: Era[] = [
  { id: "primeval", label: "Primeval", tint: "#5a4a8a" },
  { id: "patriarchs", label: "Patriarchs", tint: "#7a5a3a" },
  { id: "egypt-exodus", label: "Egypt & Exodus", tint: "#b08040" },
  { id: "conquest", label: "Conquest", tint: "#a04848" },
  { id: "judges", label: "Judges", tint: "#806038" },
  { id: "united-monarchy", label: "United Monarchy", tint: "#b89030" },
  { id: "divided-kingdom", label: "Divided Kingdom", tint: "#7a8030" },
  { id: "exile", label: "Exile", tint: "#406878" },
  { id: "return", label: "Return", tint: "#3a8878" },
  { id: "intertestamental", label: "Intertestamental", tint: "#506060" },
  { id: "life-of-christ", label: "Life of Christ", tint: "#c0a040" },
  { id: "apostolic", label: "Apostolic Age", tint: "#3098b8" },
  { id: "post-canonical", label: "Post-Canonical", tint: "#6850a0" },
];
export const ERA_LOOKUP: Record<string, Era> = Object.fromEntries(ERAS.map((e) => [e.id, e]));

export const CATEGORIES: Category[] = [
  { id: "narrative", label: "Narrative", glyph: "◆" },
  { id: "prophecy", label: "Prophecy", glyph: "✦" },
  { id: "war", label: "War", glyph: "⚔" },
  { id: "covenant", label: "Covenant", glyph: "◈" },
  { id: "miracle", label: "Miracle", glyph: "✺" },
  { id: "council", label: "Council", glyph: "❖" },
  { id: "martyrdom", label: "Martyrdom", glyph: "✝" },
  { id: "writing", label: "Writing", glyph: "✎" },
];
export const CAT_LOOKUP: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

interface LoaderWindow {
  CODEX_MODULES?: { loadModule(id: string): Promise<{ events?: TimelineEvent[] }> };
}

// Data loader (cached on a module-scope singleton, matching the legacy State).
const State: { events: TimelineEvent[] | null; loading: Promise<TimelineEvent[]> | null } = { events: null, loading: null };

export function cachedEvents(): TimelineEvent[] | null {
  return State.events;
}

export async function loadEvents(): Promise<TimelineEvent[]> {
  if (State.events) return State.events;
  if (State.loading) return State.loading;
  State.loading = (async () => {
    try {
      let json: { events?: TimelineEvent[] };
      const w = window as unknown as LoaderWindow;
      if (w.CODEX_MODULES) {
        json = await w.CODEX_MODULES.loadModule("timeline-events");
      } else {
        const r = await fetch("data/modules/timeline-events.json");
        json = (await r.json()) as { events?: TimelineEvent[] };
      }
      const events = (json.events || []).slice().sort((a, b) => a.year - b.year);
      State.events = events;
      return events;
    } catch (e) {
      console.warn("[timeline] load failed:", e);
      State.events = [];
      return [];
    } finally {
      State.loading = null;
    }
  })();
  return State.loading;
}
