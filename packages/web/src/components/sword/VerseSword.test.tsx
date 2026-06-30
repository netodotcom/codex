// @vitest-environment jsdom
// VerseSword integrates with window.CODEX_INTEL (AI calls + canvas helpers)
// and the Intel component suite from intel.js. Tests cover:
//   1. Loading state  — CODEX_INTEL.intelAI never resolves.
//   2. Error state    — CODEX_INTEL.intelAI rejects.
//   3. Cached render  — data pre-seeded in localStorage (intelAI never called).
//   4. Close button   — clicking × calls onClose.
//   5. ESC key        — Escape keydown calls onClose.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { VerseSword } from "./VerseSword.js";
import type { SwordWindow, VerseSwordProps, SwordData } from "./sword-window.js";

function swin(): SwordWindow {
  return window as unknown as SwordWindow;
}

function baseProps(overrides: Partial<VerseSwordProps> = {}): VerseSwordProps {
  return {
    passage: { bookId: "heb", chapter: 4 },
    refStr: "Heb 4:12",
    verseText: "For the word of God is living and active",
    verse: { n: 12 },
    onClose: () => {},
    ...overrides,
  };
}

// ── In-memory localStorage so the component can read/write cache in jsdom ──
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] ?? null) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

// ── Minimal Intel component stubs ─────────────────────────────────────────
function StubBanner({ scope }: { console?: string; scope?: string; note?: string }): React.ReactElement {
  return <div data-testid="intel-banner">{scope}</div>;
}
function StubDecrypt({ text }: { text: string; className?: string; as?: string }): React.ReactElement {
  return <span data-testid="intel-decrypt">{text}</span>;
}
function StubStamp({ code }: { code: string; tone?: string; className?: string }): React.ReactElement {
  return <span className="cx-intel-stamp" data-testid="intel-stamp">{code}</span>;
}

beforeEach(() => {
  installStorage();
  localStorage.clear();

  // Install Intel component stubs
  swin().IntelBanner = StubBanner as unknown as SwordWindow["IntelBanner"];
  swin().IntelDecrypt = StubDecrypt as unknown as SwordWindow["IntelDecrypt"];
  swin().IntelStamp = StubStamp as unknown as SwordWindow["IntelStamp"];

  // Default CODEX_INTEL: intelAI never resolves → component stays in loading state.
  swin().CODEX_INTEL = {
    intelAI: (): Promise<never> => new Promise<never>(() => {}),
    intelReducedMotion: (): boolean => true, // skip RAF animation in tests
    intelCanvas: {
      fit: (canvas: HTMLCanvasElement): { w: number; h: number } => ({
        w: canvas.width || 300,
        h: canvas.height || 150,
      }),
    },
  };
});

// ── Minimal four-stratum fixture ──────────────────────────────────────────
const sampleData: SwordData = {
  theme: "The Word as living blade",
  edge: "Soul from spirit, joints from marrow",
  original: {
    lang: "greek",
    text: "Ζῶν γὰρ ὁ λόγος τοῦ θεοῦ",
    translit: "Zon gar ho logos tou theou",
    keyTerm: "λόγος",
    keyTermTranslit: "logos",
    keyTermGloss: "word, reason",
  },
  strata: [
    {
      depth: 1,
      pardesName: "Peshat",
      pardesGloss: "plain",
      quadrigaName: "Littera",
      quadrigaGloss: "literal",
      pardes: "Plain reading of the text.",
      quadriga: "Literal Christian reception.",
      voicesPardes: "Rashi",
      voicesQuadriga: "Origen",
      refs: [{ ref: "Heb 4:12", note: "the source verse" }],
      converge: "Both traditions read this as a direct divine claim.",
    },
    {
      depth: 2,
      pardesName: "Remez",
      pardesGloss: "hint",
      quadrigaName: "Allegoria",
      quadrigaGloss: "typological",
      pardes: "Hint toward the messianic.",
      quadriga: "Typological reading.",
      voicesPardes: "Ibn Ezra",
      voicesQuadriga: "Aquinas, ST I",
      refs: [],
      converge: "Both see a prefiguring.",
    },
    {
      depth: 3,
      pardesName: "Drash",
      pardesGloss: "inquiry",
      quadrigaName: "Moralis",
      quadrigaGloss: "tropological",
      pardes: "Moral inquiry for the community.",
      quadriga: "Moral application to the soul.",
      voicesPardes: "Talmudic tradition",
      voicesQuadriga: "Bernard of Clairvaux",
      refs: [],
      converge: "Both focus on conscience.",
    },
    {
      depth: 4,
      pardesName: "Sod",
      pardesGloss: "secret",
      quadrigaName: "Anagogia",
      quadrigaGloss: "anagogical",
      pardes: "Mystical reading (Zohar tradition).",
      quadriga: "Anagogical vision of the beatific.",
      voicesPardes: "Lurianic kabbalists",
      voicesQuadriga: "Dante",
      refs: [],
      converge: "Both point toward the eschaton.",
    },
  ],
  caveats: ["This fourfold schema is a medieval systematization."],
};

describe("VerseSword", () => {
  it("renders the loading state while intelAI is pending", () => {
    render(<VerseSword {...baseProps()} />);
    expect(screen.getByText("DRAWING · PESHAT · REMEZ · DRASH · SOD")).toBeTruthy();
    expect(screen.getByText(/setting the edge against Heb 4:12/)).toBeTruthy();
  });

  it("renders the error state when intelAI rejects", async () => {
    swin().CODEX_INTEL = {
      intelAI: (): Promise<never> => Promise.reject(new Error("API unavailable")),
      intelReducedMotion: (): boolean => true,
      intelCanvas: { fit: (): { w: number; h: number } => ({ w: 300, h: 150 }) },
    };
    render(<VerseSword {...baseProps()} />);
    expect(await screen.findByText("THE BLADE IS SHEATHED")).toBeTruthy();
    expect(screen.getByText("API unavailable")).toBeTruthy();
  });

  it("renders cached data from localStorage without calling intelAI", () => {
    localStorage.setItem("codex.swords.heb.4.12", JSON.stringify(sampleData));
    const spy = vi.fn((): Promise<never> => new Promise<never>(() => {}));
    swin().CODEX_INTEL = {
      intelAI: spy,
      intelReducedMotion: (): boolean => true,
      intelCanvas: { fit: (): { w: number; h: number } => ({ w: 300, h: 150 }) },
    };
    render(<VerseSword {...baseProps()} />);
    // Should NOT be in loading state
    expect(screen.queryByText("DRAWING · PESHAT · REMEZ · DRASH · SOD")).toBeNull();
    // Theme appears in header
    expect(screen.getByText(/The Word as living blade/)).toBeTruthy();
    // RE-FORGE button appears
    expect(screen.getByTitle(/Re-forge/)).toBeTruthy();
    // The intel AI should not have been called
    expect(spy).not.toHaveBeenCalled();
  });

  it("renders all four strata from cached data", () => {
    localStorage.setItem("codex.swords.heb.4.12", JSON.stringify(sampleData));
    render(<VerseSword {...baseProps()} />);
    // Each stratum's PaRDeS name should be visible
    expect(screen.getByText(/Peshat/)).toBeTruthy();
    expect(screen.getByText(/Remez/)).toBeTruthy();
    expect(screen.getByText(/Drash/)).toBeTruthy();
    expect(screen.getByText(/Sod/)).toBeTruthy();
    // The caveats section renders
    expect(screen.getByText(/medieval systematization/)).toBeTruthy();
  });

  it("renders the IntelBanner with correct props", () => {
    render(<VerseSword {...baseProps()} />);
    expect(screen.getByTestId("intel-banner")).toBeTruthy();
    expect(screen.getByText("FOURFOLD EDGE")).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<VerseSword {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<VerseSword {...baseProps({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when a non-Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<VerseSword {...baseProps({ onClose })} />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the verse text in the body blockquote from cached data", () => {
    localStorage.setItem("codex.swords.heb.4.12", JSON.stringify(sampleData));
    render(<VerseSword {...baseProps()} />);
    expect(screen.getByText("For the word of God is living and active")).toBeTruthy();
  });

  it("renders the IntelDecrypt stub for the edge when data is loaded", () => {
    localStorage.setItem("codex.swords.heb.4.12", JSON.stringify(sampleData));
    render(<VerseSword {...baseProps()} />);
    expect(screen.getByTestId("intel-decrypt")).toBeTruthy();
    expect(screen.getByText("Soul from spirit, joints from marrow")).toBeTruthy();
  });

  it("renders IntelStamp stubs for each stratum", () => {
    localStorage.setItem("codex.swords.heb.4.12", JSON.stringify(sampleData));
    render(<VerseSword {...baseProps()} />);
    const stamps = screen.getAllByTestId("intel-stamp");
    expect(stamps.length).toBe(4);
    expect(stamps[0]?.textContent).toBe("S-1");
    expect(stamps[3]?.textContent).toBe("S-4");
  });
});
