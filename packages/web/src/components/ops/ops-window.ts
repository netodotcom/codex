// ops — typed window boundary (migrated from ops.jsx). The VerseOps component
// reads several runtime globals (the kernel engine, the artifacts renderer, the
// TTS hook, the jump-to-ref navigator, and the IntelBanner shared UI). The only
// global it SETS is window.VerseOps. Centralise typing here; callers call ow()
// and read/write lazily at call time — exactly like reader-window.ts / vox-window.ts.
import type React from "react";

// ── Artifact shapes ──────────────────────────────────────────────────────────
export interface OpsArtifactSection {
  heading: string;
  body: string;
}

export interface OpsArtifact {
  title: string;
  summary: string;
  sections: OpsArtifactSection[];
}

// ── Kernel mission history shapes ────────────────────────────────────────────
export interface OpsStep {
  kind?: string;
  heading?: string;
  tool?: string;
  result?: unknown;
  failed?: boolean;
}

export interface OpsHistoryMission {
  id: string;
  intent: string;
  status: string;
  artifact?: OpsArtifact;
  steps?: OpsStep[];
  startedAt: number;
}

// ── Kernel engine contract ────────────────────────────────────────────────────
export interface OpsKernelController {
  abort(): void;
}

export interface OpsKernelEngine {
  missions(): OpsHistoryMission[];
  run(text: string): OpsKernelController;
  tools(): unknown[];
}

// ── Artifacts renderer (window.CODEX_ARTIFACTS) ───────────────────────────────
export interface OpsArtifactsEngine {
  Rich: React.ComponentType<{ text: string }>;
}

// ── The window ────────────────────────────────────────────────────────────────
export interface OpsWindow {
  CODEX_KERNEL?: OpsKernelEngine;
  CODEX_ARTIFACTS?: OpsArtifactsEngine;
  codexSpeak?: (text: string) => void;
  codexJumpToRef?: (ref: string) => void;
  speechSynthesis?: SpeechSynthesis;
  IntelBanner?: React.ComponentType<{ console?: string; scope?: string; note?: string }>;
  VerseOps?: unknown;
}

export function ow(): OpsWindow {
  return window as unknown as OpsWindow;
}
