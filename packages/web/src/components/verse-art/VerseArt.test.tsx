// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VerseArt, ArtCard } from "./VerseArt.js";

// jsdom Image does not fetch; control onload/onerror via stubs.
class MockImageError {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) { queueMicrotask(() => this.onerror?.()); }
}

// A minimal localStorage shim for jsdom environments that lack clear().
const _lsData = new Map<string, string>();
const _lsShim = {
  getItem: (k: string) => _lsData.get(k) ?? null,
  setItem: (k: string, v: string) => { _lsData.set(k, v); },
  removeItem: (k: string) => { _lsData.delete(k); },
  clear: () => { _lsData.clear(); },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("Image", MockImageError);
  // Keep network silent by default (loading state stays)
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  // Provide CODEX_INTEL on window
  (window as unknown as { CODEX_INTEL?: unknown }).CODEX_INTEL = {
    intelParseJSON: (s: string) => JSON.parse(s) as unknown,
  };
  // Install localStorage shim
  try {
    // First try native — if .clear works, use it
    localStorage.clear();
  } catch {
    vi.stubGlobal("localStorage", _lsShim);
  }
  _lsData.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  _lsData.clear();
});

const DEFAULT_PROPS = {
  verse: { n: 1 },
  refStr: "John 3:16",
  verseText: "For God so loved the world…",
  passage: { bookId: "John", chapter: 3 },
  onClose: vi.fn(),
};

// ── VerseArt ──────────────────────────────────────────────────────────────
describe("VerseArt", () => {
  it("renders the loading spinner when no cached data exists", () => {
    render(<VerseArt {...DEFAULT_PROPS} />);
    expect(screen.getByText(/SURVEYING/i)).toBeTruthy();
    expect(screen.getByText(/PAINTINGS/i)).toBeTruthy();
    expect(screen.getByText(/querying the visual record/i)).toBeTruthy();
  });

  it("renders the header CODEX · ART tag and refStr", () => {
    render(<VerseArt {...DEFAULT_PROPS} />);
    expect(screen.getByText("CODEX · ART")).toBeTruthy();
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("calls onClose when the × button is clicked", () => {
    const onClose = vi.fn();
    render(<VerseArt {...DEFAULT_PROPS} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<VerseArt {...DEFAULT_PROPS} onClose={onClose} />);
    const backdrop = document.querySelector(".cx-art-backdrop") as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<VerseArt {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders from localStorage cache without calling the AI chat endpoint", async () => {
    const cachedData = {
      scene: "The Baptism of Christ",
      works: [
        {
          title: "Baptism of Christ",
          artist: "Verrocchio",
          year: 1475,
          medium: "oil on panel",
          summary: "A notable painting.",
          themes: "water, light, spirit",
        },
      ],
    };
    const cacheKey = `codex.art.John.3.1`;
    localStorage.setItem(cacheKey, JSON.stringify(cachedData));

    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    render(<VerseArt {...DEFAULT_PROPS} />);

    expect(screen.getByText(/The Baptism of Christ/)).toBeTruthy();
    expect(screen.getByText("Baptism of Christ")).toBeTruthy();
    expect(screen.getByText("Verrocchio")).toBeTruthy();
    // The /api/chat endpoint must NOT have been called — only image resolvers may use fetch.
    const chatCalls = fetchMock.mock.calls.filter(
      (args) => typeof args[0] === "string" && (args[0] as string).includes("/api/chat"),
    );
    expect(chatCalls).toHaveLength(0);
  });

  it("shows work count in the footer when data comes from cache", () => {
    const cachedData = {
      scene: "The Crucifixion",
      works: [
        { title: "Work A", artist: "Artist A" },
        { title: "Work B", artist: "Artist B" },
      ],
    };
    localStorage.setItem("codex.art.John.3.1", JSON.stringify(cachedData));
    render(<VerseArt {...DEFAULT_PROPS} />);
    expect(screen.getByText("2 works")).toBeTruthy();
  });

  it("shows error state when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ART ORACLE OFFLINE")));
    render(<VerseArt {...DEFAULT_PROPS} />);
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    // The error div has both <b> and <code> with the same text; use container query.
    expect(document.querySelector(".cx-art-err")).not.toBeNull();
    expect(document.querySelector(".cx-art-err b")?.textContent).toBe("ART ORACLE OFFLINE");
    expect(document.querySelector(".cx-art-err code")?.textContent).toBe("ART ORACLE OFFLINE");
  });
});

// ── ArtCard ───────────────────────────────────────────────────────────────
describe("ArtCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("renders title, artist, year, medium, summary, and themes", async () => {
    const work = {
      title: "The Last Supper",
      artist: "Leonardo da Vinci",
      year: 1498,
      medium: "tempera on gesso",
      location: "Santa Maria delle Grazie, Milan",
      summary: "A famous mural.",
      themes: "bread, wine, betrayal",
    };
    render(<ArtCard work={work} />);
    expect(screen.getByText("The Last Supper")).toBeTruthy();
    expect(screen.getByText("Leonardo da Vinci")).toBeTruthy();
    expect(screen.getByText(/1498 CE/)).toBeTruthy();
    expect(screen.getByText(/bread, wine, betrayal/)).toBeTruthy();
  });

  it("shows 'Anonymous' when artist is not provided", () => {
    render(<ArtCard work={{ title: "Unknown Fresco" }} />);
    expect(screen.getByText("Anonymous")).toBeTruthy();
  });

  it("shows the resolving placeholder initially", () => {
    render(<ArtCard work={{ title: "Painting", artist: "Artist" }} />);
    expect(screen.getByText("searching wikimedia…")).toBeTruthy();
  });

  it("shows 'no image catalogued' after all resolution paths fail", async () => {
    render(<ArtCard work={{ title: "NoPic__UniqueForTest", artist: "None" }} />);
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(screen.getByText("no image catalogued")).toBeTruthy();
  });

  it("links to Wikipedia when wikipedia field is set", () => {
    const work = {
      title: "The Annunciation",
      artist: "Fra Angelico",
      wikipedia: "The Annunciation (Fra Angelico, Cortona)",
    };
    render(<ArtCard work={work} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain("en.wikipedia.org/wiki/");
  });

  it("links to Commons when commonsFile is set but wikipedia is not", () => {
    render(<ArtCard work={{ title: "Test", artist: "Artist", commonsFile: "Test_painting.jpg" }} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain("commons.wikimedia.org/wiki/File:");
  });

  it("falls back to Google image search when neither wikipedia nor commonsFile is set", () => {
    render(<ArtCard work={{ title: "Obscure Work", artist: "Unknown" }} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain("google.com/search");
    expect(link.getAttribute("href")).toContain("tbm=isch");
  });

  it("formats BCE years correctly", () => {
    render(<ArtCard work={{ title: "Ancient Icon", year: -500 }} />);
    expect(screen.getByText(/500 BCE/)).toBeTruthy();
  });

  it("formats CE years correctly", () => {
    render(<ArtCard work={{ title: "Modern Work", year: 1850 }} />);
    expect(screen.getByText(/1850 CE/)).toBeTruthy();
  });

  it("shows year 0 CE (boundary: year === 0 must display, not be hidden)", () => {
    render(<ArtCard work={{ title: "Year Zero Work", year: 0 }} />);
    expect(screen.getByText(/0 CE/)).toBeTruthy();
  });

  it("omits year display when year is null", () => {
    const { container } = render(<ArtCard work={{ title: "Undated", year: null }} />);
    expect(container.querySelector(".cx-art-card-year")).toBeNull();
  });
});
