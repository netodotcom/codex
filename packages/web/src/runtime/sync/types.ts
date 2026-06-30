// sync — shared TypeScript types.

export type SyncBackend = "github" | "firebase" | "";

/** One key-value entry in the sync payload (stored in gist / Firestore). */
export interface SyncEntry {
  /** Raw localStorage value string. */
  v: string;
  /** Timestamp (ms since epoch) when this entry was collected. */
  t: number;
}

/** Shape of the JSON blob stored in the gist file / Firestore document. */
export interface SyncPayload {
  keys: Record<string, SyncEntry>;
  updatedAt: number;
}

/** Persisted in LS_LAST; surfaced via CODEX_SYNC.getLast(). */
export interface SyncLastRecord {
  at: number;
  direction: "up" | "down";
  changed?: number;
  count?: number;
}

/** Normalised user shape exposed through CODEX_SYNC.user and "auth" events. */
export interface SyncUser {
  uid: string;
  name: string | null;
  email: string | null;
  photo?: string | null;
}

// ── Event system ─────────────────────────────────────────────────────────────

export interface SyncEventMap {
  auth: { user: SyncUser | null; backend: SyncBackend | null };
  synced: SyncLastRecord;
  error: { message: string };
  auto: { on: boolean };
}

export type SyncEventName = keyof SyncEventMap;

export type SyncListener<E extends SyncEventName> = (
  payload: SyncEventMap[E],
) => void;

export type SyncUnsubscribe = () => void;

// ── GitHub raw shapes (from the GitHub REST API) ──────────────────────────────

export interface GhUserRaw {
  login: string;
  email: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

export interface GhGistListItem {
  id: string;
  files: Record<string, unknown> | null | undefined;
  [key: string]: unknown;
}

export interface GhGistFile {
  content?: string;
}

export interface GhGistReadResult {
  files?: Record<string, GhGistFile | undefined> | null;
  [key: string]: unknown;
}

export interface GhGistCreateResult {
  id: string;
  [key: string]: unknown;
}

export interface GhConnectResult {
  user: GhUserRaw;
  gistId: string;
  gistLink: string;
}

// ── Firebase minimal config ───────────────────────────────────────────────────

export type FbConfig = Record<string, unknown>;

/** Minimal Firebase user slice used internally after auth state change. */
export interface FbUserSlice {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FbInitResult {
  ok: boolean;
  reason?: string;
}

// ── Public API surface (window.CODEX_SYNC) ───────────────────────────────────

export interface CodexSyncApi {
  on<E extends SyncEventName>(ev: E, fn: SyncListener<E>): SyncUnsubscribe;
  isSyncable(key: unknown): boolean;
  getBackend(): SyncBackend;
  getAuto(): boolean;
  setAuto(v: boolean): void;
  getLast(): SyncLastRecord | null;

  github: {
    connect(token: string): Promise<GhConnectResult>;
    disconnect(): void;
    getToken(): string;
    getGistId(): string;
    /**
     * Returns the gist id (not full URL) when connected, null otherwise.
     * NOTE: preserved from legacy — the comment in the original says "Need user
     * login to build URL — read from cached fire state" but the implementation
     * returns just the gist id. Preserved verbatim.
     */
    getLink(): string | null;
  };

  firebase: {
    getConfig(): FbConfig | null;
    setConfig(c: FbConfig): void;
    clearConfig(): void;
    init(): Promise<FbInitResult>;
    signIn(): Promise<void>;
    signOut(): Promise<void>;
  };

  pullOnce(): Promise<{ changed: number } | { ok: boolean }>;
  pushNow(): Promise<{ ok: true }>;
  readonly user: SyncUser | null;
}
