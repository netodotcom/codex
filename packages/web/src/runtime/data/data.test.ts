// @vitest-environment jsdom
// data — faithful-port tests. Expectations are derived directly from
// legacy/data.js; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll } from "vitest";
import { BOOKS, TRANSLATIONS, DEFAULT_PASSAGE, SEED_PANELS } from "./helpers.js";
import { dw } from "./data-window.js";

// Import the entry point to assign window.CODEX_DATA (mirrors runtime boot).
beforeAll(async () => {
  await import("./index.js");
});

// ── Parity probe — window contract ────────────────────────────────────────────

describe("window.CODEX_DATA", () => {
  it("is set as an object on window (typeof check matches parity probe)", () => {
    expect(typeof dw().CODEX_DATA).toBe("object");
  });

  it("has the four top-level keys", () => {
    const d = dw().CODEX_DATA;
    expect(d).toHaveProperty("books");
    expect(d).toHaveProperty("translations");
    expect(d).toHaveProperty("defaultPassage");
    expect(d).toHaveProperty("seedPanels");
  });

  it("window.CODEX_DATA.books is the same reference as BOOKS", () => {
    expect(dw().CODEX_DATA?.books).toBe(BOOKS);
  });

  it("window.CODEX_DATA.translations is the same reference as TRANSLATIONS", () => {
    expect(dw().CODEX_DATA?.translations).toBe(TRANSLATIONS);
  });
});

// ── Books ─────────────────────────────────────────────────────────────────────

describe("BOOKS", () => {
  it("contains 66 Protestant books followed by DC books (total > 66)", () => {
    expect(BOOKS.length).toBeGreaterThan(66);
  });

  it("first book is Genesis (OT)", () => {
    const gen = BOOKS[0];
    expect(gen).toBeDefined();
    expect(gen?.id).toBe("gen");
    expect(gen?.name).toBe("Genesis");
    expect(gen?.testament).toBe("OT");
    expect(gen?.chapters).toBe(50);
  });

  it("39th book is Malachi (last OT)", () => {
    const mal = BOOKS[38];
    expect(mal?.id).toBe("mal");
    expect(mal?.testament).toBe("OT");
  });

  it("40th book is Matthew (first NT)", () => {
    const mat = BOOKS[39];
    expect(mat?.id).toBe("mat");
    expect(mat?.testament).toBe("NT");
    expect(mat?.chapters).toBe(28);
  });

  it("last Protestant book is Revelation (66th, 0-indexed 65)", () => {
    const rev = BOOKS[65];
    expect(rev?.id).toBe("rev");
    expect(rev?.testament).toBe("NT");
    expect(rev?.chapters).toBe(22);
  });

  it("first DC book is Tobit with canon=deuterocanon", () => {
    const tob = BOOKS[66];
    expect(tob?.id).toBe("tob");
    expect(tob?.testament).toBe("DC");
    // narrowing: only DC books have canon
    if (tob?.testament === "DC") {
      expect(tob.canon).toBe("deuterocanon");
    }
  });

  it("I Enoch has canon=ethiopian", () => {
    const enoch = BOOKS.find((b) => b.id === "1en");
    expect(enoch).toBeDefined();
    expect(enoch?.testament).toBe("DC");
    if (enoch?.testament === "DC") {
      expect(enoch.canon).toBe("ethiopian");
    }
    expect(enoch?.chapters).toBe(108);
  });

  it("Apocalypse of Moses is last (canon=pseudepigrapha)", () => {
    const apMos = BOOKS[BOOKS.length - 1];
    expect(apMos?.id).toBe("ap-mos");
    if (apMos?.testament === "DC") {
      expect(apMos.canon).toBe("pseudepigrapha");
    }
  });

  it("all OT/NT books have no 'canon' field", () => {
    const protestant = BOOKS.filter((b) => b.testament === "OT" || b.testament === "NT");
    expect(protestant).toHaveLength(66);
    for (const book of protestant) {
      // TypeScript narrowed: ProtestantBook has no canon; confirm at runtime too
      expect("canon" in book).toBe(false);
    }
  });

  it("all DC books have a 'canon' field", () => {
    const dc = BOOKS.filter((b) => b.testament === "DC");
    expect(dc.length).toBeGreaterThan(0);
    for (const book of dc) {
      expect("canon" in book).toBe(true);
    }
  });
});

// ── Translations ──────────────────────────────────────────────────────────────

describe("TRANSLATIONS", () => {
  it("has at least 40 entries", () => {
    expect(TRANSLATIONS.length).toBeGreaterThanOrEqual(40);
  });

  it("first entry is KJV with expected fields", () => {
    const kjv = TRANSLATIONS[0];
    expect(kjv?.id).toBe("kjv");
    expect(kjv?.name).toBe("King James");
    expect(kjv?.year).toBe("1611");
    expect(kjv?.source).toBe("bible-api");
    expect(kjv?.apiId).toBe("kjv");
    expect(kjv?.lang).toBe("EN");
    expect(kjv?.offlinePriority).toBe("must");
    expect(kjv?.bundle).toBe("/data/bibles/kjv.json");
    expect(kjv?.mirrors).toHaveLength(1);
    expect(kjv?.mirrors?.[0]?.kind).toBe("bolls");
    expect(kjv?.mirrors?.[0]?.apiId).toBe("KJV");
  });

  it("DRB has canons=['protestant','deuterocanon']", () => {
    const drb = TRANSLATIONS.find((t) => t.id === "drb");
    expect(drb?.canons).toEqual(["protestant", "deuterocanon"]);
  });

  it("eth-en has source=bundle and canons=['ethiopian']", () => {
    const eth = TRANSLATIONS.find((t) => t.id === "eth-en");
    expect(eth?.source).toBe("bundle");
    expect(eth?.canons).toEqual(["ethiopian"]);
  });

  it("WLC has offlinePriority=must and canons=['ot']", () => {
    const wlc = TRANSLATIONS.find((t) => t.id === "wlc");
    expect(wlc?.offlinePriority).toBe("must");
    expect(wlc?.canons).toEqual(["ot"]);
  });

  it("SBLGNT has offlinePriority=must and canons=['nt']", () => {
    const sbl = TRANSLATIONS.find((t) => t.id === "sblgnt");
    expect(sbl?.offlinePriority).toBe("must");
    expect(sbl?.canons).toEqual(["nt"]);
  });

  it("LXX has year='-200' (negative year string)", () => {
    const lxx = TRANSLATIONS.find((t) => t.id === "lxx");
    expect(lxx?.year).toBe("-200");
  });

  it("zohrab has lang='HY' (Armenian)", () => {
    const z = TRANSLATIONS.find((t) => t.id === "zohrab");
    expect(z?.lang).toBe("HY");
  });

  it("all entries have required fields (id, name, source, apiId, lang)", () => {
    for (const t of TRANSLATIONS) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.source).toBeTruthy();
      expect(t.apiId).toBeTruthy();
      expect(t.lang).toBeTruthy();
    }
  });

  it("no duplicate translation ids", () => {
    const ids = TRANSLATIONS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ── Default passage ───────────────────────────────────────────────────────────

describe("DEFAULT_PASSAGE", () => {
  it("is John 1 (bookId=jhn, chapter=1)", () => {
    expect(DEFAULT_PASSAGE.bookId).toBe("jhn");
    expect(DEFAULT_PASSAGE.chapter).toBe(1);
  });
});

// ── Seed panels ───────────────────────────────────────────────────────────────

describe("SEED_PANELS", () => {
  it("has exactly one seed panel: jhn.1", () => {
    expect(Object.keys(SEED_PANELS)).toEqual(["jhn.1"]);
  });

  it("jhn.1 panel has all expected top-level keys", () => {
    const panel = SEED_PANELS["jhn.1"];
    expect(panel).toBeDefined();
    expect(panel).toHaveProperty("title");
    expect(panel).toHaveProperty("subtitle");
    expect(panel).toHaveProperty("talmud");
    expect(panel).toHaveProperty("commentary");
    expect(panel).toHaveProperty("gematria");
    expect(panel).toHaveProperty("gematriaNotes");
    expect(panel).toHaveProperty("gnosis");
    expect(panel).toHaveProperty("crossRefs");
    expect(panel).toHaveProperty("disarm");
  });

  it("title is 'The Prologue · ΛΟΓΟΣ'", () => {
    expect(SEED_PANELS["jhn.1"]?.title).toBe("The Prologue · ΛΟΓΟΣ");
  });

  it("talmud has 4 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.talmud).toHaveLength(4);
  });

  it("first talmud entry has expected shape", () => {
    const entry = SEED_PANELS["jhn.1"]?.talmud[0];
    expect(entry?.ref).toBe("b. Chagigah 12a");
    expect(entry?.heading).toBeTruthy();
    expect(entry?.body).toBeTruthy();
    expect(entry?.tag).toBeTruthy();
  });

  it("commentary has 4 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.commentary).toHaveLength(4);
  });

  it("gematria has 12 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.gematria).toHaveLength(12);
  });

  it("λόγος gematria entry has value 373", () => {
    const logos = SEED_PANELS["jhn.1"]?.gematria.find((g) => g.term === "λόγος");
    expect(logos?.value).toBe(373);
    expect(logos?.system).toBe("Greek isopsephy");
  });

  it("Ἰησοῦς gematria entry has value 888", () => {
    const iesous = SEED_PANELS["jhn.1"]?.gematria.find((g) => g.term === "Ἰησοῦς");
    expect(iesous?.value).toBe(888);
  });

  it("gematriaNotes has 3 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.gematriaNotes).toHaveLength(3);
  });

  it("gnosis has 5 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.gnosis).toHaveLength(5);
  });

  it("crossRefs has 6 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.crossRefs).toHaveLength(6);
  });

  it("first crossRef is Gen 1:1–3", () => {
    expect(SEED_PANELS["jhn.1"]?.crossRefs[0]?.ref).toBe("Gen 1:1–3");
  });

  it("disarm.entries has 3 entries", () => {
    expect(SEED_PANELS["jhn.1"]?.disarm.entries).toHaveLength(3);
  });

  it("first disarm entry is about verse 1:11", () => {
    const entry = SEED_PANELS["jhn.1"]?.disarm.entries[0];
    expect(entry?.verse).toBe("1:11");
    expect(entry?.weaponization).toBeTruthy();
    expect(entry?.quote).toBeTruthy();
    expect(entry?.source).toBeTruthy();
    expect(entry?.rebuttal).toBeTruthy();
  });
});
