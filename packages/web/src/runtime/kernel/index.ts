// kernel — entry point. Assigns window.CODEX_KERNEL at import time, exactly
// as legacy/kernel.js. Replaces that IIFE in the Vite build (gen-web-entry
// maps it). Named exports are the ESM equivalent of the legacy global surface.
import {
  TOOLS,
  register,
  toolSpecs,
  call,
  run,
  loadMissions,
  parseRef,
} from "./helpers.js";
import { kw } from "./kernel-window.js";
import type { CodexKernelApi, ToolDef } from "./types.js";

// NOTE: preserved from legacy — idempotency guard at top of IIFE
if (!kw().CODEX_KERNEL) {
  // Optional semantic search — registered only if the engine ships it.
  // NOTE: preserved from legacy — checked at load time against live window state
  const search = kw().CODEX_SEARCH;
  if (search && typeof search.searchSemantic === "function") {
    const semanticRun: ToolDef["run"] = async (args) => {
      const s = kw().CODEX_SEARCH;
      if (!s?.searchSemantic) return "No conceptual matches.";
      const hits = await s.searchSemantic(String(args["query"] ?? ""), { limit: 8 });
      if (!Array.isArray(hits) || !hits.length) return "No conceptual matches.";
      return hits
        .slice(0, 8)
        .map(
          (h) =>
            (h.ref ?? h.id ?? "") +
            " — " +
            String(h.text ?? h.snippet ?? "").trim().slice(0, 160),
        )
        .join("\n");
    };
    register({
      name: "semantic_search",
      description:
        "Conceptual search (meaning, not keywords) across cached scripture. args: {query}.",
      run: semanticRun,
    });
  }

  const API: CodexKernelApi = {
    register,
    tools: () => Object.keys(TOOLS),
    // {name, description, sideEffect} for every registered tool — lets chat
    // surfaces (the Oracle's agentic mode) teach the model the live registry.
    toolSpecs,
    call,
    run,
    missions: loadMissions,
    parseRef,
  };

  kw().CODEX_KERNEL = API;
}

export {
  register,
  toolSpecs,
  call,
  run,
  loadMissions,
  parseRef,
  TOOLS,
};
export type { CodexKernelApi, ToolDef } from "./types.js";
