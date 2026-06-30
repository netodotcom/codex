// marketplace — typed window boundary (migrated from marketplace.jsx).
// Centralises every runtime global the marketplace reads or writes.
// Callers use mw() and access what they need at call time.
import type { InstalledModule } from "./data.js";

export interface CodexModules {
  listModules(): Promise<InstalledModule[]>;
  loadModuleFromUrl(url: string, id: string): Promise<unknown>;
  removeModule(id: string): Promise<unknown>;
}

export interface PluginPanel {
  id: string;
  label: string;
  glyph: string;
  icon: string;
  render: () => unknown;
}

export interface PluginsApi {
  register(plugin: {
    id: string;
    name: string;
    version: string;
    panels: PluginPanel[];
  }): unknown;
}

export interface MarketplaceWindow {
  CODEX_MODULES?: CodexModules;
  CODEX_PLUGINS_API?: PluginsApi;
  CODEX_MarketplacePanel?: unknown;
}

export function mw(): MarketplaceWindow {
  return window as unknown as MarketplaceWindow;
}
