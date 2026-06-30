// constellation — graph instruments (migrated verbatim from constellation.jsx).
// The wheel is one VIEW of a real graph instrument: Dijkstra paths, a family-
// seeded 3D galaxy layout, label-propagation families, canon geometry, and the
// TSK verse→chapter aggregator. Pure logic, extracted so it is ground-truth
// testable. Behaviour is byte-for-intent identical to the legacy functions.

export type AdjEntry = [number, number]; // [neighbourIdx, weight]
export type Adjacency = Map<number, AdjEntry[]>;
export type Pair = [number, number, number]; // [a, b, weight], a < b

export interface CanonBook {
  id: string;
  name: string;
  testament?: string;
  chapters: number;
  canon?: string;
}
export interface CanonChapter {
  bookId: string;
  bookName: string;
  testament?: string;
  ch: number;
  idx: number;
}
export interface Canon {
  books: CanonBook[];
  chapters: CanonChapter[];
  offset: Record<string, number>;
  count: number;
}
export interface Families {
  label: number[];
  families: number;
}
export interface AggregateResult {
  pairs: Pair[];
  adj: Adjacency;
  threads: number;
  verseKeys: number;
}

// Runtime shape of the loaded TSK module (verses keyed "book.chapter").
interface TskShape {
  verses?: Record<string, string[]>;
  data?: { verses?: Record<string, string[]> };
}

// ── Graph tools — the wheel is one VIEW of a real graph instrument. ─────
// Dijkstra with cost 1/weight: paths prefer STRONG threads, so a route is
// scholarship (heavily-attested links), not trivia.
export function constPath(adj: Adjacency, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  // tiny binary-less PQ — fine at ~2k nodes
  const frontier = new Map<number, number>([[from, 0]]);
  while (frontier.size) {
    let u = -1,
      best = Infinity;
    frontier.forEach((d, k) => {
      if (d < best) {
        best = d;
        u = k;
      }
    });
    frontier.delete(u);
    if (u === to) break;
    done.add(u);
    (adj.get(u) || []).forEach(([v, w]) => {
      if (done.has(v)) return;
      const nd = best + 1 / (w + 0.0001);
      if (nd < (dist.has(v) ? dist.get(v)! : Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        frontier.set(v, nd);
      }
    });
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[path.length - 1] !== from) path.push(prev.get(path[path.length - 1]!)!);
  return path.reverse();
}

// ── 3D galaxy layout — family-seeded clusters relaxed by edge springs. ──
// Families sit on a fibonacci sphere; chapters jitter around their family
// center; then edge springs pull linked chapters together while a coarse
// spatial grid keeps neighbors from collapsing. Chunked for a progress
// readout; the result caches (codex.galaxy.v1) so reopen is instant.
export function constGalaxyLayout(
  adj: Adjacency,
  pairs: Pair[],
  count: number,
  famLabel: number[] | undefined,
  onProgress?: (pct: number) => void,
): Promise<Float32Array> {
  return new Promise((resolve) => {
    const R = 320;
    const pos = new Float32Array(count * 3);
    // family centers — fibonacci sphere
    // (legacy used Math.max.apply(null, famLabel); spread is identical.)
    const famCount = Math.max(1, famLabel ? Math.max(...famLabel) + 1 : 1);
    const centers: [number, number, number][] = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let f = 0; f < famCount; f++) {
      const y = famCount === 1 ? 0 : 1 - (f / (famCount - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * f;
      centers.push([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R]);
    }
    // deterministic per-node jitter (no Math.random → stable layouts)
    const jit = (i: number, k: number): number => {
      const s = Math.sin(i * 374761.393 + k * 668265.263) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    for (let i = 0; i < count; i++) {
      const c = centers[famLabel ? famLabel[i]! % famCount : 0]!;
      pos[i * 3] = c[0] + jit(i, 1) * R * 0.38;
      pos[i * 3 + 1] = c[1] + jit(i, 2) * R * 0.38;
      pos[i * 3 + 2] = c[2] + jit(i, 3) * R * 0.38;
    }
    const springs = pairs.slice(0, 9000);
    const wMax = springs.length ? springs[0]![2] : 1;
    const ITER = 90;
    let it = 0;
    const step = (): void => {
      const end = Math.min(it + 6, ITER);
      for (; it < end; it++) {
        const t = 1 - it / ITER; // cooling
        // springs
        for (let s = 0; s < springs.length; s++) {
          const sp = springs[s]!;
          const a = sp[0],
            b = sp[1],
            w = sp[2];
          const ax = a * 3,
            bx = b * 3;
          let dx = pos[bx]! - pos[ax]!,
            dy = pos[bx + 1]! - pos[ax + 1]!,
            dz = pos[bx + 2]! - pos[ax + 2]!;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const want = 60 + 180 * (1 - Math.min(1, w / wMax));
          const f = ((dist - want) / dist) * 0.012 * t * (0.4 + 0.6 * (w / wMax));
          dx *= f;
          dy *= f;
          dz *= f;
          pos[ax] = pos[ax]! + dx;
          pos[ax + 1] = pos[ax + 1]! + dy;
          pos[ax + 2] = pos[ax + 2]! + dz;
          pos[bx] = pos[bx]! - dx;
          pos[bx + 1] = pos[bx + 1]! - dy;
          pos[bx + 2] = pos[bx + 2]! - dz;
        }
        // coarse grid repulsion — only same-cell neighbors push apart
        const cell = 46;
        const grid = new Map<string, number[]>();
        for (let i = 0; i < count; i++) {
          const k =
            Math.round(pos[i * 3]! / cell) +
            "," +
            Math.round(pos[i * 3 + 1]! / cell) +
            "," +
            Math.round(pos[i * 3 + 2]! / cell);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k)!.push(i);
        }
        grid.forEach((bucket) => {
          for (let x = 0; x < bucket.length; x++)
            for (let y = x + 1; y < bucket.length; y++) {
              const a = bucket[x]! * 3,
                b = bucket[y]! * 3;
              let dx = pos[b]! - pos[a]!,
                dy = pos[b + 1]! - pos[a + 1]!,
                dz = pos[b + 2]! - pos[a + 2]!;
              const d2 = dx * dx + dy * dy + dz * dz || 1;
              if (d2 > cell * cell) continue;
              const f = ((cell * cell) / d2) * 0.6 * t;
              const d = Math.sqrt(d2);
              dx = (dx / d) * f;
              dy = (dy / d) * f;
              dz = (dz / d) * f;
              pos[a] = pos[a]! - dx;
              pos[a + 1] = pos[a + 1]! - dy;
              pos[a + 2] = pos[a + 2]! - dz;
              pos[b] = pos[b]! + dx;
              pos[b + 1] = pos[b + 1]! + dy;
              pos[b + 2] = pos[b + 2]! + dz;
            }
        });
      }
      if (onProgress) onProgress(Math.round((it / ITER) * 100));
      if (it < ITER) {
        setTimeout(step, 0);
        return;
      }
      resolve(pos);
    };
    step();
  });
}

// Label propagation — the canon's natural families, found in the client.
// Weighted majority vote per node, a few sweeps; deterministic order.
export function constFamilies(adj: Adjacency, count: number): Families {
  const label = new Array<number>(count);
  for (let i = 0; i < count; i++) label[i] = i;
  for (let sweep = 0; sweep < 6; sweep++) {
    let changed = 0;
    for (let i = 0; i < count; i++) {
      const votes = new Map<number, number>();
      (adj.get(i) || []).forEach(([v, w]) => {
        votes.set(label[v]!, (votes.get(label[v]!) || 0) + w);
      });
      if (!votes.size) continue;
      let bestL = label[i]!,
        bestV = -1;
      votes.forEach((v, l) => {
        if (v > bestV) {
          bestV = v;
          bestL = l;
        }
      });
      if (bestL !== label[i]) {
        label[i] = bestL;
        changed++;
      }
    }
    if (!changed) break;
  }
  // compact to family indices ranked by size
  const sizes = new Map<number, number>();
  label.forEach((l) => sizes.set(l, (sizes.get(l) || 0) + 1));
  const ranked = [...sizes.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const famOf = new Map<number, number>(ranked.map((l, i): [number, number] => [l, i]));
  return { label: label.map((l) => famOf.get(l)!), families: ranked.length };
}

// ── Canon geometry — global chapter index from the canonical book list ──
// Pure core; the window-reading wrapper (constCanon) lives in the component.
export function buildCanon(books: CanonBook[]): Canon {
  const chapters: CanonChapter[] = []; // [{bookId, bookName, testament, ch, idx}]
  const offset: Record<string, number> = {}; // bookId -> first global index
  books.forEach((b) => {
    offset[b.id] = chapters.length;
    for (let c = 1; c <= b.chapters; c++) {
      chapters.push({ bookId: b.id, bookName: b.name, testament: b.testament, ch: c, idx: chapters.length });
    }
  });
  return { books, chapters, offset, count: chapters.length };
}

// Aggregate TSK verse-pairs → undirected chapter-pair weights, chunked so
// the UI can read out progress. Returns { pairs:[[a,b,w]…w-desc], adj:Map }.
export function constAggregate(
  tsk: unknown,
  canon: Canon,
  onProgress?: (pct: number, threads: number) => void,
): Promise<AggregateResult> {
  return new Promise((resolve, reject) => {
    try {
      const t = (tsk || {}) as TskShape;
      const verses: Record<string, string[]> = (t.verses || (t.data && t.data.verses)) || {};
      const keys = Object.keys(verses);
      const W = new Map<number, number>(); // packed key a*4096+b (a<b) -> weight
      const chapIdx = (key: string): number => {
        const p = key.split(".");
        const off = canon.offset[p[0] ?? ""];
        if (off === undefined) return -1;
        const ch = parseInt(p[1] ?? "", 10);
        if (!ch || ch < 1) return -1;
        return off + ch - 1;
      };
      let i = 0,
        threads = 0;
      const CHUNK = 2500;
      const step = (): void => {
        const end = Math.min(i + CHUNK, keys.length);
        for (; i < end; i++) {
          const a = chapIdx(keys[i]!);
          if (a < 0) continue;
          const targets = verses[keys[i]!];
          if (!Array.isArray(targets)) continue;
          for (let u = 0; u < targets.length; u++) {
            const b = chapIdx(targets[u]!);
            if (b < 0 || b === a) continue;
            threads++;
            const k = a < b ? a * 4096 + b : b * 4096 + a;
            W.set(k, (W.get(k) || 0) + 1);
          }
        }
        if (onProgress) onProgress(Math.round((i / keys.length) * 100), threads);
        if (i < keys.length) {
          setTimeout(step, 0);
          return;
        }
        // Unpack, sort by weight, build per-chapter adjacency.
        const pairs: Pair[] = [];
        W.forEach((w, k) => pairs.push([Math.floor(k / 4096), k % 4096, w]));
        pairs.sort((x, y) => y[2] - x[2]);
        const adj: Adjacency = new Map();
        pairs.forEach(([a, b, w]) => {
          if (!adj.has(a)) adj.set(a, []);
          if (!adj.has(b)) adj.set(b, []);
          adj.get(a)!.push([b, w]);
          adj.get(b)!.push([a, w]);
        });
        resolve({ pairs, adj, threads, verseKeys: keys.length });
      };
      step();
    } catch (e) {
      reject(e);
    }
  });
}
