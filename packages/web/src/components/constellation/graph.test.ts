import { describe, it, expect } from "vitest";
import {
  buildCanon,
  constAggregate,
  constPath,
  constFamilies,
  constGalaxyLayout,
  type Adjacency,
  type Pair,
} from "./graph.js";

// Ground truth captured by running a faithful copy of the legacy functions in
// node (see migration notes) — these exact values are asserted below.

const books = [
  { id: "gen", name: "Genesis", testament: "OT", chapters: 2 },
  { id: "rev", name: "Revelation", testament: "NT", chapters: 1 },
];

describe("buildCanon (ground truth)", () => {
  it("builds the global chapter index + per-book offsets", () => {
    const canon = buildCanon(books);
    expect(canon.count).toBe(3);
    expect(canon.offset).toEqual({ gen: 0, rev: 2 });
    expect(canon.chapters).toEqual([
      { bookId: "gen", bookName: "Genesis", testament: "OT", ch: 1, idx: 0 },
      { bookId: "gen", bookName: "Genesis", testament: "OT", ch: 2, idx: 1 },
      { bookId: "rev", bookName: "Revelation", testament: "NT", ch: 1, idx: 2 },
    ]);
  });
});

describe("constAggregate (ground truth)", () => {
  it("aggregates verse-pairs → undirected chapter weights, sorted desc, with adjacency", async () => {
    const canon = buildCanon(books);
    const tsk = {
      verses: {
        "gen.1": ["gen.2", "gen.2", "rev.1"],
        "gen.2": ["rev.1", "rev.1", "rev.1"],
      },
    };
    const agg = await constAggregate(tsk, canon);
    expect(agg.threads).toBe(6);
    expect(agg.verseKeys).toBe(2);
    expect(agg.pairs).toEqual([
      [1, 2, 3],
      [0, 1, 2],
      [0, 2, 1],
    ]);
    expect([...agg.adj.entries()]).toEqual([
      [1, [[2, 3], [0, 2]]],
      [2, [[1, 3], [0, 1]]],
      [0, [[1, 2], [2, 1]]],
    ]);
  });

  it("reads the nested data.verses shape and skips unknown books / self-links", async () => {
    const canon = buildCanon(books);
    const tsk = { data: { verses: { "gen.1": ["xyz.9", "gen.1", "rev.1"] } } };
    const agg = await constAggregate(tsk, canon);
    // xyz.9 (unknown book) skipped, gen.1→gen.1 (self) skipped, only gen.1↔rev.1
    expect(agg.threads).toBe(1);
    expect(agg.pairs).toEqual([[0, 2, 1]]);
  });
});

describe("constPath (Dijkstra, ground truth)", () => {
  it("returns [from] for a self-path", async () => {
    const canon = buildCanon(books);
    const { adj } = await constAggregate(
      { verses: { "gen.1": ["gen.2", "gen.2", "rev.1"], "gen.2": ["rev.1", "rev.1", "rev.1"] } },
      canon,
    );
    expect(constPath(adj, 0, 0)).toEqual([0]);
  });
  it("prefers strong threads — routes gen.1 → rev.1 through gen.2", async () => {
    const canon = buildCanon(books);
    const { adj } = await constAggregate(
      { verses: { "gen.1": ["gen.2", "gen.2", "rev.1"], "gen.2": ["rev.1", "rev.1", "rev.1"] } },
      canon,
    );
    expect(constPath(adj, 0, 2)).toEqual([0, 1, 2]);
  });
  it("returns null when no path exists", () => {
    const empty: Adjacency = new Map();
    expect(constPath(empty, 0, 5)).toBeNull();
  });
});

describe("constFamilies (label propagation, ground truth)", () => {
  it("collapses a fully-connected triad into one family", async () => {
    const canon = buildCanon(books);
    const { adj } = await constAggregate(
      { verses: { "gen.1": ["gen.2", "gen.2", "rev.1"], "gen.2": ["rev.1", "rev.1", "rev.1"] } },
      canon,
    );
    expect(constFamilies(adj, canon.count)).toEqual({ label: [0, 0, 0], families: 1 });
  });
});

describe("constGalaxyLayout (deterministic, ground truth)", () => {
  const adj: Adjacency = new Map();
  const pairs: Pair[] = [
    [1, 2, 3],
    [0, 1, 2],
    [0, 2, 1],
  ];

  it("resolves a Float32Array of count*3, reports progress to 100", async () => {
    let last = -1;
    const pos = await constGalaxyLayout(adj, pairs, 3, [0, 0, 0], (p) => {
      last = p;
    });
    expect(pos).toBeInstanceOf(Float32Array);
    expect(pos.length).toBe(9);
    expect(last).toBe(100);
    // no Math.random → stable layout (rounded snapshot of the captured run)
    expect(Array.from(pos).map((n) => Math.round(n))).toEqual([307, -89, 49, 390, -85, 12, 369, 11, -34]);
  });

  it("is deterministic — two runs produce identical positions", async () => {
    const a = await constGalaxyLayout(adj, pairs, 3, [0, 0, 0]);
    const b = await constGalaxyLayout(adj, pairs, 3, [0, 0, 0]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
