// @vitest-environment jsdom
// VerseMirror integrates with window.CODEX_INTEL (for AI calls + canvas
// helpers) and the Intel component suite from intel.js. Tests cover:
//   1. Loading state — CODEX_INTEL.intelAI pending (never resolves).
//   2. Error state — CODEX_INTEL.intelAI rejects.
//   3. Cached-data render — data pre-seeded in localStorage.
//   4. MirrorSection collapse/expand.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { VerseMirror } from "./VerseMirror.js";
import type { MirrorWindow, VerseMirrorProps } from "./verse-mirror-window.js";
import type { MirrorData } from "./helpers.js";

type WinStub = MirrorWindow & { __intelAI?: (p: unknown) => Promise<unknown> };
function mwin(): WinStub {
  return window as unknown as WinStub;
}

// ── Minimal prop helpers ──────────────────────────────────────────────────
function baseProps(overrides: Partial<VerseMirrorProps> = {}): VerseMirrorProps {
  return {
    passage: { bookId: "rev", chapter: 1 },
    refStr: "Rev 1:1",
    verseText: "The revelation of Jesus Christ",
    verse: { n: 1 },
    onClose: () => {},
    ...overrides,
  };
}

// ── Install a simple in-memory localStorage so the component can read/write
//    cached mirror data without erroring in jsdom.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] ?? null : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

// ── Minimal IntelBanner stub (renders something testable) ─────────────────
function StubBanner({ scope }: { console?: string; scope?: string }): React.ReactElement {
  return <div data-testid="intel-banner">{scope}</div>;
}
function StubDecrypt({ text }: { text: string; className?: string; as?: string }): React.ReactElement {
  return <span>{text}</span>;
}
function StubStamp({ code }: { code: string; tone?: string }): React.ReactElement {
  return <span className="cx-intel-stamp">{code}</span>;
}
function StubBars({ value }: { value: number; label?: string; className?: string }): React.ReactElement {
  return <span data-testid="intel-bars">{value}</span>;
}
function StubTicker({ items }: { items: string[] }): React.ReactElement {
  return <div data-testid="intel-ticker">{items[0] ?? ""}</div>;
}

beforeEach(() => {
  installStorage();
  localStorage.clear();

  // Install Intel component stubs
  mwin().IntelBanner = StubBanner as unknown as MirrorWindow["IntelBanner"];
  mwin().IntelDecrypt = StubDecrypt as unknown as MirrorWindow["IntelDecrypt"];
  mwin().IntelStamp = StubStamp as unknown as MirrorWindow["IntelStamp"];
  mwin().IntelBars = StubBars as unknown as MirrorWindow["IntelBars"];
  mwin().IntelTicker = StubTicker as unknown as MirrorWindow["IntelTicker"];

  // Default CODEX_INTEL: intelAI that never resolves (hold in loading state)
  mwin().CODEX_INTEL = {
    intelAI: () => new Promise<never>(() => {}),
    intelFmtYear: (y) => (y == null ? "—" : `${Math.abs(y)} ${y < 0 ? "BCE" : "CE"}`),
    intelReducedMotion: () => true, // skip RAF animation in tests
    intelCanvas: {
      fit: () => ({ w: 400, h: 200 }),
      arc: () => {},
      node: () => 5,
      accent: () => "#7cf",
    },
  };
});

describe("VerseMirror — loading state", () => {
  it("renders the loading spinner text and epigraph while intelAI is pending", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("CORRELATING · HISTORY · SIGNALS · PROPHECY")).toBeTruthy();
    expect(screen.getByText(/sweeping 3,000 years/)).toBeTruthy();
    expect(screen.getByText(/Heb 4:12/)).toBeTruthy();
  });

  it("renders the refStr in the header", () => {
    render(<VerseMirror {...baseProps({ refStr: "John 3:16" })} />);
    expect(screen.getByText("John 3:16")).toBeTruthy();
  });

  it("renders the CODEX · MIRROR tag", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("CODEX · MIRROR")).toBeTruthy();
  });

  it("renders the IntelBanner with PATTERN ANALYSIS scope", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByTestId("intel-banner")).toBeTruthy();
    expect(screen.getByText("PATTERN ANALYSIS")).toBeTruthy();
  });

  it("the close button is present", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByTitle("Close (ESC)")).toBeTruthy();
  });
});

describe("VerseMirror — error state", () => {
  it("shows MIRROR ORACLE OFFLINE on intelAI rejection", async () => {
    mwin().CODEX_INTEL!.intelAI = () =>
      Promise.reject(new Error("API key not set"));

    render(<VerseMirror {...baseProps()} />);
    await waitFor(() => screen.getByText("MIRROR ORACLE OFFLINE"));
    expect(screen.getByText("API key not set")).toBeTruthy();
  });

  it("shows the credential hint for auth-like error messages", async () => {
    mwin().CODEX_INTEL!.intelAI = () =>
      Promise.reject(new Error("401 unauthorized — api key missing"));

    render(<VerseMirror {...baseProps()} />);
    await waitFor(() =>
      screen.getByText(/Add an AI provider API key/),
    );
  });
});

describe("VerseMirror — cached data render", () => {
  const CACHE_KEY = "codex.mirrors.rev.1.1";

  const MOCK_DATA: MirrorData = {
    _schema: 2,
    theme: "divine unveiling",
    summary: "The book opens with a disclosure of eschatological realities.",
    pattern: "A cosmic figure commissions a witness at the boundary of history.",
    verseYear: 95,
    historicalParallels: [
      {
        era: "1st cent. CE",
        year: 70,
        event: "Destruction of Jerusalem",
        place: "Jerusalem",
        lat: 31.78,
        lng: 35.22,
        intensity: 80,
        connection: "The fall of the Temple is the backdrop for Revelation's composition.",
        wiki: "Siege_of_Jerusalem_(70_CE)",
      },
    ],
    modernResonances: [
      {
        year: 2001,
        event: "September 11 attacks",
        place: "New York",
        lat: 40.71,
        lng: -74.01,
        intensity: 55,
        contested: true,
        connection: "Some commentators drew parallels to apocalyptic imagery.",
        wiki: "September_11_attacks",
      },
    ],
    propheticReadings: [
      {
        tradition: "Preterist",
        interpretation: "The vision addresses first-century Roman persecution.",
        keyVoice: "Kenneth Gentry",
      },
    ],
    crossReferences: [
      { ref: "Daniel 7:13", note: "The Son of Man coming on clouds." },
    ],
    caveats: ["Dating of Revelation is debated; 65-96 CE range is standard."],
  };

  beforeEach(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(MOCK_DATA));
  });

  it("renders the theme in the header when data is cached", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText(/divine unveiling/)).toBeTruthy();
  });

  it("renders the summary paragraph", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText(/The book opens with a disclosure/)).toBeTruthy();
  });

  it("renders the PATTERN LOCK section with the pattern text", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("PATTERN LOCK")).toBeTruthy();
    expect(screen.getByText(/A cosmic figure commissions/)).toBeTruthy();
  });

  it("renders count badges for all sections", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("01 HISTORICAL")).toBeTruthy();
    expect(screen.getByText("01 MODERN")).toBeTruthy();
    expect(screen.getByText("01 TRADITIONS")).toBeTruthy();
    expect(screen.getByText("01 XREFS")).toBeTruthy();
  });

  it("renders the historical parallel's event name", () => {
    render(<VerseMirror {...baseProps()} />);
    // The event name appears in the dossier link and in the ticker — use getAllByText
    const elements = screen.getAllByText(/Destruction of Jerusalem/);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a Wikipedia link for the historical event", () => {
    render(<VerseMirror {...baseProps()} />);
    const link = screen.getByText(/Destruction of Jerusalem ↗/);
    expect(link.getAttribute("href")).toContain("Siege_of_Jerusalem");
  });

  it("renders the CONTESTED stamp on the modern resonance", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("CONTESTED")).toBeTruthy();
  });

  it("renders the prophetic tradition and keyVoice", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("Preterist")).toBeTruthy();
    expect(screen.getByText("Kenneth Gentry")).toBeTruthy();
  });

  it("renders the cross-reference", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText("Daniel 7:13")).toBeTruthy();
    expect(screen.getByText("The Son of Man coming on clouds.")).toBeTruthy();
  });

  it("renders the caveat", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText(/Dating of Revelation/)).toBeTruthy();
  });

  it("renders the geo hint when events have coordinates", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByText(/these events carry coordinates/)).toBeTruthy();
  });

  it("renders the IntelTicker with event text", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByTestId("intel-ticker")).toBeTruthy();
  });

  it("renders the re-analyze button when data is loaded", () => {
    render(<VerseMirror {...baseProps()} />);
    expect(screen.getByTitle("Re-analyze this verse")).toBeTruthy();
  });
});

describe("MirrorSection — collapsible", () => {
  const CACHE_KEY = "codex.mirrors.rev.1.1";

  beforeEach(() => {
    const data: MirrorData = {
      _schema: 2,
      caveats: ["A scholarly caveat about genre."],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  });

  it("collapses a section on header click and expands again", () => {
    render(<VerseMirror {...baseProps()} />);
    const header = screen.getByTitle("Collapse");
    // initially open — content is visible
    expect(screen.getByText("A scholarly caveat about genre.")).toBeTruthy();
    fireEvent.click(header);
    // content hidden after collapse
    expect(screen.queryByText("A scholarly caveat about genre.")).toBeNull();
    fireEvent.click(header);
    // content visible again after expand
    expect(screen.getByText("A scholarly caveat about genre.")).toBeTruthy();
  });
});
