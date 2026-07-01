// Engagement — Continuity & Mastery engine logic (CODEX_ENGAGEMENT).
// Faithfully ported from legacy/engagement.js IIFE #2.
//
// DESIGN LAW (non-negotiable — preserved from legacy comments):
//   • DEPTH-GATED, not presence-gated.
//   • GRACE-SHAPED. No red, no broken-flame, no "don't break your streak".
//   • SOLO-FIRST. No leaderboard, no social.
//   • LOCAL-ONLY. localStorage + IndexedDB. Never phones home.
//   • NEVER THROWS at load. All IDB wrapped in try/catch with LS fallback.
import type {
  Domain,
  DepthActionType,
  DepthActionSpec,
  MasteryLevelSpec,
  MilestoneRule,
  ContinuityState,
  MasteryCell,
  MasteryStateRecord,
  ContinuityStatus,
  MasteryCellFull,
  BumpMasteryResult,
  MilestoneDetail,
  MilestonesSnapshot,
  LogEvent,
  EngConfig,
  RecordInput,
  RecordSummary,
  QuestStateEntry,
  QuestModule,
  QuestPack,
  QuestListItem,
  NextThreadCtx,
  NextThreadSuggestion,
  Season,
  ExportBundle,
  CodexEngagement,
  CodexQuestgen,
} from "./types.js";
import { ew } from "./engagement-window.js";

// ── Storage keys (all codex.* so they ride export/import automatically) ──────
const K_CONTINUITY = "codex.continuity.v1";   // { current, longest, lastDay, grace, history, ringStart }
const K_MASTERY    = "codex.mastery.v1";       // { [domain]: { score, threads, level, lastTs } }
const K_MILESTONES = "codex.milestones.v1";    // { [milestoneId]: isoDay }
const K_QUESTS     = "codex.quests.v1";        // { [questId]: { status, step, startedAt, updatedAt, completedAt } }
const K_EVENTLOG   = "codex.eventlog.v1";      // LS fallback array (capped) for the append-only log
const K_CONFIG     = "codex.engagement.config.v1"; // { dailyThreshold }
const K_COUNTERS   = "codex.engagement.counters.v1";

const IDB_NAME    = "codex-engagement";
const IDB_STORE   = "events";
const IDB_VERSION = 1;
const LS_LOG_CAP  = 2000;   // capped fallback array size
const GRACE_CAP   = 2;      // hold at most 2 grace tokens
const GRACE_EVERY = 7;      // auto-grant 1 grace token every 7 continuity days

const DEFAULT_DAILY_THRESHOLD = 1;  // qualifying depth events needed to count a day

// ── tiny helpers ─────────────────────────────────────────────────────────────
function safeT(key: string, fallback: string): string {
  try {
    const fn = ew().t;
    if (typeof fn === "function") {
      const v = fn(key);
      if (v && v !== key) return v;
    }
  } catch { /* ignore */ }
  return fallback;
}
function lsGet<T>(key: string, dflt: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? dflt : JSON.parse(raw) as T;
  } catch { return dflt; }
}
function lsSet(key: string, val: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; }
}
function dispatch(name: string, detail: unknown): void {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch { /* ignore */ }
}
function now(): number { return Date.now(); }

// ── date helpers (local calendar day, matches legacy engine) ──────────────────
function isoDay(ts?: number | null): string {
  const d = ts == null ? new Date() : new Date(ts);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function dayOffset(iso: string, days: number): string {
  const parts = iso.split("-").map(Number);
  const Y = parts[0] ?? 0, M = parts[1] ?? 1, D = parts[2] ?? 1;
  const d = new Date(Y, M - 1, D);
  d.setDate(d.getDate() + days);
  return isoDay(d.getTime());
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

// ── config ────────────────────────────────────────────────────────────────────
function getConfig(): EngConfig {
  const c = lsGet<Partial<EngConfig> | null>(K_CONFIG, null) ?? {};
  return { dailyThreshold: Math.max(1, c.dailyThreshold ?? DEFAULT_DAILY_THRESHOLD) };
}
function setConfig(patch: Partial<EngConfig>): EngConfig {
  const c: EngConfig = { ...getConfig(), ...(patch ?? {}) };
  lsSet(K_CONFIG, c);
  return c;
}

// ════════════════════════════════════════════════════════════════════════════════
// DOMAIN + DEPTH-ACTION TAXONOMY  (the contract emitters bind to)
// ════════════════════════════════════════════════════════════════════════════════
// Eight mastery domains. Tradition-agnostic labels via i18n at the UI layer.
export const DOMAINS: Domain[] = [
  "hebrew-greek",     // Strong's, lemmas, word studies
  "cross-references", // followed cross-ref threads / chains
  "gematria",         // numeric / isopsephy matches
  "talmud",           // daf / mishnah study
  "patristics",       // church-fathers commentary
  "gnosis",           // gnostic / nag-hammadi reading
  "geography",        // map / place study
  "canon-coverage",   // breadth across the canon (chapters/books closed)
];

// Depth-action types. Each: { weight, domain }.
//   weight  → how much it advances mastery (closing a thread weighs more
//             than a single lookup). A day counts toward continuity if it
//             has >= dailyThreshold qualifying depth events (any type).
//   domain  → which mastery domain it feeds (null = continuity-only, feeds
//             no specific domain but still qualifies the day).
export const DEPTH_ACTIONS: Record<DepthActionType, DepthActionSpec> = {
  // — Hebrew/Greek —
  "strongs-lookup":      { weight: 1, domain: "hebrew-greek" },
  "lemma-open":          { weight: 1, domain: "hebrew-greek" },
  "word-study-complete": { weight: 5, domain: "hebrew-greek" }, // closing a thread
  // — Cross-references —
  "crossref-follow":     { weight: 1, domain: "cross-references" },
  "crossref-chain":      { weight: 5, domain: "cross-references" }, // >=3-hop chain closed
  // — Gematria —
  "gematria-lookup":     { weight: 1, domain: "gematria" },
  "gematria-match":      { weight: 4, domain: "gematria" }, // match found in user's own library
  // — Talmud —
  "daf-read":            { weight: 3, domain: "talmud" },
  "mishnah-study":       { weight: 3, domain: "talmud" },
  // — Patristics —
  "patristics-read":     { weight: 2, domain: "patristics" },
  // — Gnosis —
  "gnosis-read":         { weight: 2, domain: "gnosis" },
  // — Geography —
  "map-place-study":     { weight: 2, domain: "geography" },
  // — Canon coverage —
  "passage-guide-read":  { weight: 4, domain: "canon-coverage" }, // a full passage guide
  "chapter-closed":      { weight: 1, domain: "canon-coverage" },
  "study-built":         { weight: 5, domain: "canon-coverage" }, // a built study
  // — Cross-cutting depth (feed no single domain, still qualify the day) —
  "note-written":        { weight: 2, domain: null },
  "discovery-logged":    { weight: 2, domain: null },
  "quest-step":          { weight: 3, domain: null }, // re-tagged to quest's domain when known
};

// Mastery level thresholds (cumulative weight → named level).
export const MASTERY_LEVELS: MasteryLevelSpec[] = [
  { level: 0, min: 0,    key: "cx.mastery.lvl.dormant",  en: "Dormant" },
  { level: 1, min: 10,   key: "cx.mastery.lvl.tracking", en: "Tracking" },
  { level: 2, min: 40,   key: "cx.mastery.lvl.analyst",  en: "Analyst" },
  { level: 3, min: 120,  key: "cx.mastery.lvl.adept",    en: "Adept" },
  { level: 4, min: 300,  key: "cx.mastery.lvl.cryptic",  en: "Cryptographer" },
  { level: 5, min: 700,  key: "cx.mastery.lvl.oracle",   en: "Oracle-grade" },
];

const _defaultLevel: MasteryLevelSpec = MASTERY_LEVELS[0] ?? { level: 0, min: 0, key: "cx.mastery.lvl.dormant", en: "Dormant" };

export function levelForScore(score: number): MasteryLevelSpec {
  let lv = _defaultLevel;
  for (const m of MASTERY_LEVELS) if (score >= m.min) lv = m;
  return lv;
}

// ════════════════════════════════════════════════════════════════════════════════
// EVENT LOG — append-only. IndexedDB primary, capped LS array fallback.
// ════════════════════════════════════════════════════════════════════════════════
let _idb: IDBDatabase | null = null;          // cached open db
let _idbBroken = false;   // once a failure is seen, stop trying IDB this session

function openLogDB(): Promise<IDBDatabase> {
  return new Promise(function (resolve, reject) {
    if (_idbBroken) return reject(new Error("idb-disabled"));
    if (_idb) return resolve(_idb);
    if (!ew().indexedDB) { _idbBroken = true; return reject(new Error("no-idb")); }
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(IDB_NAME, IDB_VERSION); }
    catch (e) { _idbBroken = true; return reject(e); }
    req.onupgradeneeded = function (e: IDBVersionChangeEvent) {
      try {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const os = db.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
          os.createIndex("ts", "ts", { unique: false });
          os.createIndex("domain", "domain", { unique: false });
        }
      } catch { /* ignore */ }
    };
    req.onsuccess = function () { _idb = req.result; resolve(_idb); };
    req.onerror = function () { _idbBroken = true; reject(req.error ?? new Error("idb-open-failed")); };
  });
}

function idbAppend(evt: LogEvent): Promise<boolean> {
  return openLogDB().then(function (db) {
    return new Promise<boolean>(function (resolve, reject) {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).add(evt);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      } catch (e) { reject(e); }
    });
  });
}

function idbAll(): Promise<LogEvent[]> {
  return openLogDB().then(function (db) {
    return new Promise<LogEvent[]>(function (resolve, reject) {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).getAll() as IDBRequest<LogEvent[]>;
        req.onsuccess = function () { resolve(req.result ?? []); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
  });
}

function idbClear(): Promise<boolean> {
  return openLogDB().then(function (db) {
    return new Promise<boolean>(function (resolve, reject) {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      } catch (e) { reject(e); }
    });
  });
}

// LS fallback (also a synchronous mirror of "today's" events for fast day-counting)
function lsLogAppend(evt: LogEvent): void {
  const arr = lsGet<LogEvent[]>(K_EVENTLOG, []);
  arr.push(evt);
  if (arr.length > LS_LOG_CAP) arr.splice(0, arr.length - LS_LOG_CAP);
  lsSet(K_EVENTLOG, arr);
}
function lsLogAll(): LogEvent[] { return lsGet<LogEvent[]>(K_EVENTLOG, []); }

// Append to the durable log. Never throws. Always mirrors to the capped
// LS array (cheap, synchronous, survives IDB failure & powers day-counting).
function appendEvent(evt: LogEvent): void {
  lsLogAppend(evt);                       // synchronous mirror — always
  try {
    idbAppend(evt).catch(function () {}); // best-effort durable append
  } catch { /* ignore */ }
}

// ════════════════════════════════════════════════════════════════════════════════
// CONTINUITY (the streak) + GRACE
// ════════════════════════════════════════════════════════════════════════════════
function defaultContinuity(): ContinuityState {
  return {
    current: 0,        // current continuity length in days
    longest: 0,        // best ever
    lastDay: null,     // iso day of last qualifying day
    todayCount: 0,     // qualifying depth events recorded today
    countedToday: false, // whether today already counted
    grace: 0,          // grace tokens held (cap GRACE_CAP)
    graceSpentDays: {}, // { isoDay: true } days that a token covered
    sinceGrace: 0,     // qualifying days since last grace grant
    ringStart: null,   // iso day the current continuity ring began
    history: {},       // { isoDay: true } qualifying days (trimmed to 400)
  };
}
function loadContinuity(): ContinuityState {
  const c = lsGet<Partial<ContinuityState> | null>(K_CONTINUITY, null);
  return c ? { ...defaultContinuity(), ...c } : defaultContinuity();
}
function saveContinuity(c: ContinuityState): void { lsSet(K_CONTINUITY, c); }

// Internal gap-resolution result type.
interface GapResult {
  status: "fresh" | "continuous" | "paused" | "held";
  graceSpent: number;
}

// Resolve the gap between lastDay and `today`, spending grace silently for
// missed days. Returns { status, graceSpent }. No guilt framing ever.
function reconcileGap(c: ContinuityState, today: string): GapResult {
  if (!c.lastDay) return { status: "fresh", graceSpent: 0 };
  const gap = daysBetween(c.lastDay, today);
  if (gap <= 1) return { status: "continuous", graceSpent: 0 };
  // gap-1 missed days between lastDay and today
  const missed = gap - 1;
  let spent = 0;
  for (let i = 0; i < missed; i++) {
    if (c.grace > 0) {
      c.grace -= 1;
      spent += 1;
      const coveredDay = dayOffset(c.lastDay, i + 1);
      c.graceSpentDays[coveredDay] = true;
    } else {
      // No token: continuity pauses (NOT broken). It will restart at 1 on
      // the next qualifying day. No loss state, no red.
      return { status: "paused", graceSpent: spent };
    }
  }
  // All missed days covered by grace → continuity HELD.
  return { status: "held", graceSpent: spent };
}

// Record one qualifying depth event toward continuity. Returns a summary.
// Dispatches codex:continuity-tick only when a NEW day first qualifies.
function tickContinuity(): ContinuityStatus {
  const cfg = getConfig();
  const c = loadContinuity();
  const today = isoDay();

  // Roll over to a new day if needed.
  if (c.lastCountDay !== today) {
    // Different day than where todayCount was accruing.
    if (c.lastDay === today) {
      // already counted today; just resume accrual count
    } else {
      c.todayCount = 0;
      c.countedToday = false;
    }
    c.lastCountDay = today;
  }

  c.todayCount += 1;

  // Already counted today → nothing more to do (no tick).
  if (c.lastDay === today) {
    saveContinuity(c);
    return continuityStatus(c);
  }

  // Need threshold to count the day.
  if (c.todayCount < cfg.dailyThreshold) {
    saveContinuity(c);
    return continuityStatus(c);
  }

  // ── Today qualifies. Reconcile any gap with grace, then advance. ──
  const gap = reconcileGap(c, today);
  if (gap.status === "paused") {
    c.current = 1;             // restart, no guilt
    c.ringStart = today;
  } else if (gap.status === "fresh") {
    c.current = 1;
    c.ringStart = today;
  } else {
    c.current = (c.current ?? 0) + 1; // continuous or held
    if (!c.ringStart) c.ringStart = today;
  }

  c.lastDay = today;
  c.countedToday = true;
  c.longest = Math.max(c.longest ?? 0, c.current);
  c.history[today] = true;
  c.sinceGrace = (c.sinceGrace ?? 0) + 1;

  // Auto-grant grace every GRACE_EVERY qualifying days (cap GRACE_CAP).
  let graceGranted = 0;
  while (c.sinceGrace >= GRACE_EVERY && c.grace < GRACE_CAP) {
    c.grace += 1;
    c.sinceGrace -= GRACE_EVERY;
    graceGranted += 1;
  }
  if (c.sinceGrace >= GRACE_EVERY) c.sinceGrace = c.sinceGrace % GRACE_EVERY;

  // Trim history to last 400 days.
  const cutoff = dayOffset(today, -400);
  for (const d of Object.keys(c.history)) if (d < cutoff) delete c.history[d];
  for (const d of Object.keys(c.graceSpentDays)) if (d < cutoff) delete c.graceSpentDays[d];

  saveContinuity(c);

  const status = continuityStatus(c, { graceSpent: gap.graceSpent, graceGranted, gapStatus: gap.status });
  dispatch("codex:continuity-tick", status);
  return status;
}

interface ContinuityStatusExtra {
  graceSpent?: number;
  graceGranted?: number;
  gapStatus?: string;
}

function continuityStatus(c?: ContinuityState, extra?: ContinuityStatusExtra): ContinuityStatus {
  const cont = c ?? loadContinuity();
  const ex = extra ?? {};
  const today = isoDay();
  let copyKey = "cx.continuity.active", copyEn = "Continuity active";
  if ((ex.graceSpent ?? 0) > 0) { copyKey = "cx.continuity.held"; copyEn = "Continuity held — grace spent"; }
  else if (ex.gapStatus === "paused") { copyKey = "cx.continuity.resumed"; copyEn = "Continuity resumed"; }
  else if (!cont.lastDay) { copyKey = "cx.continuity.idle"; copyEn = "Continuity idle"; }
  return {
    current: cont.current ?? 0,
    longest: cont.longest ?? 0,
    lastDay: cont.lastDay ?? null,
    countedToday: cont.lastDay === today,
    grace: cont.grace ?? 0,
    graceCap: GRACE_CAP,
    graceSpent: ex.graceSpent ?? 0,
    graceGranted: ex.graceGranted ?? 0,
    ringStart: cont.ringStart ?? null,
    sinceGrace: cont.sinceGrace ?? 0,
    nextGraceIn: Math.max(0, GRACE_EVERY - (cont.sinceGrace ?? 0)),
    statusKey: copyKey,
    statusText: safeT(copyKey, copyEn),
  };
}

// Read-only continuity snapshot that ALSO reconciles a stale gap for display
// (spends grace if the user opened after a lapse) without requiring an event.
function continuity(): ContinuityStatus {
  const c = loadContinuity();
  const today = isoDay();
  if (c.lastDay && c.lastDay !== today) {
    const gap = reconcileGap(c, today);
    if (gap.graceSpent > 0 || gap.status === "paused") {
      // NOTE: preserved from legacy — paused: current stays; restarts on next qualifying day.
      if (gap.status === "paused") { /* intentional no-op */ }
      saveContinuity(c);
      return continuityStatus(c, { graceSpent: gap.graceSpent, gapStatus: gap.status });
    }
  }
  return continuityStatus(c);
}

// ════════════════════════════════════════════════════════════════════════════════
// MASTERY (per domain) — rises from closing threads (weighted events)
// ════════════════════════════════════════════════════════════════════════════════
function loadMastery(): MasteryStateRecord {
  const raw = lsGet<Partial<MasteryStateRecord> | null>(K_MASTERY, null);
  const m: Partial<MasteryStateRecord> = raw ?? {};
  for (const d of DOMAINS) {
    if (!m[d]) m[d] = { score: 0, threads: 0, level: 0, lastTs: null };
  }
  return m as MasteryStateRecord;
}
function saveMastery(m: MasteryStateRecord): void { lsSet(K_MASTERY, m); }

function bumpMastery(domain: Domain | null, weight: number, isThread: boolean): BumpMasteryResult | null {
  if (!domain || DOMAINS.indexOf(domain) === -1) return null;
  const m = loadMastery();
  const prevCell: MasteryCell = m[domain] ?? { score: 0, threads: 0, level: 0, lastTs: null };
  const prevLevel = prevCell.level;
  const cell: MasteryCell = { ...prevCell };
  cell.score += weight;
  if (isThread) cell.threads += 1;
  cell.lastTs = now();
  const lv = levelForScore(cell.score);
  cell.level = lv.level;
  m[domain] = cell;
  saveMastery(m);
  if (lv.level > prevLevel) {
    // A level-up is a milestone too.
    unlockMilestone("mastery." + domain + ".lvl" + String(lv.level), {
      kind: "mastery-level", domain, level: lv.level,
      labelEn: lv.en, labelKey: lv.key,
    });
  }
  return { domain, score: cell.score, level: cell.level, threads: cell.threads, levelLabel: safeT(lv.key, lv.en) };
}

function mastery(domain?: Domain): MasteryCellFull | Record<string, MasteryCellFull> {
  const m = loadMastery();
  if (domain) {
    const cell: MasteryCell = m[domain] ?? { score: 0, threads: 0, level: 0, lastTs: null };
    const lv = levelForScore(cell.score);
    return { domain, ...cell, levelLabel: safeT(lv.key, lv.en), levelKey: lv.key };
  }
  const out: Record<string, MasteryCellFull> = {};
  for (const d of DOMAINS) {
    const cell = m[d] ?? { score: 0, threads: 0, level: 0, lastTs: null };
    const lv = levelForScore(cell.score);
    out[d] = { ...cell, domain: d, levelLabel: safeT(lv.key, lv.en), levelKey: lv.key };
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════
// MILESTONES / DISCOVERY — unified unlock system
// ════════════════════════════════════════════════════════════════════════════════
// Counters are derived from the event log mirror; thresholds unlock once.
export const MILESTONE_RULES: MilestoneRule[] = [
  // Cross-reference breadth (generalizes verse-map 10/25/50/100)
  { id: "crossref.10",  domain: "cross-references", count: "crossref-follow", n: 10,  labelEn: "10 cross-ref threads" },
  { id: "crossref.25",  domain: "cross-references", count: "crossref-follow", n: 25,  labelEn: "25 cross-ref threads" },
  { id: "crossref.50",  domain: "cross-references", count: "crossref-follow", n: 50,  labelEn: "50 cross-ref threads" },
  { id: "crossref.100", domain: "cross-references", count: "crossref-follow", n: 100, labelEn: "100 cross-ref threads" },
  // Word-study depth
  { id: "wordstudy.10", domain: "hebrew-greek", count: "word-study-complete", n: 10, labelEn: "10 word studies closed" },
  { id: "wordstudy.25", domain: "hebrew-greek", count: "word-study-complete", n: 25, labelEn: "25 word studies closed" },
  // Gematria matches
  { id: "gematria.10",  domain: "gematria", count: "gematria-match", n: 10, labelEn: "10 gematria matches" },
  // Canon coverage
  { id: "canon.50",  domain: "canon-coverage", count: "chapter-closed", n: 50,  labelEn: "50 chapters closed" },
  { id: "canon.150", domain: "canon-coverage", count: "chapter-closed", n: 150, labelEn: "150 chapters closed" },
];

function loadMilestones(): Record<string, string> { return lsGet<Record<string, string>>(K_MILESTONES, {}); }
function saveMilestones(m: Record<string, string>): void { lsSet(K_MILESTONES, m); }

// Unlock a milestone by id if not already held. Dispatches codex:milestone.
function unlockMilestone(id: string, meta?: Record<string, unknown>): MilestoneDetail | null {
  const held = loadMilestones();
  if (held[id]) return null;
  held[id] = isoDay();
  saveMilestones(held);
  const detail: MilestoneDetail = { id, day: held[id] ?? isoDay(), ...(meta ?? {}) };
  if (detail.labelEn && !detail.label) {
    detail.label = safeT("cx.milestone." + id, String(detail.labelEn));
  }
  dispatch("codex:milestone", detail);
  return detail;
}

// "First time you did X" milestones (per depth-action type).
function checkFirstTime(type: string): void {
  const id = "first." + type;
  const held = loadMilestones();
  if (held[id]) return;
  const labelEn = "First " + type.replace(/-/g, " ");
  unlockMilestone(id, { kind: "first", type, labelEn });
}

// Threshold milestones from running counters.
function loadCounters(): Record<string, number> { return lsGet<Record<string, number>>(K_COUNTERS, {}); }
function saveCounters(c: Record<string, number>): void { lsSet(K_COUNTERS, c); }
function bumpCounter(type: string): number {
  const c = loadCounters();
  c[type] = (c[type] ?? 0) + 1;
  saveCounters(c);
  const current = c[type] ?? 0;
  for (const rule of MILESTONE_RULES) {
    if (rule.count === type && current === rule.n) {
      unlockMilestone(rule.id, { kind: "threshold", domain: rule.domain, n: rule.n, labelEn: rule.labelEn });
    }
  }
  return current;
}

function milestones(): MilestonesSnapshot {
  return { unlocked: loadMilestones(), counters: loadCounters(), rules: MILESTONE_RULES.slice() };
}

// ════════════════════════════════════════════════════════════════════════════════
// CORE: record(event) — the single ingestion point
// ════════════════════════════════════════════════════════════════════════════════
// event = { type, ref?, weight?, domain?, ts? }
// Returns a summary; never throws.
function record(event: RecordInput): RecordSummary | null {
  try {
    if (!event || typeof event !== "object" || !event.type) return null;
    // NOTE: preserved from legacy — DEPTH_ACTIONS lookup falls back gracefully for unknown types.
    const specEntry: DepthActionSpec | undefined = (DEPTH_ACTIONS as Record<string, DepthActionSpec | undefined>)[event.type];
    const type = event.type;
    const weight = (typeof event.weight === "number" && event.weight > 0) ? event.weight : (specEntry?.weight ?? 1);
    const domain: Domain | null = event.domain ?? specEntry?.domain ?? null;
    const ts = event.ts ?? now();
    const ref = event.ref != null ? event.ref : null;

    const logEvt: LogEvent = { ts, type, ref, weight, domain };
    appendEvent(logEvt);

    // First-time + threshold milestones
    checkFirstTime(type);
    bumpCounter(type);

    // Mastery: every weighted event nudges its domain; "thread-closing"
    // actions (weight >= 4) count as a closed thread.
    const isThread = weight >= 4;
    let masteryResult: BumpMasteryResult | null = null;
    if (domain) masteryResult = bumpMastery(domain, weight, isThread);

    // Continuity: any qualifying depth event ticks the day.
    const cont = tickContinuity();

    return { recorded: logEvt, continuity: cont, mastery: masteryResult };
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// QUESTS runtime
// ════════════════════════════════════════════════════════════════════════════════
let _questPackCache: QuestPack | null = null;

function _getModuleSync(id: string): unknown {
  // Best-effort sync lookup if a host has pre-staged modules.
  try {
    const data = ew().CODEX_MODULE_DATA;
    if (data) {
      const mod = data[id];
      if (mod) return mod;
    }
  } catch { /* ignore */ }
  return null;
}

function _loadQuestPack(): Promise<QuestPack> {
  if (_questPackCache) return Promise.resolve(_questPackCache);
  const staged = _getModuleSync("quests-curated") as QuestPack | null;
  if (staged?.quests) { _questPackCache = staged; return Promise.resolve(staged); }
  // Try the module loader (IDB-cached), then plain fetch.
  const loader = ew().CODEX_MODULES;
  const viaLoader: Promise<unknown> = (loader && typeof loader.loadModule === "function")
    ? loader.loadModule("quests-curated").catch(function () { return null; })
    : Promise.resolve(null);
  return viaLoader.then(function (mod) {
    const m = mod as QuestPack | null;
    if (m?.quests) { _questPackCache = m; return m; }
    return fetch("data/modules/quests-curated.json", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() as Promise<QuestPack> : null; })
      .then(function (j) {
        if (j?.quests) { _questPackCache = j; return j; }
        return { quests: [] };
      })
      .catch(function (): QuestPack { return { quests: [] }; });
  });
}

function listQuests(): Promise<QuestListItem[]> {
  return _loadQuestPack().then(function (pack) {
    const states = lsGet<Record<string, QuestStateEntry>>(K_QUESTS, {});
    return (pack.quests ?? []).map(function (q) {
      const st: QuestStateEntry | undefined = states[q.meta.id];
      return {
        id: q.meta.id,
        title: q.meta.title,
        tradition: q.meta.tradition ?? null,
        domain: q.meta.domain ?? null,
        steps: (q.steps ?? []).length,
        ring: q.meta.ring ?? null,
        status: st ? st.status : "available" as const,
        step: st ? st.step : 0,
      };
    });
  });
}

function getQuest(id: string): Promise<QuestModule | null> {
  return _loadQuestPack().then(function (pack) {
    return (pack.quests ?? []).find(function (q) { return q.meta.id === id; }) ?? null;
  });
}

const _defaultQuestState = (): QuestStateEntry => ({
  status: "available",
  step: 0,
  startedAt: null,
  updatedAt: null,
  completedAt: null,
});

function questState(id: string): QuestStateEntry {
  const states = lsGet<Record<string, QuestStateEntry>>(K_QUESTS, {});
  return states[id] ?? _defaultQuestState();
}

function _writeQuestState(id: string, patch: Partial<QuestStateEntry>): QuestStateEntry {
  const states = lsGet<Record<string, QuestStateEntry>>(K_QUESTS, {});
  states[id] = { ...(states[id] ?? _defaultQuestState()), ...patch, updatedAt: now() };
  lsSet(K_QUESTS, states);
  return states[id] as QuestStateEntry;
}

function startQuest(id: string): Promise<QuestStateEntry | null> {
  return getQuest(id).then(function (q) {
    if (!q) return null;
    const st = _writeQuestState(id, { status: "active", step: 0, startedAt: now(), completedAt: null });
    dispatch("codex:quest-step", { questId: id, step: 0, status: "active", domain: q.meta.domain ?? null });
    return st;
  });
}

// Advance the active quest one step. Records a depth event (quest-step,
// re-tagged to the quest's domain) so it feeds mastery + continuity.
function advanceQuest(id: string): Promise<QuestStateEntry | null> {
  return getQuest(id).then(function (q) {
    if (!q) return null;
    const total = (q.steps ?? []).length;
    const cur = questState(id);
    let step = cur.step ?? 0;
    if (cur.status !== "active") {
      // auto-start on first advance
      _writeQuestState(id, { status: "active", startedAt: cur.startedAt ?? now() });
    }
    // Record the depth action for the step being completed.
    const qsSpec = DEPTH_ACTIONS["quest-step"];
    record({ type: "quest-step", ref: id + "#" + String(step), weight: qsSpec.weight, domain: q.meta.domain ?? null });
    step += 1;
    const done = step >= total;
    const st = _writeQuestState(id, {
      status: done ? "complete" : "active",
      step: done ? total : step,
      completedAt: done ? now() : null,
    });
    dispatch("codex:quest-step", { questId: id, step: st.step, status: st.status, domain: q.meta.domain ?? null });
    if (done) {
      unlockMilestone("quest." + id, { kind: "quest-complete", questId: id, domain: q.meta.domain ?? null, labelEn: "Quest closed: " + q.meta.title });
    }
    return st;
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// nextThread(ctx) — pure-logic single best next thread. NO AI.
// ════════════════════════════════════════════════════════════════════════════════
// ctx (all optional): { ref, book, library:[{ref,gematria?}], parsha, daf,
//                       crossrefsAvailable:bool }
// Returns one suggestion: { kind, title, ref?, questId?, reason }.
// Synchronous best-effort against already-cached data only.
function nextThread(ctx?: NextThreadCtx): NextThreadSuggestion {
  const c = ctx ?? {};
  try {
    // 1) An unfinished quest is the strongest pull (a thread already opened).
    const states = lsGet<Record<string, QuestStateEntry>>(K_QUESTS, {});
    const active = Object.keys(states).find(function (id) {
      const st = states[id];
      return st?.status === "active";
    });
    if (active) {
      const pack = _questPackCache;
      const q = pack?.quests ? pack.quests.find(function (x) { return x.meta.id === active; }) : null;
      const st = states[active];
      return {
        kind: "quest",
        questId: active,
        title: q ? q.meta.title : active,
        step: st?.step ?? 0,
        reason: safeT("cx.nextthread.quest", "Resume an open quest thread"),
      };
    }

    // 2) A gematria match in the user's OWN library (high-signal coincidence).
    const library = c.library;
    if (Array.isArray(library) && library.length > 1) {
      const byVal: Record<string, Array<{ ref?: string; gematria?: number }>> = {};
      for (const item of library) {
        if (item && typeof item.gematria === "number") {
          const g = String(item.gematria);
          let bucket = byVal[g];
          if (!bucket) { bucket = []; byVal[g] = bucket; }
          bucket.push(item);
        }
      }
      for (const v of Object.keys(byVal)) {
        const arr = byVal[v];
        if (arr && arr.length >= 2) {
          return {
            kind: "gematria",
            value: Number(v),
            refs: arr.slice(0, 4).map(function (i) { return i.ref; }).filter((r): r is string => r !== undefined),
            title: safeT("cx.nextthread.gematria", "A gematria match sits in your own library"),
            // NOTE: preserved from legacy — reason joins refs (may be undefined → "")
            reason: arr.slice(0, 3).map(function (i) { return i.ref ?? ""; }).join(" · "),
          };
        }
      }
    }

    // 3) A cross-ref worth chasing from the current verse.
    if (c.ref && c.crossrefsAvailable) {
      return {
        kind: "crossref",
        ref: c.ref,
        title: safeT("cx.nextthread.crossref", "Follow a cross-ref thread from here"),
        reason: c.ref,
      };
    }

    // 4) The day's parsha / daf (tradition-agnostic: only if host supplies it).
    if (c.daf) {
      return { kind: "daf", ref: c.daf, title: safeT("cx.nextthread.daf", "Today's daf"), reason: c.daf };
    }
    if (c.parsha) {
      return { kind: "parsha", ref: c.parsha, title: safeT("cx.nextthread.parsha", "This week's parsha"), reason: c.parsha };
    }

    // 5) Suggest starting the most on-ramp quest.
    const firstQuest = _questPackCache?.quests?.[0];
    if (firstQuest) {
      return {
        kind: "quest-start",
        questId: firstQuest.meta.id,
        title: firstQuest.meta.title,
        reason: safeT("cx.nextthread.start", "Open a new thread"),
      };
    }

    return { kind: "none", title: safeT("cx.nextthread.none", "Open any depth surface to begin a thread"), reason: null };
  } catch {
    return { kind: "none", title: safeT("cx.nextthread.none", "Open any depth surface to begin a thread"), reason: null };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SEASONS (read-only helpers over seasons.json)
// ════════════════════════════════════════════════════════════════════════════════
interface SeasonsPack { seasons: Season[]; }
let _seasonsCache: SeasonsPack | null = null;

function listSeasons(): Promise<Season[]> {
  if (_seasonsCache) return Promise.resolve(_seasonsCache.seasons ?? []);
  const staged = _getModuleSync("seasons") as SeasonsPack | null;
  if (staged?.seasons) { _seasonsCache = staged; return Promise.resolve(staged.seasons); }
  return fetch("data/modules/seasons.json", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() as Promise<SeasonsPack> : null; })
    .then(function (j) {
      _seasonsCache = j ?? { seasons: [] };
      return _seasonsCache.seasons ?? [];
    })
    .catch(function (): Season[] { return []; });
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT / CLEAR  (all engagement state, local-only)
// ════════════════════════════════════════════════════════════════════════════════
function exportState(): Promise<ExportBundle> {
  const base: ExportBundle = {
    format: "codex.engagement",
    version: 1,
    exportedAt: new Date().toISOString(),
    continuity: lsGet<ContinuityState | null>(K_CONTINUITY, null),
    mastery: lsGet<MasteryStateRecord | null>(K_MASTERY, null),
    milestones: lsGet<Record<string, string> | null>(K_MILESTONES, null),
    counters: loadCounters(),
    quests: lsGet<Record<string, QuestStateEntry> | null>(K_QUESTS, null),
    config: getConfig(),
    eventlog: lsLogAll(),  // capped LS mirror (sync)
  };
  // Best-effort: replace with the full durable IDB log if available.
  return idbAll().then(function (all) {
    if (all && all.length) base.eventlog = all;
    return base;
  }).catch(function () { return base; });
}

function importState(bundle: ExportBundle): boolean {
  try {
    // NOTE: preserved from legacy — runtime guard for unexpected input at call site.
    if (!bundle || bundle.format !== "codex.engagement" || !bundle.version) return false;
    if (bundle.continuity) lsSet(K_CONTINUITY, bundle.continuity);
    if (bundle.mastery)    lsSet(K_MASTERY, bundle.mastery);
    if (bundle.milestones) lsSet(K_MILESTONES, bundle.milestones);
    if (bundle.counters)   saveCounters(bundle.counters);
    if (bundle.quests)     lsSet(K_QUESTS, bundle.quests);
    if (bundle.config)     setConfig(bundle.config);
    if (Array.isArray(bundle.eventlog)) {
      const capped = bundle.eventlog.slice(-LS_LOG_CAP);
      lsSet(K_EVENTLOG, capped);
      // Rehydrate IDB best-effort.
      idbClear().then(function () {
        for (const e of bundle.eventlog) { idbAppend(e).catch(function () {}); }
      }).catch(function () {});
    }
    return true;
  } catch { return false; }
}

function clearState(): { ok: boolean } {
  [K_CONTINUITY, K_MASTERY, K_MILESTONES, K_QUESTS, K_EVENTLOG, K_CONFIG,
   K_COUNTERS].forEach(function (k) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
  _questPackCache = null; _seasonsCache = null;
  idbClear().catch(function () {});
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════════════════
// BUS WIRING — the engine LISTENS so emitters only need to dispatch.
// ════════════════════════════════════════════════════════════════════════════════
function onDepthAction(e: Event): void {
  // NOTE: preserved from legacy — `detail` is untrusted external payload, so every
  // field (including `type`) may be absent; record() itself guards against that.
  const d: Partial<RecordInput> = ((e as CustomEvent).detail as Partial<RecordInput> | null) ?? {};
  record({ type: d.type, ref: d.ref, weight: d.weight, domain: d.domain, ts: d.ts } as RecordInput);
}

// Register the bus listener at module load time (mirrors IIFE side-effect).
try {
  window.addEventListener("codex:depth-action", onDepthAction);
} catch { /* ignore */ }

// ── Public API (the FROZEN CONTRACT) ──────────────────────────────────────────
export const CODEX_ENGAGEMENT_API: CodexEngagement = {
  // version + taxonomy
  VERSION: "2.5.0",
  DOMAINS: DOMAINS.slice() as Domain[],
  DEPTH_ACTIONS: DEPTH_ACTIONS,
  MASTERY_LEVELS: MASTERY_LEVELS.slice(),
  STORAGE_KEYS: {
    continuity: K_CONTINUITY, mastery: K_MASTERY, milestones: K_MILESTONES,
    quests: K_QUESTS, eventlog: K_EVENTLOG, config: K_CONFIG,
    counters: K_COUNTERS,
  },

  // core ingestion
  record: record,                 // record({type,ref?,weight?,domain?,ts?})
  emit: function (type: string, ref?: string | null, weight?: number, domain?: Domain | null): void {
    // convenience: dispatch the bus event
    dispatch("codex:depth-action", { type, ref, weight, domain });
  },

  // continuity + grace
  continuity: continuity,         // () → status (reconciles gap for display)
  continuityStatus: function (): ContinuityStatus { return continuityStatus(loadContinuity()); },

  // mastery
  mastery: mastery,               // (domain?) → cell | map

  // milestones / discovery
  milestones: milestones,         // () → { unlocked, counters, rules }
  unlockMilestone: unlockMilestone, // (id, meta?) → detail | null

  // next thread (pure logic, no AI)
  nextThread: nextThread,         // (ctx) → suggestion

  // quests
  listQuests: listQuests,         // () → Promise<[{id,title,...}]>
  getQuest: getQuest,             // (id) → Promise<questModule|null>
  startQuest: startQuest,         // (id) → Promise<state>
  advanceQuest: advanceQuest,     // (id) → Promise<state>
  questState: questState,         // (id) → state (sync)

  // seasons
  listSeasons: listSeasons,       // () → Promise<[season]>

  // config
  getConfig: getConfig,
  setConfig: setConfig,

  // event log access (durable)
  eventLog: function (): Promise<LogEvent[]> {
    return idbAll().catch(function () { return lsLogAll(); });
  },

  // export / import / clear (local-only)
  export: exportState,            // () → Promise<bundle>
  import: importState,            // (bundle) → bool
  clear: clearState,              // () → { ok }
};

// ── CODEX_QUESTGEN stub ───────────────────────────────────────────────────────
// RESERVED hook for AI quest generation (NOT implemented here — contract only).
// A later AI agent implements window.CODEX_QUESTGEN.generate(theme, opts?).
export function buildCodexQuestgen(registerFn: (qm: unknown) => boolean): CodexQuestgen {
  return {
    // generate(theme:string, opts?:{tradition?,domain?,steps?}) → Promise<questModule>
    generate: null,
    // Adapter the UI/AI uses to register a generated quest into the runtime.
    register: registerFn,
  };
}

// Exported for tests and index.ts
export {
  record,
  continuity,
  continuityStatus,
  mastery,
  milestones,
  unlockMilestone,
  nextThread,
  listQuests,
  getQuest,
  startQuest,
  advanceQuest,
  questState,
  listSeasons,
  exportState,
  importState,
  clearState,
  getConfig,
  setConfig,
  idbAll,
  lsLogAll,
  loadContinuity,
  loadMastery,
  loadMilestones,
  loadCounters,
  tickContinuity,
};

// Quest cache register (used by CODEX_QUESTGEN.register)
export function registerQuestModule(questModule: unknown): boolean {
  try {
    const qm = questModule as QuestModule | null;
    if (!qm?.meta?.id) return false;
    if (!_questPackCache) _questPackCache = { quests: [] };
    const idx = _questPackCache.quests.findIndex(function (q) { return q.meta.id === qm.meta.id; });
    if (idx >= 0) _questPackCache.quests[idx] = qm;
    else _questPackCache.quests.push(qm);
    return true;
  } catch { return false; }
}
