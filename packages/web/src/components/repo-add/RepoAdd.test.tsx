// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { RepoAdd } from "./RepoAdd.js";

// ── localStorage mock ─────────────────────────────────────────────────────────
// The runner's global localStorage shim is broken; install a real in-memory one.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

type WindowWithData = Window & {
  CODEX_DATA?: { translations: Array<{ id: string; [key: string]: unknown }> };
};

const w = (): WindowWithData => window as unknown as WindowWithData;

beforeEach(() => {
  installStorage();
  w().CODEX_DATA = { translations: [] };
});

describe("RepoAdd component", () => {
  it("renders the toggle button in closed state", () => {
    render(<RepoAdd />);
    expect(screen.getByText("+ add a corpus")).toBeTruthy();
  });

  it("does not render the panel when closed", () => {
    render(<RepoAdd />);
    expect(screen.queryByPlaceholderText("Search · niv, septuagint, msg…")).toBeNull();
  });

  it("expands to show the panel when the toggle is clicked", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    expect(screen.getByText("× close")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search · niv, septuagint, msg…")).toBeTruthy();
  });

  it("shows both provider buttons", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    expect(screen.getByText("bolls")).toBeTruthy();
    expect(screen.getByText("bible-api")).toBeTruthy();
  });

  it("marks the bolls provider as active by default", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    const bollsBtn = screen.getByText("bolls");
    expect(bollsBtn.className).toContain("is-on");
    const bibleApiBtn = screen.getByText("bible-api");
    expect(bibleApiBtn.className).not.toContain("is-on");
  });

  it("switches the active provider when clicked", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.click(screen.getByText("bible-api"));
    expect(screen.getByText("bible-api").className).toContain("is-on");
    expect(screen.getByText("bolls").className).not.toContain("is-on");
  });

  it("filters results by search query (ground truth: esv match)", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.change(screen.getByPlaceholderText("Search · niv, septuagint, msg…"), {
      target: { value: "esv" },
    });
    expect(screen.getByText("English Standard")).toBeTruthy();
    // Other bolls entries should be filtered out
    expect(screen.queryByText("New International")).toBeNull();
  });

  it("filters by name case-insensitively — septuagint", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.change(screen.getByPlaceholderText("Search · niv, septuagint, msg…"), {
      target: { value: "septuagint" },
    });
    expect(screen.getByText("Septuagint (Greek)")).toBeTruthy();
  });

  it("shows empty message when no results match", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.change(screen.getByPlaceholderText("Search · niv, septuagint, msg…"), {
      target: { value: "xyzzy-not-a-real-bible" },
    });
    expect(screen.getByText(/no match in catalog/)).toBeTruthy();
  });

  it("excludes already-added translations from the results", () => {
    w().CODEX_DATA = { translations: [{ id: "esv" }] };
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.change(screen.getByPlaceholderText("Search · niv, septuagint, msg…"), {
      target: { value: "esv" },
    });
    expect(screen.queryByText("English Standard")).toBeNull();
  });

  it("renders the offline hint paragraph", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    expect(screen.getByText(/Repos cache locally/)).toBeTruthy();
  });

  it("toggles closed when '× close' is clicked", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.click(screen.getByText("× close"));
    expect(screen.getByText("+ add a corpus")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search · niv, septuagint, msg…")).toBeNull();
  });

  it("applies is-open class to the root div when open", () => {
    const { container } = render(<RepoAdd />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("is-open");
    fireEvent.click(screen.getByText("+ add a corpus"));
    expect(root.className).toContain("is-open");
  });

  it("shows bible-api provider entries when that provider is selected", () => {
    render(<RepoAdd />);
    fireEvent.click(screen.getByText("+ add a corpus"));
    fireEvent.click(screen.getByText("bible-api"));
    expect(screen.getByText("Basic English")).toBeTruthy();
  });
});
