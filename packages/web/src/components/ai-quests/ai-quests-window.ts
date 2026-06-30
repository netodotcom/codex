// ai-quests — typed window boundary (migrated from ai-quests.jsx). The plugin
// reads runtime globals (engagement engine, data/tweaks, jump-to-ref, the QUESTS
// catalog array) and writes two globals (CODEX_QUESTS catalog entry,
// CODEX_AI_QUESTS public API). Callers use aqw() and read/write lazily, at
// call time — exactly like reader-window.ts and vox-window.ts.
import type { Quest, Answers, QuestEnvelope } from "./helpers.js";

export interface CodexEngagement {
  emit?(type: string, ref: string | null, weight: number, domain: string | null): void;
}

export interface CodexTweaks {
  provider?: string;
  model?: string;
}

export interface CodexDataAq {
  tweaks?: CodexTweaks;
}

export interface PluginsApiAq {
  register(plugin: AiQuestsPlugin): unknown;
}

export interface PluginPanelAq {
  id: string;
  label: string;
  glyph: string;
  render: () => unknown;
}

export interface AiQuestsPlugin {
  id: string;
  name: string;
  version: string;
  panels: PluginPanelAq[];
}

export interface QuestCatalogEntry {
  id: string;
  glyph: string;
  title: string;
  blurb: string;
  run: () => void;
}

/** Public surface exposed on window.CODEX_AI_QUESTS (same as legacy). */
export interface AiQuestsApi {
  launchCatalog: () => void;
  launchRunner: (quest: Quest, onCompleteCb?: (e: QuestEnvelope) => void) => void;
  generateQuest: (theme: string) => Promise<unknown>;
  generateFeedback: (quest: Quest, answers: Answers) => Promise<string>;
}

export interface ReactDOMRootAq {
  render(node: unknown): void;
  unmount(): void;
}

export interface AiQuestsWindow {
  CODEX_ENGAGEMENT?: CodexEngagement;
  CODEX_DATA?: CodexDataAq;
  CODEX_PLUGINS_API?: PluginsApiAq;
  codexJumpToRef?: (refStr: string) => void;
  CODEX_QUESTS?: QuestCatalogEntry[];
  CODEX_AI_QUESTS?: AiQuestsApi;
  ReactDOM?: { createRoot(el: Element): ReactDOMRootAq };
}

export function aqw(): AiQuestsWindow {
  return window as unknown as AiQuestsWindow;
}
