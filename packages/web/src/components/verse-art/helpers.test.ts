// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ART_MORE_PROMPT, preloadImg, wikiThumb, resolveArtImage } from "./helpers.js";

// jsdom's Image element does not fetch URLs, so we must control
// onload/onerror manually for preloadImg tests.
class MockImageLoad {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) { queueMicrotask(() => this.onload?.()); }
}
class MockImageError {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) { queueMicrotask(() => this.onerror?.()); }
}

// ── ART_MORE_PROMPT ───────────────────────────────────────────────────────
describe("ART_MORE_PROMPT", () => {
  it("lists excluded titles quoted", () => {
    const result = ART_MORE_PROMPT(["The Last Supper", "Annunciation"]);
    expect(result).toContain('"The Last Supper"');
    expect(result).toContain('"Annunciation"');
    expect(result).toContain("EXCLUDE these already-shown titles");
    expect(result).toContain("6 new works");
  });

  it("handles an empty exclude list gracefully", () => {
    const result = ART_MORE_PROMPT([]);
    expect(result).toContain("EXCLUDE these already-shown titles:");
  });
});

// ── preloadImg ────────────────────────────────────────────────────────────
describe("preloadImg", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns true when the image fires onload", async () => {
    vi.stubGlobal("Image", MockImageLoad);
    const result = await preloadImg("https://example.com/image.jpg");
    expect(result).toBe(true);
  });

  it("returns false when the image fires onerror", async () => {
    vi.stubGlobal("Image", MockImageError);
    const result = await preloadImg("https://!!bad!!");
    expect(result).toBe(false);
  });
});

// ── wikiThumb ─────────────────────────────────────────────────────────────
describe("wikiThumb", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns thumbnail.source when API responds with one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ thumbnail: { source: "https://upload.wikimedia.org/thumb/test.jpg" } }),
    }));
    expect(await wikiThumb("The_Annunciation")).toBe("https://upload.wikimedia.org/thumb/test.jpg");
  });

  it("falls back to originalimage.source when thumbnail absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ originalimage: { source: "https://upload.wikimedia.org/original/test.jpg" } }),
    }));
    expect(await wikiThumb("Some_Painting")).toBe("https://upload.wikimedia.org/original/test.jpg");
  });

  it("returns null for non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await wikiThumb("missing")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net error")));
    expect(await wikiThumb("anything")).toBeNull();
  });
});

// ── resolveArtImage ───────────────────────────────────────────────────────
describe("resolveArtImage", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns null when all fallback paths fail", async () => {
    vi.stubGlobal("Image", MockImageError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await resolveArtImage({ title: "Nonexistent__UniqueTitle_A1B2", artist: "Nobody" });
    expect(result).toBeNull();
  });

  it("uses cached result on second call with the same work identity", async () => {
    vi.stubGlobal("Image", MockImageError);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const work = { title: "Cached__UniqueTitle_X9Y8", artist: "Old Master" };
    const r1 = await resolveArtImage(work);
    const callsAfterFirst = fetchMock.mock.calls.length;
    const r2 = await resolveArtImage(work);
    expect(r1).toBe(r2);
    // Second call must not make more network requests (served from cache)
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("returns a Commons URL when commonsFile resolves successfully", async () => {
    vi.stubGlobal("Image", MockImageLoad);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const work = { title: "Works__UniqueTitle_C3D4", artist: "Caravaggio", commonsFile: "Caravaggio_-_Test.jpg" };
    const result = await resolveArtImage(work);
    expect(result).toContain("commons.wikimedia.org/wiki/Special:FilePath/");
    expect(result).toContain("width=600");
  });
});
