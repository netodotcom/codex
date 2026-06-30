// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { lib2SourceLight } from "./helpers.js";
import type { Library2Window, Lib2Book } from "./library2-window.js";

const tw = (): Library2Window => window as unknown as Library2Window;

const OT_BOOK: Lib2Book = { id: "gen", name: "Genesis", testament: "OT", chapters: 50 };
const NT_BOOK: Lib2Book = { id: "jhn", name: "John", testament: "NT", chapters: 21 };
const DC_BOOK: Lib2Book = { id: "tob", name: "Tobit", testament: "DC", canon: "deuterocanon", chapters: 14 };

beforeEach(() => {
  tw().CODEX_DATA = undefined;
});

describe("lib2SourceLight — no translations loaded", () => {
  it("returns 'none' for OT book when CODEX_DATA is absent", () => {
    expect(lib2SourceLight(OT_BOOK, "web")).toBe("none");
  });
  it("returns 'none' for NT book when CODEX_DATA is absent", () => {
    expect(lib2SourceLight(NT_BOOK, "web")).toBe("none");
  });
  it("returns 'none' for DC book when CODEX_DATA is absent", () => {
    expect(lib2SourceLight(DC_BOOK, "nrsv")).toBe("none");
  });
});

describe("lib2SourceLight — own (primary translation covers the book)", () => {
  it("returns 'own' for OT book when primary has protestant canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "web", canons: ["protestant"] }],
    };
    expect(lib2SourceLight(OT_BOOK, "web")).toBe("own");
  });

  it("returns 'own' for OT book when primary has ot canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "lxx", canons: ["ot"] }],
    };
    expect(lib2SourceLight(OT_BOOK, "lxx")).toBe("own");
  });

  it("returns 'own' for NT book when primary has protestant canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "web", canons: ["protestant"] }],
    };
    expect(lib2SourceLight(NT_BOOK, "web")).toBe("own");
  });

  it("returns 'own' for NT book when primary has nt canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "nt-only", canons: ["nt"] }],
    };
    expect(lib2SourceLight(NT_BOOK, "nt-only")).toBe("own");
  });

  it("returns 'own' for DC book when primary covers its specific canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "nrsv", canons: ["protestant", "deuterocanon"] }],
    };
    expect(lib2SourceLight(DC_BOOK, "nrsv")).toBe("own");
  });
});

describe("lib2SourceLight — other (a different translation covers the book)", () => {
  it("returns 'other' for OT book when only another translation has protestant", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [
        { id: "kjv", canons: ["protestant"] },
        { id: "myT", canons: ["ot"] },
      ],
    };
    // primary "web" is not in the list → should find "kjv" covers OT
    expect(lib2SourceLight(OT_BOOK, "web")).toBe("other");
  });

  it("returns 'other' for DC book when another translation covers its canon", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [
        { id: "kjv", canons: ["protestant"] },
        { id: "nrsv", canons: ["protestant", "deuterocanon"] },
      ],
    };
    // primary "kjv" doesn't cover deuterocanon; "nrsv" does
    expect(lib2SourceLight(DC_BOOK, "kjv")).toBe("other");
  });
});

describe("lib2SourceLight — protestant default canon", () => {
  it("defaults to protestant when translation has no canons array", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "web" }],
    };
    // no canons → defaults to ["protestant"] → covers OT
    expect(lib2SourceLight(OT_BOOK, "web")).toBe("own");
  });

  it("defaults to protestant when translation has empty canons array", () => {
    tw().CODEX_DATA = {
      books: [],
      translations: [{ id: "web", canons: [] }],
    };
    expect(lib2SourceLight(OT_BOOK, "web")).toBe("own");
  });
});
