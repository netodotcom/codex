// modules — entry. Assigns window.CODEX_MODULES at import time, exactly as
// legacy/modules.js. Replaces that IIFE in the Vite build (gen-web-entry maps
// it). The named exports here are the ESM equivalent of the legacy `module.exports = API`.
import {
  loadModule,
  loadModuleFromUrl,
  listModules,
  removeModule,
  hasModule,
  VALID_TYPES,
} from "./helpers.js";
import { mw } from "./modules-window.js";
import type { CodexModulesApi } from "./types.js";

const API: CodexModulesApi = {
  loadModule,
  loadModuleFromUrl,
  listModules,
  removeModule,
  hasModule,
  // NOTE: preserved from legacy — VALID_TYPES exposed as a defensive copy
  VALID_TYPES: VALID_TYPES.slice(),
};

// NOTE: preserved from legacy — dual browser/Node guard.
// The `module.exports` arm of the original IIFE is replaced by this module's
// named exports (ESM equivalent; the branch below is dead code in ESM builds).
if (typeof window !== "undefined") mw().CODEX_MODULES = API;

export { loadModule, loadModuleFromUrl, listModules, removeModule, hasModule, VALID_TYPES };
export type { CodexModulesApi, Module, ModuleListItem, ValidType } from "./types.js";
