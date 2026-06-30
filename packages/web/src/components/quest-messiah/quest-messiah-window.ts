// quest-messiah — typed window boundary. Reads window.CODEX_ENGAGEMENT and
// window.codexJumpToRef at call-time; writes window.CODEX_QUESTS on module load.
// Standard browser globals (localStorage, CustomEvent, addEventListener) keep
// their lib.dom typings and are accessed directly.

export interface QuestEntry {
  id: string;
  glyph?: string;
  title: string;
  blurb?: string;
  run?: () => void;
}

export interface EngagementApi {
  emit?(type: string, ref: string | null, weight: number, domain: string | null): void;
}

export interface QuestMessiahWindow {
  CODEX_ENGAGEMENT?: EngagementApi;
  CODEX_QUESTS?: QuestEntry[];
  codexJumpToRef?: (ref: string) => void;
  ReactDOM?: {
    createRoot(container: Element): { render(node: unknown): void; unmount(): void };
  };
}

export function qmw(): QuestMessiahWindow {
  return window as unknown as QuestMessiahWindow;
}
