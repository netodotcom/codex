// textflow — typed window boundary. Textflow reads codexJumpToRef and ReactDOM
// from the host page and writes TextFlowRoot, textflowParse, and (dynamically
// from the root component's useEffect lifecycle) codexOpenText.
// Exact contract mirrors the Object.assign + delete pattern in the legacy IIFE.
import type React from "react";

// ── Parse-result shapes (mirrored from helpers.ts; kept here so the window
//    contract is self-describing without importing from sibling logic files) ──
export type SefariaSpec = { kind: "sefaria"; tref: string; label: string };
export type BibleSpec = { kind: "bible"; ref: string };
export type WindowParseResult = SefariaSpec | BibleSpec;

// ── The window ────────────────────────────────────────────────────────────────
export interface TextFlowWindow {
  // Set at module load by Object.assign in index.tsx
  TextFlowRoot?: React.ComponentType;
  textflowParse?: (spec: unknown) => WindowParseResult | null;
  // Set/cleared by TextFlowRoot's useEffect (same timing as the legacy)
  codexOpenText?: (spec: unknown) => boolean;
  // Read by TextFlowRoot to resolve bible refs to the main reader
  codexJumpToRef?: (ref: string) => void;
  // CDN ReactDOM — used by the mount IIFE in index.tsx
  ReactDOM?: {
    createRoot(
      container: Element | DocumentFragment,
    ): { render(children: React.ReactNode): void };
  };
}

export function tfw(): TextFlowWindow {
  return window as unknown as TextFlowWindow;
}
