// modules — shared TypeScript types.

export type ValidType =
  | "lexicon"
  | "concordance"
  | "cross-reference"
  | "commentary"
  | "reading-plan"
  | "timeline"
  | "map-overlay"
  | "dictionary"
  | "parsha"
  | "cantillation";

export interface ModuleMeta {
  id: string;
  version: string;
  type: ValidType;
  name?: string;
  lang?: string;
  installedAt?: number | null;
  [key: string]: unknown;
}

export interface Module {
  meta: ModuleMeta;
  [key: string]: unknown;
}

export interface ModuleListItem {
  id: string;
  type: ValidType;
  version: string;
  name: string | undefined;
  lang: string | undefined;
  installedAt: number | null;
}

export interface CodexModulesApi {
  loadModule(id: string): Promise<Module>;
  loadModuleFromUrl(url: string, expectedId: string): Promise<Module>;
  listModules(): Promise<ModuleListItem[]>;
  removeModule(id: string): Promise<void>;
  hasModule(id: string): Promise<boolean>;
  VALID_TYPES: string[];
}
