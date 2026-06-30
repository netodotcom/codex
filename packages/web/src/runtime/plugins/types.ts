// CODEX Plugins — shared TypeScript types.
// Migrated from legacy/plugins.js — shapes are the contract the parity probe
// checks (typeof CODEX_PLUGINS_API === "object").

// Panel render context — plugins receive this in their render() callback.
// The exact shape is owned by the shell that mounts the panel; plugins treat
// it as opaque and only destructure the fields they need.
export type PanelRenderCtx = Record<string, unknown>;

// ── Plugin sub-shapes ────────────────────────────────────────────────────────

export interface Panel {
  id: string;
  label?: string;
  glyph?: string;
  render(ctx: PanelRenderCtx): unknown;
}

export interface VerseAction {
  label: string;
  icon?: string;
  handler(verseRef: unknown): unknown;
}

// ── Plugin shape ─────────────────────────────────────────────────────────────
// Extra fields are allowed — plugins carry arbitrary data alongside the
// required contract fields.

export interface Plugin {
  id: string;
  name: string;
  version: string;
  panels?: Panel[];
  verseActions?: VerseAction[];
  onNavigate?(book: string, chapter: string): void;
  onVerseSelect?(ref: unknown): void;
  [key: string]: unknown;
}

// ── Resolved shapes (output of getPanels / getVerseActions) ─────────────────

export interface ResolvedPanel {
  pluginId: string;
  id: string;
  label: string;
  glyph: string;
  render(ctx: PanelRenderCtx): unknown;
}

export interface ResolvedVerseAction {
  pluginId: string;
  label: string;
  icon: string;
  handler(verseRef: unknown): unknown;
}

// ── Public API shape ─────────────────────────────────────────────────────────
// Faithfully mirrors window.CODEX_PLUGINS_API from legacy/plugins.js.

export interface CodexPluginsApi {
  register(plugin: unknown): boolean;
  list(): Plugin[];
  getPanels(): ResolvedPanel[];
  getVerseActions(): ResolvedVerseAction[];
  dispatch(eventName: string, detail: unknown): void;
  onNavigate(book: string, chapter: string): void;
  onVerseSelect(ref: unknown): void;
}
