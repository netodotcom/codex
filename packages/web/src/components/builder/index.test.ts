// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadStore } from "./store.js";

interface StudyBuilderApi {
  addItem: (item: unknown) => void;
  importStudy: (studyObj: unknown) => boolean;
  studyToMarkdown: (study: unknown) => string;
}

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
});

describe("builder index — module-load side effects", () => {
  it("exposes window.CODEX_StudyBuilder and wires the codex:add-to-study listener", async () => {
    await import("./index.js"); // runs the IIFE-equivalent side effects once

    const api = (window as unknown as { CODEX_StudyBuilder?: StudyBuilderApi }).CODEX_StudyBuilder;
    expect(api).toBeTruthy();
    expect(typeof api!.addItem).toBe("function");
    expect(typeof api!.importStudy).toBe("function");
    expect(typeof api!.studyToMarkdown).toBe("function");

    // The module-level listener appends to (and creates) the active study.
    window.dispatchEvent(new CustomEvent("codex:add-to-study", { detail: { type: "note", body: "first" } }));
    let store = loadStore();
    expect(store.studies.length).toBe(1);
    const sid = store.activeStudyId;
    expect(sid).toBeTruthy();

    // addItem() dispatches the same event → appends to the same active study.
    api!.addItem({ type: "note", body: "second" });
    store = loadStore();
    expect(store.studies.length).toBe(1);
    const active = store.studies.find((s) => s.id === store.activeStudyId)!;
    const last = active.sections[active.sections.length - 1]!;
    expect(last.items.map((i) => i.body)).toEqual(["first", "second"]);
  });

  it("CODEX_StudyBuilder.studyToMarkdown renders a study heading", async () => {
    await import("./index.js"); // cached; ensures the global is present regardless of order
    const { CODEX_StudyBuilder } = window as unknown as { CODEX_StudyBuilder: StudyBuilderApi };
    const md = CODEX_StudyBuilder.studyToMarkdown({ title: "Doctrine", sections: [] });
    expect(md.startsWith("# Doctrine")).toBe(true);
  });
});
