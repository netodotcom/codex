// artifacts — migrated feature entry (THE ARTIFACTS ENGINE). Replaces
// dist/artifacts.js in the Vite build (gen-web-entry maps it). Importing
// "./busy.js" runs the AI-BUSY bus install on load (the legacy IIFE), exactly as
// the legacy module did before assigning its public surface; then this file
// re-exposes the SAME window globals the legacy artifacts.jsx set:
//   · window.CODEX_AI_BUSY   (installed by ./busy.js, guarded)
//   · window.CODEX_ARTIFACTS (the public surface below)
//   · window.ArtifactsRich   (Object.assign re-export)
import React from "react";
import "./busy.js"; // side-effect: installs window.CODEX_AI_BUSY (idempotent)
import { ArtifactsRich } from "./ArtifactsRich.js";
import { artSplitOnRefs } from "./refs.js";
import { artRunAction, artOpenPanel, artSetTweak, artJump } from "./actions.js";
import { artDirectiveDoc } from "./directive-doc.js";
import { artEnsureCss } from "./style.js";
import { artParseBlocks } from "./blocks.js";

interface ArtifactsExportWindow {
  CODEX_ARTIFACTS?: {
    Rich: typeof ArtifactsRich;
    render(text: unknown): React.ReactElement;
    splitOnRefs: typeof artSplitOnRefs;
    runAction: typeof artRunAction;
    openPanel: typeof artOpenPanel;
    setTweak: typeof artSetTweak;
    jump: typeof artJump;
    directiveDoc: typeof artDirectiveDoc;
    ensureCss: typeof artEnsureCss;
    parseBlocks: typeof artParseBlocks;
  };
  ArtifactsRich?: typeof ArtifactsRich;
}
function aew(): ArtifactsExportWindow {
  return window as unknown as ArtifactsExportWindow;
}

// ── Public surface ────────────────────────────────────────────────────────
aew().CODEX_ARTIFACTS = {
  Rich: ArtifactsRich,
  render(text: unknown): React.ReactElement {
    return React.createElement(ArtifactsRich, { text: String(text == null ? "" : text) });
  },
  splitOnRefs: artSplitOnRefs,
  runAction: artRunAction,
  openPanel: artOpenPanel,
  setTweak: artSetTweak,
  jump: artJump,
  directiveDoc: artDirectiveDoc,
  ensureCss: artEnsureCss,
  parseBlocks: artParseBlocks, // exposed for tests
};
Object.assign(window, { ArtifactsRich });
