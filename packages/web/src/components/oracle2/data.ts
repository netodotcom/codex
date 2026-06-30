// oracle2 — thread persistence (migrated faithfully from oracle2.jsx).
// Pure localStorage-backed thread management; no DOM or React. Used by the
// OracleX component and covered by data.test.ts.

export const ORACLE2_LEGACY_KEY = "codex.oracle.v10";
export const ORACLE2_THREADS_KEY = "codex.oracle.threads.v1";
export const ORACLE2_ACTIVE_KEY = "codex.oracle.threads.active.v1";
export const ORACLE2_TOOLS_KEY = "codex.oracle.tools.v1";
export const ORACLE2_MAX_MSGS = 60;
export const ORACLE2_MAX_THREADS = 12;
export const ORACLE2_TOOL_STEPS = 4;

export interface OracleMsg {
  role: "user" | "oracle" | "tool";
  content: string;
  ref?: string;
  ts?: number;
  tool?: string;
  failed?: boolean;
}

export interface OracleThread {
  id: string;
  title: string;
  msgs: OracleMsg[];
  updatedAt: number;
}

export function oracle2NewThread(): OracleThread {
  return {
    id: "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: "new thread",
    msgs: [],
    updatedAt: Date.now(),
  };
}

export function oracle2DeriveTitle(msgs: OracleMsg[]): string {
  const u = (msgs || []).find((m) => m.role === "user");
  if (!u) return "new thread";
  return String(u.content || "").trim().replace(/\s+/g, " ").slice(0, 28) || "new thread";
}

export function oracle2LoadThreads(): OracleThread[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORACLE2_THREADS_KEY) || "null") as unknown;
    if (Array.isArray(raw) && raw.length) {
      return (raw as OracleThread[])
        .filter((t) => t && t.id && Array.isArray(t.msgs))
        .slice(0, ORACLE2_MAX_THREADS);
    }
  } catch {
    // ignore
  }
  // Migrate the v10 single thread.
  try {
    const legacy = JSON.parse(localStorage.getItem(ORACLE2_LEGACY_KEY) || "null") as unknown;
    if (Array.isArray(legacy) && legacy.length) {
      const t = oracle2NewThread();
      t.msgs = legacy as OracleMsg[];
      t.title = oracle2DeriveTitle(legacy as OracleMsg[]);
      return [t];
    }
  } catch {
    // ignore
  }
  return [oracle2NewThread()];
}

export function oracle2SaveThreads(threads: OracleThread[], activeId: string): void {
  try {
    const trimmed = threads
      .slice(0, ORACLE2_MAX_THREADS)
      .map((t) => ({ ...t, msgs: t.msgs.slice(-ORACLE2_MAX_MSGS) }));
    localStorage.setItem(ORACLE2_THREADS_KEY, JSON.stringify(trimmed));
    localStorage.setItem(ORACLE2_ACTIVE_KEY, activeId || "");
  } catch {
    // ignore
  }
}
