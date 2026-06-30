// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LibraryX } from "./LibraryX.js";
import type { Library2Window, Lib2Data } from "./library2-window.js";

const tw = (): Library2Window => window as unknown as Library2Window;

const MOCK_DATA: Lib2Data = {
  books: [
    { id: "gen", name: "Genesis", testament: "OT", chapters: 50 },
    { id: "jhn", name: "John", testament: "NT", chapters: 21 },
    { id: "tob", name: "Tobit", testament: "DC", canon: "deuterocanon", chapters: 14 },
  ],
  translations: [{ id: "web", canons: ["protestant"] }],
  tweaks: { primaryTranslation: "web" },
};

beforeEach(() => {
  tw().CODEX_DATA = structuredClone(MOCK_DATA);
  tw().CODEX_NOW = undefined;
  tw().CODEX_SEARCH = undefined;
  tw().codexGoto = undefined;
  tw().codexJumpToRef = undefined;
  tw().CODEX_PLUGINS_API = undefined;
});

describe("LibraryX — main render", () => {
  it("renders the root .cxl container", () => {
    const { container } = render(<LibraryX />);
    expect(container.querySelector(".cxl")).not.toBeNull();
  });

  it("renders the search input with correct placeholder and aria-label", () => {
    render(<LibraryX />);
    const input = screen.getByRole("textbox");
    expect((input as HTMLInputElement).placeholder).toBe("Book · 'John 3:16' · any words…");
    expect(input.getAttribute("aria-label")).toBe(
      "Search the shelves — book, reference, or text",
    );
  });

  it("renders the footer source legend", () => {
    render(<LibraryX />);
    const footer = document.querySelector(".cxl-foot");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain("● in WEB");
    expect(footer!.textContent).toContain("◐ other corpus");
    expect(footer!.textContent).toContain("○ no source");
  });

  it("renders OT and NT shelves when data is present", () => {
    render(<LibraryX />);
    expect(screen.getByText("The Old Testament")).toBeTruthy();
    expect(screen.getByText("The New Testament")).toBeTruthy();
    // Genesis and John should appear
    expect(screen.getByText("Genesis")).toBeTruthy();
    expect(screen.getByText("John")).toBeTruthy();
  });

  it("renders a DC shelf when DC books are present", () => {
    render(<LibraryX />);
    expect(screen.getByText("Apocrypha · Deuterocanon")).toBeTruthy();
    expect(screen.getByText("Tobit")).toBeTruthy();
  });
});

describe("LibraryX — search input clears on Escape", () => {
  it("shows the clear button when query is non-empty, clears on click", () => {
    render(<LibraryX />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gen" } });
    expect(input.value).toBe("gen");
    const clearBtn = screen.getByLabelText("Clear");
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(input.value).toBe("");
  });

  it("clears query on Escape", () => {
    render(<LibraryX />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "john" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });
});

describe("LibraryX — book open/close toggle", () => {
  it("expands a book to show chapter grid on click", () => {
    render(<LibraryX />);
    // Click the Genesis row button
    const genesisBtn = screen.getByRole("button", { name: /Genesis/i });
    fireEvent.click(genesisBtn);
    // Chapter 1 button should now be visible
    const ch1 = screen.getAllByRole("button").find(
      (b) => b.className.includes("cxl-ch") && b.textContent === "1",
    );
    expect(ch1).toBeTruthy();
  });

  it("collapses the book on second click", () => {
    render(<LibraryX />);
    const genesisBtn = screen.getByRole("button", { name: /Genesis/i });
    fireEvent.click(genesisBtn);
    fireEvent.click(genesisBtn);
    // chapter grid should be gone
    const ch1 = screen.queryAllByRole("button").find(
      (b) => b.className.includes("cxl-ch") && b.textContent === "1",
    );
    expect(ch1).toBeUndefined();
  });
});

describe("LibraryX — chapter navigation", () => {
  it("calls codexGoto when a chapter button is clicked", () => {
    const goto = vi.fn();
    tw().codexGoto = goto;
    render(<LibraryX />);
    // Open Genesis
    const genesisBtn = screen.getByRole("button", { name: /Genesis/i });
    fireEvent.click(genesisBtn);
    // Click chapter 3
    const ch3 = screen.getAllByRole("button").find(
      (b) => b.className.includes("cxl-ch") && b.textContent === "3",
    );
    expect(ch3).toBeTruthy();
    fireEvent.click(ch3!);
    expect(goto).toHaveBeenCalledWith("gen", 3, 1);
  });

  it("falls back to codexJumpToRef when codexGoto is absent", () => {
    const jumpToRef = vi.fn();
    tw().codexJumpToRef = jumpToRef;
    render(<LibraryX />);
    const genesisBtn = screen.getByRole("button", { name: /Genesis/i });
    fireEvent.click(genesisBtn);
    const ch1 = screen.getAllByRole("button").find(
      (b) => b.className.includes("cxl-ch") && b.textContent === "1",
    );
    fireEvent.click(ch1!);
    expect(jumpToRef).toHaveBeenCalledWith("Genesis 1");
  });
});

describe("LibraryX — search filtering", () => {
  it("filters books by query, hiding non-matching shelves", () => {
    render(<LibraryX />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "john" } });
    // Genesis should disappear
    expect(screen.queryByText("Genesis")).toBeNull();
    // John should remain
    expect(screen.getByText("John")).toBeTruthy();
  });

  it("shows all books when query is cleared", () => {
    render(<LibraryX />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "john" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Genesis")).toBeTruthy();
    expect(screen.getByText("John")).toBeTruthy();
  });
});

describe("LibraryX — reference jump", () => {
  it("shows jump button and calls codexGoto on Enter when a ref is typed", () => {
    const goto = vi.fn();
    tw().codexGoto = goto;
    render(<LibraryX />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "john 3" } });
    // jump button should appear
    const jumpBtn = document.querySelector(".cxl-jump");
    expect(jumpBtn).not.toBeNull();
    expect(jumpBtn!.textContent).toContain("JOHN");
    // press Enter
    fireEvent.keyDown(input, { key: "Enter" });
    expect(goto).toHaveBeenCalledWith("jhn", 3, 1);
    // query cleared after jump
    expect(input.value).toBe("");
  });

  it("calls codexJumpToRef with verse when ref includes verse", () => {
    const jumpToRef = vi.fn();
    tw().codexJumpToRef = jumpToRef;
    render(<LibraryX />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "john 3:16" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(jumpToRef).toHaveBeenCalledWith("John 3:16");
  });
});

describe("LibraryX — empty state (no data)", () => {
  it("renders without crashing when CODEX_DATA is undefined", () => {
    tw().CODEX_DATA = undefined;
    const { container } = render(<LibraryX />);
    expect(container.querySelector(".cxl")).not.toBeNull();
    // no shelves when there are no books
    expect(container.querySelectorAll(".cxl-shelf").length).toBe(0);
  });
});
