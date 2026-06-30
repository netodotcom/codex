// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BuilderPanel } from "./BuilderPanel.js";
import { LS_KEY, loadStore } from "./store.js";

type WinData = { CODEX_DATA?: { books?: Array<{ id?: string; name?: string }> } };

// The runner's global localStorage shim is broken; stub a real in-memory one.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  (window as unknown as WinData).CODEX_DATA = undefined;
});

describe("BuilderPanel", () => {
  it("renders the empty state when there are no studies", () => {
    render(<BuilderPanel />);
    expect(screen.getByText(/No studies yet/)).toBeTruthy();
    expect(screen.getByText(/Drop a/)).toBeTruthy();
  });

  it("creates a new study, shows its editor, and persists it", () => {
    render(<BuilderPanel />);
    fireEvent.click(screen.getByTitle("New study"));

    const title = screen.getByPlaceholderText("Study title") as HTMLInputElement;
    expect(title.value).toBe("Study 1");
    const heading = screen.getByPlaceholderText("Section heading") as HTMLInputElement;
    expect(heading.value).toBe("I. "); // makeEmptyStudy seeds one section

    const store = loadStore();
    expect(store.studies.length).toBe(1);
    expect(store.activeStudyId).toBe(store.studies[0]!.id);
  });

  it("adds a note item with the default body", () => {
    render(<BuilderPanel />);
    fireEvent.click(screen.getByTitle("New study"));
    fireEvent.click(screen.getByText("+ Note"));
    const note = screen.getByPlaceholderText("Note…") as HTMLTextAreaElement;
    expect(note.value).toBe("New note — click to edit");
    // persisted as a note item
    const active = loadStore().studies[0]!;
    expect(active.sections[0]!.items[0]).toMatchObject({ type: "note", body: "New note — click to edit" });
  });

  it("appends a section with the next roman-numeral heading", () => {
    render(<BuilderPanel />);
    fireEvent.click(screen.getByTitle("New study"));
    fireEvent.click(screen.getByText("+ Section"));
    const headings = screen.getAllByPlaceholderText("Section heading") as HTMLInputElement[];
    expect(headings.map((h) => h.value)).toEqual(["I. ", "II. "]);
  });

  it("renders a verse item using the friendly book name from CODEX_DATA", () => {
    (window as unknown as WinData).CODEX_DATA = { books: [{ id: "gen", name: "Genesis" }] };
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        studies: [
          {
            id: "s",
            title: "T",
            created: 1,
            modified: 1,
            sections: [{ id: "sec", heading: "I.", items: [{ type: "verse", ref: "gen.1.1", text: "In the beginning", translation: "kjv", _id: "i1" }] }],
          },
        ],
        activeStudyId: "s",
      }),
    );
    render(<BuilderPanel />);
    expect(screen.getByText("Genesis 1:1")).toBeTruthy();
    expect(screen.getByText("KJV")).toBeTruthy();
    expect(screen.getByText("In the beginning")).toBeTruthy();
  });
});
