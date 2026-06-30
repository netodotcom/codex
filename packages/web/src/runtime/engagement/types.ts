// Engagement — shared TypeScript types.
// Covers both the Hook-Model layer (CODEX_ENGAGE) and the
// Continuity & Mastery layer (CODEX_ENGAGEMENT / CODEX_QUESTGEN).

// ══════════════════════════════════════════════════════════════════════════════
// IIFE 1: Hook-Model Engine → window.CODEX_ENGAGE
// ══════════════════════════════════════════════════════════════════════════════

export interface EngageStats {
  firstOpen: string;
  sessionCount: number;
  /** { "gen.1": "2024-01-15", ... } */
  chaptersRead: Record<string, string>;
  totalChapters: number;
  versesHighlighted: number;
  notesCreated: number;
  panelsViewed: number;
  oracleQuestions: number;
  searchesPerformed: number;
  reelsViewed: number;
  questsCompleted: number;
  lastSession: string | null;
}

export interface EngageStreak {
  current: number;
  longest: number;
  lastDate: string | null;
  history: Record<string, boolean>;
}

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  readonly icon: string;
  readonly tier: number;
  readonly check: (s: EngageStats, streak: EngageStreak) => boolean;
}

export type DiscoveryType =
  | "verse-of-day"
  | "word-spotlight"
  | "number-pattern"
  | "cross-echo"
  | "did-you-know"
  | "name-of-god"
  | "prophecy-pair";

export interface CuratedDailyEntry {
  type: DiscoveryType;
  title: string;
  ref: string;
  body: string;
}

export interface DailyDiscovery extends CuratedDailyEntry {
  date: string;
  seed: number;
}

export interface EngageSession {
  bookId: string;
  chapter: string | number;
  bookName: string;
  ts: number;
}

export interface ReelCard {
  type?: string | null;
  id?: string | null;
  anchor?: string | null;
  title?: string | null;
  book?: string | null;
}

export interface ReelLike {
  key: string;
  type: string | null;
  anchor: string | null;
  title: string | null;
  book: string | null;
  ts: number;
}

export interface StreakWarningResult {
  level: "warn";
  msg: string;
  current: number;
}

export interface TimeOfDaySuggestion {
  period: "morning" | "afternoon" | "evening" | "night";
  suggestion: string;
  book: string;
}

export interface OracleCtx {
  book?: string;
}

export interface ToggleReelLikeResult {
  liked: boolean;
  achievements: Achievement[];
}

export interface ReaderProfile {
  cardTypes: Record<string, number>;
  books: Record<string, number>;
  likedKeys: Record<string, boolean>;
  topBooks: string[];
  topTypes: string[];
  likeCount: number;
  hasSignal: boolean;
  tier: "deep" | "engaged" | "warming" | "new";
}

export interface CodexEngage {
  // Data loaders
  loadStats(): EngageStats;
  loadStreak(): EngageStreak;
  loadUnlocked(): Record<string, string>;
  loadSession(): EngageSession | null;
  saveSession(bookId: string, chapter: string | number, bookName: string): void;
  // Core cycle
  recordDay(): EngageStreak;
  checkAchievements(): Achievement[];
  getDailyDiscovery(): DailyDiscovery;
  streakWarning(): StreakWarningResult | null;
  timeOfDaySuggestion(): TimeOfDaySuggestion;
  engagementScore(): number;
  ACHIEVEMENTS: Achievement[];
  // Notifications
  requestNotifications(): Promise<boolean>;
  fireNotification(title: string, body: string): void;
  // Convenience trackers — each returns newly-unlocked achievements.
  trackChapter(bookId: string, chapter: string | number): Achievement[];
  trackHighlight(): Achievement[];
  trackNote(): Achievement[];
  trackOracle(ctx?: OracleCtx | null): Achievement[];
  trackSearch(): Achievement[];
  trackPanel(): Achievement[];
  trackReel(): Achievement[];
  trackQuest(): Achievement[];
  trackSession(): Achievement[];
  // Reel likes
  isReelLiked(card: ReelCard): boolean;
  toggleReelLike(card: ReelCard): ToggleReelLikeResult;
  getReelLikes(): ReelLike[];
  clearProfile(): { ok: boolean };
  buildReaderProfile(): ReaderProfile;
}

// ══════════════════════════════════════════════════════════════════════════════
// IIFE 2: Continuity & Mastery Engine → window.CODEX_ENGAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

export type Domain =
  | "hebrew-greek"
  | "cross-references"
  | "gematria"
  | "talmud"
  | "patristics"
  | "gnosis"
  | "geography"
  | "canon-coverage";

export type DepthActionType =
  | "strongs-lookup"
  | "lemma-open"
  | "word-study-complete"
  | "crossref-follow"
  | "crossref-chain"
  | "gematria-lookup"
  | "gematria-match"
  | "daf-read"
  | "mishnah-study"
  | "patristics-read"
  | "gnosis-read"
  | "map-place-study"
  | "passage-guide-read"
  | "chapter-closed"
  | "study-built"
  | "note-written"
  | "discovery-logged"
  | "quest-step";

export interface DepthActionSpec {
  weight: number;
  domain: Domain | null;
}

export interface MasteryLevelSpec {
  level: number;
  min: number;
  key: string;
  en: string;
}

export interface MilestoneRule {
  id: string;
  domain: Domain;
  count: DepthActionType;
  n: number;
  labelEn: string;
}

/** Persisted shape in localStorage. `lastCountDay` added lazily on first tick. */
export interface ContinuityState {
  current: number;
  longest: number;
  lastDay: string | null;
  todayCount: number;
  countedToday: boolean;
  grace: number;
  graceSpentDays: Record<string, boolean>;
  sinceGrace: number;
  ringStart: string | null;
  history: Record<string, boolean>;
  /** Added lazily — not present in defaultContinuity(). */
  lastCountDay?: string;
}

export interface MasteryCell {
  score: number;
  threads: number;
  level: number;
  lastTs: number | null;
}

export type MasteryStateRecord = Record<Domain, MasteryCell>;

export interface ContinuityStatus {
  current: number;
  longest: number;
  lastDay: string | null;
  countedToday: boolean;
  grace: number;
  graceCap: number;
  graceSpent: number;
  graceGranted: number;
  ringStart: string | null;
  sinceGrace: number;
  nextGraceIn: number;
  statusKey: string;
  statusText: string;
}

export interface MasteryCellFull extends MasteryCell {
  domain: Domain;
  levelLabel: string;
  levelKey: string;
}

export interface BumpMasteryResult {
  domain: Domain;
  score: number;
  level: number;
  threads: number;
  levelLabel: string;
}

export interface MilestoneDetail {
  id: string;
  day: string;
  label?: string;
  [key: string]: unknown;
}

export interface MilestonesSnapshot {
  unlocked: Record<string, string>;
  counters: Record<string, number>;
  rules: MilestoneRule[];
}

export interface LogEvent {
  ts: number;
  type: string;
  ref: string | null;
  weight: number;
  domain: Domain | null;
  /** Auto-set by IDB autoIncrement. */
  id?: number;
}

export interface EngConfig {
  dailyThreshold: number;
}

export interface RecordInput {
  type: string;
  ref?: string | null;
  weight?: number;
  domain?: Domain | null;
  ts?: number;
}

export interface RecordSummary {
  recorded: LogEvent;
  continuity: ContinuityStatus;
  mastery: BumpMasteryResult | null;
}

export type QuestStatus = "available" | "active" | "complete";

export interface QuestStateEntry {
  status: QuestStatus;
  step: number;
  startedAt: number | null;
  updatedAt: number | null;
  completedAt: number | null;
}

export interface QuestMeta {
  id: string;
  title: string;
  tradition?: string | null;
  domain?: Domain | null;
  ring?: string | null;
}

export interface QuestStep {
  [key: string]: unknown;
}

export interface QuestModule {
  meta: QuestMeta;
  steps: QuestStep[];
}

export interface QuestPack {
  quests: QuestModule[];
}

export interface QuestListItem {
  id: string;
  title: string;
  tradition: string | null;
  domain: Domain | null;
  steps: number;
  ring: string | null;
  status: QuestStatus;
  step: number;
}

export interface NextThreadCtx {
  ref?: string;
  book?: string;
  library?: Array<{ ref?: string; gematria?: number }>;
  parsha?: string;
  daf?: string;
  crossrefsAvailable?: boolean;
}

export interface NextThreadSuggestion {
  kind: "quest" | "quest-start" | "gematria" | "crossref" | "daf" | "parsha" | "none";
  title: string;
  reason: string | null;
  questId?: string;
  step?: number;
  value?: number;
  refs?: string[];
  ref?: string;
}

export interface Season {
  [key: string]: unknown;
}

export interface ExportBundle {
  format: "codex.engagement";
  version: 1;
  exportedAt: string;
  continuity: ContinuityState | null;
  mastery: MasteryStateRecord | null;
  milestones: Record<string, string> | null;
  counters: Record<string, number>;
  quests: Record<string, QuestStateEntry> | null;
  config: EngConfig;
  eventlog: LogEvent[];
}

export interface CodexEngagement {
  // version + taxonomy
  readonly VERSION: string;
  readonly DOMAINS: readonly Domain[];
  readonly DEPTH_ACTIONS: Record<DepthActionType, DepthActionSpec>;
  readonly MASTERY_LEVELS: readonly MasteryLevelSpec[];
  readonly STORAGE_KEYS: {
    readonly continuity: string;
    readonly mastery: string;
    readonly milestones: string;
    readonly quests: string;
    readonly eventlog: string;
    readonly config: string;
    readonly counters: string;
  };
  // Core ingestion
  record(event: RecordInput): RecordSummary | null;
  /** Convenience: dispatch the bus event so remote emitters don't need to import. */
  emit(type: string, ref?: string | null, weight?: number, domain?: Domain | null): void;
  // Continuity + grace
  continuity(): ContinuityStatus;
  continuityStatus(): ContinuityStatus;
  // Mastery
  mastery(domain?: Domain): MasteryCellFull | Record<string, MasteryCellFull>;
  // Milestones / discovery
  milestones(): MilestonesSnapshot;
  unlockMilestone(id: string, meta?: Record<string, unknown>): MilestoneDetail | null;
  // Next thread (pure logic, no AI)
  nextThread(ctx?: NextThreadCtx): NextThreadSuggestion;
  // Quests
  listQuests(): Promise<QuestListItem[]>;
  getQuest(id: string): Promise<QuestModule | null>;
  startQuest(id: string): Promise<QuestStateEntry | null>;
  advanceQuest(id: string): Promise<QuestStateEntry | null>;
  questState(id: string): QuestStateEntry;
  // Seasons
  listSeasons(): Promise<Season[]>;
  // Config
  getConfig(): EngConfig;
  setConfig(patch: Partial<EngConfig>): EngConfig;
  // Event log (durable)
  eventLog(): Promise<LogEvent[]>;
  // Export / import / clear (local-only)
  export(): Promise<ExportBundle>;
  import(bundle: ExportBundle): boolean;
  clear(): { ok: boolean };
}

// ── window.CODEX_QUESTGEN ─────────────────────────────────────────────────────
export interface CodexQuestgen {
  /** Reserved — implemented by the AI agent layer, not this engine. */
  generate: null | ((
    theme: string,
    opts?: { tradition?: string; domain?: Domain; steps?: number },
  ) => Promise<QuestModule>);
  /** Registers a generated quest module into the runtime cache. */
  register(questModule: unknown): boolean;
}
