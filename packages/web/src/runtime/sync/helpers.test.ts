// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isSyncable,
  collectLocal,
  applyRemote,
  on,
  pull,
  push,
  setAuto,
  getAuto,
  getLast,
  getBackend,
  ghToken,
  ghGistId,
  ghConnect,
  ghDisconnect,
  ghVerifyToken,
  _resetForTest,
  LS_BACKEND,
  LS_GH_TOKEN,
  LS_GH_GIST,
  LS_AUTO,
  LS_LAST,
} from "./helpers.js";

// ── Fake localStorage ─────────────────────────────────────────────────────────
// jsdom localStorage is blocked by opaque origin; install a simple in-memory
// shim that mirrors the full Storage interface used by helpers.ts.

function installFakeLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();

  const storage: Storage = {
    get length() { return store.size; },
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear:      () => { store.clear(); },
    key:        (i: number) => [...store.keys()][i] ?? null,
  };

  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return store;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

let store: Map<string, string>;

beforeEach(() => {
  store = installFakeLocalStorage();
  vi.restoreAllMocks();
  _resetForTest();
});

// ── Helper: mock fetch ────────────────────────────────────────────────────────

interface MockResponse {
  ok?: boolean;
  status?: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

function makeFakeResponse(res: MockResponse) {
  return {
    ok:     res.ok ?? true,
    status: res.status ?? 200,
    json:   () => Promise.resolve(res.body ?? {}),
    text:   () => Promise.resolve(res.text ?? ""),
    headers: { get: (k: string) => res.headers?.[k.toLowerCase()] ?? null },
  };
}

function mockFetchOnce(res: MockResponse): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValueOnce(makeFakeResponse(res));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function mockFetchSequence(responses: MockResponse[]): ReturnType<typeof vi.fn> {
  let fn = vi.fn();
  for (const res of responses) {
    fn = fn.mockResolvedValueOnce(makeFakeResponse(res));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

// ── isSyncable ────────────────────────────────────────────────────────────────

describe("isSyncable", () => {
  it("returns false for null", () => {
    expect(isSyncable(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSyncable(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSyncable("")).toBe(false);
  });

  it("returns false for non-string types", () => {
    expect(isSyncable(42)).toBe(false);
    expect(isSyncable({})).toBe(false);
  });

  it.each([
    "codex.api.keys",
    "codex.anthropic.key",
    "codex.sync.backend.v1",
    "codex.sync.github.token.v1",
    "codex.session.whatever",
    "codex.btc.token",
    "codex.oracle",
    "codex.oracle.extra",
  ])("returns false for NEVER_SYNC key: %s", (key) => {
    expect(isSyncable(key)).toBe(false);
  });

  it.each([
    "codex.tweaks.fontSize",
    "codex.marks.Gen.1.1",
    "codex.bookmarks.list",
    "codex.notes.draft",
    "codex.bible.translation",
    "codex.panels.layout",
    "codex.redletter.on",
    "codex.bootIntro",
    "codex.bootIntro.extra",
    "codex.lang",
    "codex.lang.pref",
  ])("returns true for SYNC_PREFIXES key: %s", (key) => {
    expect(isSyncable(key)).toBe(true);
  });

  it("returns false for keys matching no prefix", () => {
    expect(isSyncable("codex.unknown.key")).toBe(false);
    expect(isSyncable("other.key")).toBe(false);
  });
});

// ── collectLocal ──────────────────────────────────────────────────────────────

describe("collectLocal", () => {
  it("returns empty object when localStorage is empty", () => {
    expect(collectLocal()).toEqual({});
  });

  it("includes syncable keys", () => {
    localStorage.setItem("codex.tweaks.fontSize", "18");
    localStorage.setItem("codex.marks.a", "true");
    const result = collectLocal();
    expect(result["codex.tweaks.fontSize"]).toBeDefined();
    expect(result["codex.marks.a"]).toBeDefined();
  });

  it("excludes NEVER_SYNC and unrecognised keys", () => {
    localStorage.setItem("codex.api.keys", "secret");
    localStorage.setItem("codex.sync.backend.v1", "github");
    localStorage.setItem("unrelated", "val");
    const result = collectLocal();
    expect(result["codex.api.keys"]).toBeUndefined();
    expect(result["codex.sync.backend.v1"]).toBeUndefined();
    expect(result["unrelated"]).toBeUndefined();
  });

  it("stores the raw string value in .v", () => {
    localStorage.setItem("codex.lang", "en");
    const result = collectLocal();
    expect(result["codex.lang"]?.v).toBe("en");
  });

  it("stores a numeric timestamp in .t", () => {
    localStorage.setItem("codex.lang", "en");
    const before = Date.now();
    const result = collectLocal();
    const after = Date.now();
    const t = result["codex.lang"]?.t ?? 0;
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

// ── applyRemote ───────────────────────────────────────────────────────────────

describe("applyRemote", () => {
  it("returns { changed: 0 } for null", () => {
    expect(applyRemote(null)).toEqual({ changed: 0 });
  });

  it("returns { changed: 0 } for payload with no keys", () => {
    expect(applyRemote({ updatedAt: 0 })).toEqual({ changed: 0 });
  });

  it("writes a syncable key that differs from local", () => {
    const result = applyRemote({ keys: { "codex.lang": { v: "he", t: 1 } } });
    expect(localStorage.getItem("codex.lang")).toBe("he");
    expect(result.changed).toBe(1);
  });

  it("skips a key whose local value already matches remote", () => {
    localStorage.setItem("codex.lang", "en");
    const result = applyRemote({ keys: { "codex.lang": { v: "en", t: 1 } } });
    expect(result.changed).toBe(0);
  });

  it("never writes NEVER_SYNC keys", () => {
    applyRemote({ keys: { "codex.api.keys": { v: "leaked", t: 1 } } });
    expect(store.has("codex.api.keys")).toBe(false);
  });

  it("skips entries where v is not a string", () => {
    const result = applyRemote({ keys: { "codex.lang": { v: 42, t: 1 } } });
    expect(result.changed).toBe(0);
  });

  it("skips null entries", () => {
    const result = applyRemote({ keys: { "codex.lang": null } });
    expect(result.changed).toBe(0);
  });

  it("counts multiple changed keys", () => {
    const result = applyRemote({
      keys: {
        "codex.lang": { v: "de", t: 1 },
        "codex.tweaks.x": { v: "1", t: 1 },
      },
    });
    expect(result.changed).toBe(2);
    expect(localStorage.getItem("codex.lang")).toBe("de");
    expect(localStorage.getItem("codex.tweaks.x")).toBe("1");
  });
});

// ── Event system (on) ─────────────────────────────────────────────────────────

describe("on / event system", () => {
  it("fires 'auto' event when setAuto is called", () => {
    const received: { on: boolean }[] = [];
    on("auto", (p) => { received.push(p); });
    setAuto(true);
    expect(received).toHaveLength(1);
    expect(received[0]?.on).toBe(true);
  });

  it("unsubscribe stops future events", () => {
    const received: { on: boolean }[] = [];
    const unsub = on("auto", (p) => { received.push(p); });
    setAuto(true);
    unsub();
    setAuto(false);
    expect(received).toHaveLength(1); // only the first call
  });

  it("supports multiple listeners on the same event", () => {
    const a: boolean[] = [];
    const b: boolean[] = [];
    on("auto", (p) => { a.push(p.on); });
    on("auto", (p) => { b.push(p.on); });
    setAuto(true);
    expect(a).toEqual([true]);
    expect(b).toEqual([true]);
  });

  it("swallows errors thrown by a listener", () => {
    on("auto", () => { throw new Error("listener boom"); });
    expect(() => setAuto(true)).not.toThrow();
  });
});

// ── getAuto / setAuto ─────────────────────────────────────────────────────────

describe("getAuto / setAuto", () => {
  it("defaults to false when LS_AUTO is not set", () => {
    expect(getAuto()).toBe(false);
  });

  it("setAuto(true) stores '1' and getAuto() returns true", () => {
    setAuto(true);
    expect(localStorage.getItem(LS_AUTO)).toBe("1");
    expect(getAuto()).toBe(true);
  });

  it("setAuto(false) stores '0' and getAuto() returns false", () => {
    setAuto(false);
    expect(localStorage.getItem(LS_AUTO)).toBe("0");
    expect(getAuto()).toBe(false);
  });
});

// ── getLast ───────────────────────────────────────────────────────────────────

describe("getLast", () => {
  it("returns null when LS_LAST is not set", () => {
    expect(getLast()).toBeNull();
  });

  it("returns the stored record", () => {
    const record = { at: 1000, direction: "up" as const, count: 3 };
    localStorage.setItem(LS_LAST, JSON.stringify(record));
    expect(getLast()).toEqual(record);
  });
});

// ── getBackend ────────────────────────────────────────────────────────────────

describe("getBackend", () => {
  it("returns '' when not set", () => {
    expect(getBackend()).toBe("");
  });

  it("returns 'github' when set", () => {
    localStorage.setItem(LS_BACKEND, "github");
    expect(getBackend()).toBe("github");
  });

  it("returns '' for an unknown backend string", () => {
    localStorage.setItem(LS_BACKEND, "unknown-backend");
    expect(getBackend()).toBe("");
  });
});

// ── ghVerifyToken ─────────────────────────────────────────────────────────────

describe("ghVerifyToken", () => {
  it("resolves with the user object when valid token with gist scope", async () => {
    mockFetchOnce({
      ok: true,
      body: { login: "alice", email: "a@b.com", avatar_url: "https://img" },
      headers: { "x-oauth-scopes": "gist, repo" },
    });
    const u = await ghVerifyToken("tok");
    expect(u.login).toBe("alice");
  });

  it("throws when the response is not ok", async () => {
    mockFetchOnce({ ok: false, status: 401, body: {} });
    await expect(ghVerifyToken("bad")).rejects.toThrow("GitHub auth failed: 401");
  });

  it("throws when gist scope is absent", async () => {
    mockFetchOnce({
      ok: true,
      body: { login: "alice" },
      headers: { "x-oauth-scopes": "repo, read:user" },
    });
    await expect(ghVerifyToken("tok")).rejects.toThrow("missing the 'gist' scope");
  });
});

// ── ghConnect / ghDisconnect ──────────────────────────────────────────────────

describe("ghConnect", () => {
  it("sets token + gist id, fires auth, pulls remote", async () => {
    // Sequence: /user → /gists (existing) → /gists/{id} (pull)
    mockFetchSequence([
      {
        ok: true,
        body: { login: "alice", email: "a@b.com", avatar_url: "https://img" },
        headers: { "x-oauth-scopes": "gist" },
      },
      { ok: true, body: [{ id: "gist123", files: { "codex-sync.json": {} } }] },
      {
        ok: true,
        body: { files: { "codex-sync.json": { content: '{"keys":{},"updatedAt":0}' } } },
      },
    ]);

    const authEvents: Array<{ user: { name: string | null } | null }> = [];
    on("auth", (p) => { authEvents.push(p as typeof authEvents[number]); });

    const result = await ghConnect("tok");

    expect(result.gistId).toBe("gist123");
    expect(localStorage.getItem(LS_GH_TOKEN)).toBe("tok");
    expect(localStorage.getItem(LS_GH_GIST)).toBe("gist123");
    expect(localStorage.getItem(LS_BACKEND)).toBe("github");
    expect(authEvents).toHaveLength(1);
    expect(authEvents[0]?.user?.name).toBe("alice");
  });

  it("creates a new gist when the user has none yet", async () => {
    mockFetchSequence([
      {
        ok: true,
        body: { login: "bob", email: null, avatar_url: null },
        headers: { "x-oauth-scopes": "gist" },
      },
      { ok: true, body: [] },           // no existing gists
      { ok: true, body: { id: "newGist" } },  // create
      {
        ok: true,
        body: { files: { "codex-sync.json": { content: '{"keys":{},"updatedAt":0}' } } },
      },
    ]);

    const result = await ghConnect("tok2");
    expect(result.gistId).toBe("newGist");
    expect(localStorage.getItem(LS_GH_GIST)).toBe("newGist");
  });
});

describe("ghDisconnect", () => {
  it("removes token and gist id, clears backend, fires auth null", () => {
    localStorage.setItem(LS_GH_TOKEN, "tok");
    localStorage.setItem(LS_GH_GIST, "gist123");
    localStorage.setItem(LS_BACKEND, "github");

    const authPayloads: Array<{ user: unknown; backend: unknown }> = [];
    on("auth", (p) => { authPayloads.push(p); });

    ghDisconnect();

    expect(localStorage.getItem(LS_GH_TOKEN)).toBeNull();
    expect(localStorage.getItem(LS_GH_GIST)).toBeNull();
    expect(localStorage.getItem(LS_BACKEND)).toBeNull();
    expect(ghToken()).toBe("");
    expect(ghGistId()).toBe("");
    expect(authPayloads[0]?.user).toBeNull();
  });
});

// ── pull (GitHub) ─────────────────────────────────────────────────────────────

describe("pull (github backend)", () => {
  beforeEach(() => {
    localStorage.setItem(LS_BACKEND, "github");
    localStorage.setItem(LS_GH_TOKEN, "tok");
    localStorage.setItem(LS_GH_GIST, "g1");
  });

  it("applies remote keys to localStorage and fires synced", async () => {
    mockFetchOnce({
      ok: true,
      body: {
        files: {
          "codex-sync.json": {
            content: JSON.stringify({
              keys: { "codex.lang": { v: "he", t: 1 } },
              updatedAt: 100,
            }),
          },
        },
      },
    });

    const synced: Array<{ direction: string; changed?: number }> = [];
    on("synced", (p) => { synced.push(p as typeof synced[number]); });

    const result = await pull();

    expect(localStorage.getItem("codex.lang")).toBe("he");
    expect((result as { changed: number }).changed).toBe(1);
    expect(synced).toHaveLength(1);
    expect(synced[0]?.direction).toBe("down");
    expect(synced[0]?.changed).toBe(1);
  });

  it("throws when no backend is configured", async () => {
    localStorage.removeItem(LS_BACKEND);
    await expect(pull()).rejects.toThrow("No sync backend configured.");
  });

  it("handles empty gist content gracefully (zero changed)", async () => {
    mockFetchOnce({
      ok: true,
      body: {
        files: {
          "codex-sync.json": { content: '{"keys":{},"updatedAt":0}' },
        },
      },
    });
    const result = await pull();
    expect((result as { changed: number }).changed).toBe(0);
  });

  it("stores the sync timestamp in LS_LAST", async () => {
    mockFetchOnce({
      ok: true,
      body: { files: { "codex-sync.json": { content: '{"keys":{},"updatedAt":0}' } } },
    });
    const before = Date.now();
    await pull();
    const last = getLast();
    expect(last).not.toBeNull();
    expect(last?.at).toBeGreaterThanOrEqual(before);
    expect(last?.direction).toBe("down");
  });
});

// ── push (GitHub) ─────────────────────────────────────────────────────────────

describe("push (github backend)", () => {
  beforeEach(() => {
    localStorage.setItem(LS_BACKEND, "github");
    localStorage.setItem(LS_GH_TOKEN, "tok");
    localStorage.setItem(LS_GH_GIST, "g1");
  });

  it("PATCHes gist with local keys and fires synced", async () => {
    localStorage.setItem("codex.lang", "fr");
    localStorage.setItem("codex.tweaks.x", "1");
    // Non-syncable key — must not appear in payload
    localStorage.setItem("codex.api.keys", "secret");

    const fetchMock = vi.fn().mockResolvedValue(makeFakeResponse({ ok: true, body: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const synced: Array<{ direction: string; count?: number }> = [];
    on("synced", (p) => { synced.push(p as typeof synced[number]); });

    const result = await push();
    expect(result.ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const [, init] = call!;
    const body = JSON.parse(init.body as string) as {
      files: { "codex-sync.json": { content: string } };
    };
    const payload = JSON.parse(body.files["codex-sync.json"].content) as {
      keys: Record<string, { v: string }>;
    };

    expect(payload.keys["codex.lang"]?.v).toBe("fr");
    expect(payload.keys["codex.tweaks.x"]?.v).toBe("1");
    expect(payload.keys["codex.api.keys"]).toBeUndefined();

    expect(synced).toHaveLength(1);
    expect(synced[0]?.direction).toBe("up");
  });

  it("merges _lastRemote keys so remote-only keys survive", async () => {
    // Pull first to populate _lastRemote with a remote-only key
    mockFetchSequence([
      // pull
      {
        ok: true,
        body: {
          files: {
            "codex-sync.json": {
              content: JSON.stringify({
                keys: { "codex.notes.remote": { v: "remote-only", t: 1 } },
                updatedAt: 1,
              }),
            },
          },
        },
      },
      // push (PATCH) — just needs to succeed
      { ok: true, body: {} },
    ]);

    localStorage.setItem("codex.lang", "it");
    await pull(); // populates _lastRemote

    const fetchMock = vi.fn().mockResolvedValue(makeFakeResponse({ ok: true, body: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await push();

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const [, init] = call!;
    const body = JSON.parse(init.body as string) as {
      files: { "codex-sync.json": { content: string } };
    };
    const payload = JSON.parse(body.files["codex-sync.json"].content) as {
      keys: Record<string, { v: string }>;
    };

    // Remote-only key must be preserved
    expect(payload.keys["codex.notes.remote"]?.v).toBe("remote-only");
    // Local key must be present
    expect(payload.keys["codex.lang"]?.v).toBe("it");
  });

  it("throws when no backend is configured", async () => {
    localStorage.removeItem(LS_BACKEND);
    await expect(push()).rejects.toThrow("No sync backend configured.");
  });
});
