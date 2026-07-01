// kernel — shared TypeScript types.
// Faithful port of legacy/kernel.js — all public contracts are preserved exactly.

export interface Book {
  id: string;
  name: string;
}

export interface ParsedRef {
  bookId: string;
  bookName: string;
  chapter: number;
  v1: number | null;
  v2: number | null;
}

// ── Tool registry ─────────────────────────────────────────────────────────────

export interface ToolDef {
  name: string;
  // Optional to match legacy: register() (legacy/kernel.js:72) validates only
  // `name` and `run`; consumers (legacy/kernel.js:624) fall back with `|| ""`.
  description?: string;
  sideEffect?: boolean;
  run: (args: Record<string, unknown>) => Promise<string>;
}

export interface ToolSpec {
  name: string;
  description: string;
  sideEffect: boolean;
}

// ── Mission storage ───────────────────────────────────────────────────────────

export interface ArtifactSection {
  heading: string;
  body: string;
}

export interface Artifact {
  title: string;
  summary: string;
  sections: ArtifactSection[];
}

export interface MissionStep {
  kind: "tool" | "section";
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  failed?: boolean;
  heading?: string;
}

export type MissionStatus = "running" | "done" | "aborted" | "error";

export interface Mission {
  id: string;
  intent: string;
  startedAt: number;
  status: MissionStatus;
  steps: MissionStep[];
  artifact: Artifact;
  error?: string;
  finishedAt?: number;
}

export interface KernelRunHandle {
  id: string;
  abort: () => void;
}

// ── Main window.CODEX_KERNEL surface ─────────────────────────────────────────

export interface CodexKernelApi {
  register(tool: ToolDef): boolean;
  tools(): string[];
  toolSpecs(): ToolSpec[];
  call(name: string, args?: Record<string, unknown>): Promise<string>;
  run(intent: string, opts?: { maxSteps?: number }): KernelRunHandle;
  missions(): Mission[];
  parseRef(ref: string): ParsedRef | null;
}

// ── Chat wire shapes ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Strong's lexicon shapes (strongs-hebrew / strongs-greek module entries) ───

export interface StrongsEntry {
  word?: string;
  translit?: string;
  pos?: string;
  gloss?: string;
  def?: string;
  kjv?: string;
}

export type StrongsEntries = Record<string, StrongsEntry>;

// ── localStorage item shapes ──────────────────────────────────────────────────

export interface TrailEntry {
  ref: string;
  at: number;
}

export interface NoteItem {
  id: string;
  text: string;
  ref: string;
  ts: number;
}

// ── Timeline event shape ──────────────────────────────────────────────────────

export interface TimelineEvent {
  year: number;
  title: string;
  summary?: string;
  era?: string;
  people?: string[];
  places?: string[];
  scripture?: string[];
}
