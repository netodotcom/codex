// sync — loader logic (faithful port from legacy/sync.js).
// Cross-device / storage sync via GitHub Gist or Firebase.
// Pure browser JS; no deps beyond DOM globals and sw() window slice.
import type {
  SyncBackend,
  SyncEntry,
  SyncPayload,
  SyncLastRecord,
  SyncUser,
  SyncEventMap,
  SyncEventName,
  SyncListener,
  SyncUnsubscribe,
  GhUserRaw,
  GhGistListItem,
  GhGistReadResult,
  GhGistCreateResult,
  GhConnectResult,
  FbConfig,
  FbUserSlice,
  FbInitResult,
} from "./types.js";
import type {
  FirebaseAuthCompat,
  FirebaseFirestoreCompat,
  FirebaseAppInstance,
} from "./sync-window.js";
import { sw } from "./sync-window.js";

// ── Storage keys ──────────────────────────────────────────────────────────────

export const LS_BACKEND  = "codex.sync.backend.v1";
export const LS_GH_TOKEN = "codex.sync.github.token.v1";
export const LS_GH_GIST  = "codex.sync.github.gistId.v1";
export const LS_FB_CFG   = "codex.sync.firebaseConfig.v1";
export const LS_AUTO     = "codex.sync.auto.v1";
export const LS_LAST     = "codex.sync.lastSync.v1";

// ── Which keys sync ───────────────────────────────────────────────────────────

const SYNC_PREFIXES: readonly string[] = [
  "codex.tweaks.",
  "codex.marks.",
  "codex.bookmarks.",
  "codex.notes.",
  "codex.bible.",
  "codex.panels.",
  "codex.redletter.",
  "codex.bootIntro",
  "codex.lang",
];
const NEVER_SYNC: readonly string[] = [
  "codex.api.keys",       // AI provider API keys
  "codex.anthropic.key",  // legacy Anthropic key
  "codex.sync.",          // sync config (tokens, gist IDs)
  "codex.session.",       // ephemeral session state
  "codex.btc.token",      // donation pool bearer token
  "codex.oracle",         // Oracle chat history — PRIVATE, local-only, never leaves the device
];

export function isSyncable(key: unknown): key is string {
  if (!key || typeof key !== "string") return false;
  for (const bad of NEVER_SYNC) if (key.startsWith(bad)) return false;
  for (const ok of SYNC_PREFIXES) if (key.startsWith(ok)) return true;
  return false;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const ls = {
  get<T>(k: string, d: T): T {
    try {
      // NOTE: preserved from legacy — uses `||` (falsy), not `??` (nullish).
      // An empty-string value is treated as missing and falls back to default.
      const raw = localStorage.getItem(k);
      return JSON.parse(raw || JSON.stringify(d)) as T;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown): void {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* swallow */ }
  },
};

// ── Event system ──────────────────────────────────────────────────────────────

type AnyListener = (payload: unknown) => void;
const _listeners: Partial<Record<SyncEventName, AnyListener[]>> = {};

function fire<E extends SyncEventName>(ev: E, payload: SyncEventMap[E]): void {
  const fns = _listeners[ev];
  if (!fns) return;
  for (const fn of fns) {
    try { fn(payload as unknown); } catch { /* swallow */ }
  }
}

export function on<E extends SyncEventName>(
  ev: E,
  fn: SyncListener<E>,
): SyncUnsubscribe {
  // NOTE: preserved from legacy — (_listeners[ev] = _listeners[ev] || []).push(fn)
  const existing = _listeners[ev];
  const list: AnyListener[] = existing ?? [];
  _listeners[ev] = list;
  list.push(fn as AnyListener);
  return () => {
    const l = _listeners[ev];
    if (l) _listeners[ev] = l.filter(x => x !== (fn as AnyListener));
  };
}

// ── Backend selection ─────────────────────────────────────────────────────────

export function getBackend(): SyncBackend {
  const v = localStorage.getItem(LS_BACKEND) ?? "";
  // guard: only accept known backends; default to empty string
  if (v === "github" || v === "firebase") return v;
  return "";
}

function setBackend(b: SyncBackend): void {
  if (b) localStorage.setItem(LS_BACKEND, b);
  else localStorage.removeItem(LS_BACKEND);
}

// ── Local snapshot helpers ────────────────────────────────────────────────────

export function collectLocal(): Record<string, SyncEntry> {
  const keys: Record<string, SyncEntry> = {};
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!isSyncable(k)) continue;
    const v = localStorage.getItem(k);
    if (v == null) continue;
    keys[k] = { v, t: now };
  }
  return keys;
}

export function applyRemote(remote: unknown): { changed: number } {
  if (!remote || typeof remote !== "object") return { changed: 0 };
  const r = remote as Record<string, unknown>;
  const remoteKeys = r["keys"];
  if (!remoteKeys || typeof remoteKeys !== "object") return { changed: 0 };
  const keysMap = remoteKeys as Record<string, unknown>;
  let changed = 0;
  for (const k of Object.keys(keysMap)) {
    if (!isSyncable(k)) continue;
    const entry = keysMap[k];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e["v"] !== "string") continue;
    const entryV = e["v"];
    const localRaw = localStorage.getItem(k);
    if (localRaw === entryV) continue;
    try {
      _suspendPush = true;
      localStorage.setItem(k, entryV);
      changed++;
    } finally {
      _suspendPush = false;
    }
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: entryV }));
    } catch { /* swallow */ }
  }
  return { changed };
}

// ── Local-change watcher ──────────────────────────────────────────────────────

// true while applying remote data — prevents the localStorage.setItem monkey-patch
// from triggering a push and creating a feedback loop.
export let _suspendPush = false;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(): void {
  if (_suspendPush) return;
  // NOTE: preserved from legacy — this condition is always false:
  //   `!localStorage.getItem(LS_AUTO) === "1"` evaluates as `(boolean) === "1"`.
  // The original comment says "still allow manual". The timer is always set up.
  // @ts-expect-error TS2367 — intentional no-op, preserved verbatim from legacy
  if (!localStorage.getItem(LS_AUTO) === "1") { /* still allow manual */ }
  if (_pushTimer !== null) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    if (localStorage.getItem(LS_AUTO) === "1") {
      push().catch((e: unknown) => {
        fire("error", { message: e instanceof Error ? e.message : String(e) });
      });
    }
  }, 1500);
}

/**
 * Installs the localStorage.setItem monkey-patch and the cross-tab "storage"
 * event listener. Called once from index.ts at import time.
 */
export function installWatcher(): void {
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function setItem(k: string, v: string): void {
    origSet(k, v);
    if (isSyncable(k)) schedulePush();
  };
  window.addEventListener("storage", (e: StorageEvent) => {
    if (isSyncable(e.key)) schedulePush();
  });
}

// ── Backend: GitHub Gist ──────────────────────────────────────────────────────
// One private gist per user. File name: codex-sync.json. Updates via PATCH.

const GH_API = "https://api.github.com";

export function ghToken(): string { return localStorage.getItem(LS_GH_TOKEN) ?? ""; }
export function ghGistId(): string { return localStorage.getItem(LS_GH_GIST) ?? ""; }

function ghHeaders(): Record<string, string> {
  return {
    "Authorization": "token " + ghToken(),
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function ghVerifyToken(token: string): Promise<GhUserRaw> {
  const r = await fetch(GH_API + "/user", {
    headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error("GitHub auth failed: " + r.status + " (token invalid or revoked)");
  const scopes = (r.headers.get("x-oauth-scopes") ?? "").split(",").map(s => s.trim());
  if (!scopes.includes("gist")) {
    throw new Error(
      "Token is missing the 'gist' scope. Generate a new token with the 'gist' checkbox ticked.",
    );
  }
  return r.json() as Promise<GhUserRaw>;
}

export async function ghFindOrCreateGist(token: string): Promise<string> {
  const list = await fetch(GH_API + "/gists?per_page=100", {
    headers: { Authorization: "token " + token, Accept: "application/vnd.github+json" },
  });
  if (!list.ok) throw new Error("GitHub /gists failed: " + list.status);
  const gists = await list.json() as GhGistListItem[];
  const existing = gists.find(g => g.files != null && g.files["codex-sync.json"] != null);
  if (existing) return existing.id;
  // Create new private gist
  const create = await fetch(GH_API + "/gists", {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({
      description: "CODEX · cross-device sync (encrypted-by-token; do not share)",
      public: false,
      files: {
        "codex-sync.json": {
          content: JSON.stringify({ keys: {}, updatedAt: Date.now() }, null, 2),
        },
      },
    }),
  });
  if (!create.ok) {
    throw new Error(
      "GitHub gist create failed: " + create.status + " " + (await create.text()).slice(0, 200),
    );
  }
  const g = await create.json() as GhGistCreateResult;
  return g.id;
}

async function ghReadGist(): Promise<SyncPayload> {
  const id = ghGistId();
  if (!id) throw new Error("No gist id — connect first.");
  const r = await fetch(GH_API + "/gists/" + id, { headers: ghHeaders() });
  if (!r.ok) throw new Error("GitHub gist read failed: " + r.status);
  const g = await r.json() as GhGistReadResult;
  const fileEntry = g.files?.["codex-sync.json"];
  const raw: string | undefined = fileEntry?.content;
  if (!raw) return { keys: {}, updatedAt: 0 };
  try { return JSON.parse(raw) as SyncPayload; } catch { return { keys: {}, updatedAt: 0 }; }
}

async function ghWriteGist(payload: SyncPayload): Promise<void> {
  const id = ghGistId();
  if (!id) throw new Error("No gist id — connect first.");
  const r = await fetch(GH_API + "/gists/" + id, {
    method: "PATCH",
    headers: ghHeaders(),
    body: JSON.stringify({
      files: { "codex-sync.json": { content: JSON.stringify(payload, null, 2) } },
    }),
  });
  if (!r.ok) {
    throw new Error(
      "GitHub gist write failed: " + r.status + " " + (await r.text()).slice(0, 200),
    );
  }
}

export async function ghConnect(token: string): Promise<GhConnectResult> {
  const user = await ghVerifyToken(token);
  localStorage.setItem(LS_GH_TOKEN, token);
  // NOTE: preserved from legacy — login cached under a key not listed in the
  // storage-key constants block; used only to prime the UI login display.
  localStorage.setItem("codex.sync.github.login.v1", user.login);
  const gistId = await ghFindOrCreateGist(token);
  localStorage.setItem(LS_GH_GIST, gistId);
  setBackend("github");
  fire("auth", {
    user: { name: user.login, email: user.email, photo: user.avatar_url, uid: user.login },
    backend: "github",
  });
  // Pull existing remote before pushing local
  await pull();
  return {
    user,
    gistId,
    gistLink: githubGistLink(user.login, gistId),
  };
}

export function ghDisconnect(): void {
  localStorage.removeItem(LS_GH_TOKEN);
  localStorage.removeItem(LS_GH_GIST);
  setBackend("");
  fire("auth", { user: null, backend: null });
}

export function ghGetLink(): string | null {
  const id = ghGistId();
  const token = ghToken();
  if (!id || !token) return null;
  // NOTE: preserved from legacy — the comment says "Need user login to build URL
  // — read from cached fire state" but the implementation returns just the gist
  // id (not a full URL). Preserved verbatim.
  return id;
}

function githubGistLink(login: string, gistId: string): string {
  return `https://gist.github.com/${login}/${gistId}`;
}

// ── Pull / Push ───────────────────────────────────────────────────────────────

// Cached remote snapshot used in merge logic during push.
let _lastRemote: SyncPayload | null = null;

export async function pull(): Promise<{ changed: number } | { ok: boolean }> {
  const backend = getBackend();
  if (backend === "github") {
    const remote = await ghReadGist();
    _lastRemote = remote;
    const r = applyRemote(remote);
    const last: SyncLastRecord = { at: Date.now(), direction: "down", changed: r.changed };
    ls.set(LS_LAST, last);
    fire("synced", last);
    return r;
  }
  if (backend === "firebase") {
    return fbPull();
  }
  throw new Error("No sync backend configured.");
}

export async function push(): Promise<{ ok: true }> {
  const backend = getBackend();
  const local = collectLocal();
  // Merge: keep remote-only keys, overwrite shared/local-only keys
  const merged: Record<string, SyncEntry> = _lastRemote?.keys
    ? { ..._lastRemote.keys, ...local }
    : local;
  const payload: SyncPayload = { keys: merged, updatedAt: Date.now() };
  if (backend === "github") {
    await ghWriteGist(payload);
    _lastRemote = payload;
  } else if (backend === "firebase") {
    await fbPushPayload(payload);
    _lastRemote = payload;
  } else {
    throw new Error("No sync backend configured.");
  }
  const last: SyncLastRecord = {
    at: Date.now(),
    direction: "up",
    count: Object.keys(local).length,
  };
  ls.set(LS_LAST, last);
  fire("synced", last);
  return { ok: true };
}

export function setAuto(v: boolean): void {
  localStorage.setItem(LS_AUTO, v ? "1" : "0");
  if (v && getBackend() === "github") startGhPoll();
  else stopGhPoll();
  fire("auto", { on: v });
}

export function getAuto(): boolean {
  return localStorage.getItem(LS_AUTO) === "1";
}

export function getLast(): SyncLastRecord | null {
  return ls.get<SyncLastRecord | null>(LS_LAST, null);
}

// ── Periodic GitHub poll ──────────────────────────────────────────────────────
// No real-time subscription for Gist; poll every 60 s.

let _ghPollTimer: ReturnType<typeof setInterval> | null = null;

function startGhPoll(): void {
  stopGhPoll();
  _ghPollTimer = setInterval(() => {
    pull().catch((e: unknown) => {
      fire("error", { message: e instanceof Error ? e.message : String(e) });
    });
  }, 60000);
}

function stopGhPoll(): void {
  if (_ghPollTimer !== null) { clearInterval(_ghPollTimer); _ghPollTimer = null; }
}

// ── Backend: Firebase (kept as alt path) ──────────────────────────────────────

let fbApp:   FirebaseAppInstance | null = null;
let fbAuth:  FirebaseAuthCompat | null = null;
let fbDb:    FirebaseFirestoreCompat | null = null;
let fbUser:  FbUserSlice | null = null;
let fbUnsub: (() => void) | null = null;

export function fbGetConfig(): FbConfig | null {
  return ls.get<FbConfig | null>(LS_FB_CFG, null);
}
export function fbSetConfig(c: FbConfig): void { ls.set(LS_FB_CFG, c); }
export function fbClearConfig(): void {
  try { localStorage.removeItem(LS_FB_CFG); } catch { /* swallow */ }
}

function fbEnsureLoaded(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const fb = sw().firebase;
    // NOTE: preserved from legacy — guards that the compat SDK is fully loaded;
    // using fb != null since the TypeScript interface already guarantees the shape.
    if (fb != null) return resolve();
    const scripts = [
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js",
      "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js",
    ];
    let i = 0;
    const next = (): void => {
      if (i >= scripts.length) return resolve();
      const s = document.createElement("script");
      const src = scripts[i++];
      if (!src) return resolve();
      s.src = src;
      s.onload = next;
      s.onerror = () => reject(new Error("Failed " + s.src));
      document.head.appendChild(s);
    };
    next();
  });
}

export async function fbInit(): Promise<FbInitResult> {
  const cfg = fbGetConfig();
  if (!cfg) return { ok: false, reason: "no-config" };
  await fbEnsureLoaded();
  if (!fbApp) {
    const fb = sw().firebase;
    if (!fb) return { ok: false, reason: "firebase-sdk-missing" };
    fbApp  = fb.initializeApp(cfg);
    fbAuth = fb.auth();
    fbDb   = fb.firestore();
    fbAuth.onAuthStateChanged(async (userRaw: unknown) => {
      if (userRaw && typeof userRaw === "object") {
        // NOTE: preserved from legacy — cast; Firebase compat returns opaque user object
        const u = userRaw as FbUserSlice;
        fbUser = u;
        fire("auth", {
          user: { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL },
          backend: "firebase",
        });
        setBackend("firebase");
        fbSubscribe();
        await fbPull();
      } else {
        fbUser = null;
        fire("auth", { user: null, backend: null });
        fbUnsubscribe();
      }
    });
  }
  return { ok: true };
}

export async function fbSignIn(): Promise<void> {
  const r = await fbInit();
  if (!r.ok) throw new Error("Firebase not configured: " + (r.reason ?? "unknown"));
  const fb = sw().firebase;
  if (!fb) throw new Error("Firebase SDK not available");
  const provider = new fb.auth.GoogleAuthProvider();
  await fbAuth!.signInWithPopup(provider);
}

export async function fbSignOut(): Promise<void> {
  if (fbAuth) await fbAuth.signOut();
  setBackend("");
}

function fbSubscribe(): void {
  if (!fbUser || !fbDb) return;
  fbUnsubscribe();
  const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
  fbUnsub = ref.onSnapshot((snap) => {
    const data = snap.data();
    if (!data) return;
    // NOTE: preserved from legacy — Firestore doc data is cast to SyncPayload;
    // structure is assumed to match what we wrote via fbPushPayload.
    _lastRemote = data as unknown as SyncPayload;
    const r = applyRemote(data);
    if (r.changed > 0) {
      const last: SyncLastRecord = { at: Date.now(), direction: "down", changed: r.changed };
      ls.set(LS_LAST, last);
      fire("synced", last);
    }
  });
}

function fbUnsubscribe(): void {
  if (fbUnsub) { fbUnsub(); fbUnsub = null; }
}

async function fbPull(): Promise<{ ok: boolean }> {
  if (!fbUser || !fbDb) return { ok: false };
  const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data();
    if (data) {
      // NOTE: preserved from legacy — same cast as fbSubscribe
      _lastRemote = data as unknown as SyncPayload;
      applyRemote(data);
    }
  }
  return { ok: true };
}

async function fbPushPayload(payload: SyncPayload): Promise<void> {
  if (!fbUser || !fbDb) throw new Error("Not signed in");
  const ref = fbDb.collection("users").doc(fbUser.uid).collection("sync").doc("main");
  await ref.set(payload, { merge: true });
}

// ── User getter ───────────────────────────────────────────────────────────────

export function getSyncUser(): SyncUser | null {
  if (getBackend() === "github") {
    const tok = ghToken();
    return tok ? { uid: "gh", name: "(connected)", email: "" } : null;
  }
  return fbUser
    ? { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName, photo: fbUser.photoURL }
    : null;
}

// ── Auto-init (called from index.ts after installWatcher) ─────────────────────

export function runAutoInit(): void {
  const backendOnBoot = getBackend();
  if (backendOnBoot === "github" && ghToken() && ghGistId()) {
    // Restore "signed in" UI state on reload
    setTimeout(async () => {
      try {
        const u = await ghVerifyToken(ghToken());
        fire("auth", {
          user: { name: u.login, email: u.email, photo: u.avatar_url, uid: u.login },
          backend: "github",
        });
        await pull();
        if (getAuto()) startGhPoll();
      } catch (e: unknown) {
        fire("error", {
          message: "GitHub sync init failed: " + (e instanceof Error ? e.message : String(e)),
        });
      }
    }, 200);
  } else if (backendOnBoot === "firebase" && fbGetConfig()) {
    void fbInit();
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** @internal Reset all module-level state between test runs. */
export function _resetForTest(): void {
  _suspendPush = false;
  if (_pushTimer !== null) { clearTimeout(_pushTimer); _pushTimer = null; }
  if (_ghPollTimer !== null) { clearInterval(_ghPollTimer); _ghPollTimer = null; }
  _lastRemote = null;
  fbApp = null; fbAuth = null; fbDb = null; fbUser = null; fbUnsub = null;
  for (const key of Object.keys(_listeners) as SyncEventName[]) {
    delete _listeners[key];
  }
}
