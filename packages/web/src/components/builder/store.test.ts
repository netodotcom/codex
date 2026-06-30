// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LS_KEY, uid, loadStore, saveStore, makeEmptyStudy, importStudyObject, type StudyStore } from "./store.js";

// The test runner's global localStorage is node's broken experimental shim;
// stub a real in-memory Storage so the store helpers behave like a browser.
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

describe("uid", () => {
  it("mints a prefixed, reasonably-unique id", () => {
    const a = uid("study");
    const b = uid("study");
    expect(a.startsWith("study-")).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("loadStore / saveStore (ground truth)", () => {
  it("returns the empty store when nothing is persisted", () => {
    expect(loadStore()).toEqual({ studies: [], activeStudyId: null });
  });
  it("returns the empty store on malformed JSON", () => {
    localStorage.setItem(LS_KEY, "{not json");
    expect(loadStore()).toEqual({ studies: [], activeStudyId: null });
  });
  it("returns the empty store when studies is not an array", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ studies: "nope", activeStudyId: null }));
    expect(loadStore()).toEqual({ studies: [], activeStudyId: null });
  });
  it("round-trips a saved store", () => {
    const s: StudyStore = { studies: [makeEmptyStudy("X")], activeStudyId: "abc" };
    saveStore(s);
    expect(loadStore()).toEqual(s);
  });
});

describe("makeEmptyStudy (ground truth)", () => {
  it("uses the given title and seeds one 'I. ' section", () => {
    const st = makeEmptyStudy("Sermon");
    expect(st.title).toBe("Sermon");
    expect(st.sections.length).toBe(1);
    expect(st.sections[0]!.heading).toBe("I. ");
    expect(st.sections[0]!.items).toEqual([]);
    expect(st.created).toBe(st.modified);
  });
  it("falls back to 'Untitled study' for empty title", () => {
    expect(makeEmptyStudy().title).toBe("Untitled study");
    expect(makeEmptyStudy("").title).toBe("Untitled study");
  });
});

describe("importStudyObject (ground truth)", () => {
  it("rejects non-study objects", () => {
    expect(importStudyObject(null)).toBe(false);
    expect(importStudyObject({})).toBe(false);
    expect(importStudyObject({ sections: "x" })).toBe(false);
    expect(importStudyObject(5)).toBe(false);
  });
  it("imports, re-ids, activates, and fires codex:studies-changed", () => {
    let fired = 0;
    const h = (): void => {
      fired++;
    };
    window.addEventListener("codex:studies-changed", h);
    const ok = importStudyObject({
      id: "OLD",
      title: "Imported",
      sections: [{ id: "OLDSEC", heading: "I.", items: [{ type: "note", body: "n" }] }],
    });
    window.removeEventListener("codex:studies-changed", h);

    expect(ok).toBe(true);
    expect(fired).toBe(1);
    const store = loadStore();
    expect(store.studies.length).toBe(1);
    const study = store.studies[0]!;
    expect(study.title).toBe("Imported");
    expect(study.id).not.toBe("OLD"); // re-ided
    expect(store.activeStudyId).toBe(study.id);
    expect(study.sections[0]!.id).not.toBe("OLDSEC"); // re-ided
    expect(study.sections[0]!.heading).toBe("I.");
    expect(study.sections[0]!.items).toEqual([{ type: "note", body: "n" }]);
  });
  it("defaults a missing section heading to '' and non-array items to []", () => {
    importStudyObject({ sections: [{ items: "bad" }] });
    const study = loadStore().studies[0]!;
    expect(study.sections[0]!.heading).toBe("");
    expect(study.sections[0]!.items).toEqual([]);
  });
});
