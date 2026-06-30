// library2 — LibraryX component (migrated verbatim from library2.jsx).
// The component is intentionally zero-prop: it reads all runtime state from
// window.CODEX_DATA / window.CODEX_NOW through the typed lw() accessor, exactly
// as the legacy IIFE did.  No logic has been changed; quirks (including the
// "undefined" render for p[1]/p[2] when a split produces fewer parts) are
// preserved faithfully.
import React, { useState, useEffect, useRef } from "react";
import type { Lib2Book, Lib2Now, Lib2SearchResult } from "./library2-window.js";
import { lw } from "./library2-window.js";
import { LIB2_SHELVES } from "./data.js";
import { lib2SourceLight } from "./helpers.js";

interface RefJump {
  b: Lib2Book;
  ch: number;
  v: number | null;
}

export function LibraryX(): React.ReactElement {
  const data = lw().CODEX_DATA ?? { books: [] as Lib2Book[], translations: [] };
  const [now, setNow] = useState<Lib2Now>(() => lw().CODEX_NOW ?? {});
  const [primary, setPrimary] = useState<string>(
    () => (data.tweaks && data.tweaks.primaryTranslation) || "web",
  );
  const [q, setQ] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(() => {
    const n = lw().CODEX_NOW;
    return (n && n.bookId) || null;
  });
  const [hits, setHits] = useState<Lib2SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onNow = (e: Event): void => {
      const ce = e as CustomEvent<Lib2Now | null | undefined>;
      const n = ce.detail || lw().CODEX_NOW;
      if (n && n.bookId) { setNow(n as Lib2Now); }
    };
    const onPrimary = (e: Event): void => {
      const ce = e as CustomEvent<{ id?: string } | null | undefined>;
      const id = ce.detail && ce.detail.id;
      if (id) setPrimary(id);
    };
    window.addEventListener("codex:now", onNow);
    window.addEventListener("codex:primary", onPrimary);
    return (): void => {
      window.removeEventListener("codex:now", onNow);
      window.removeEventListener("codex:primary", onPrimary);
    };
  }, []);

  // Full-text suggestions (debounced) when the query isn't a book name.
  useEffect(() => {
    let stop = false;
    const text = q.trim();
    const search = lw().CODEX_SEARCH;
    if (text.length < 3 || !search || !search.search) { setHits([]); return; }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await search.search(text, { translation: primary, limit: 6 });
          if (!stop) setHits(Array.isArray(res) ? res : []);
        } catch { if (!stop) setHits([]); }
      })();
    }, 200);
    return (): void => { stop = true; clearTimeout(t); };
  }, [q, primary]);

  const needle = q.trim().toLowerCase();
  const matches = (b: Lib2Book): boolean =>
    !needle ||
    b.name.toLowerCase().includes(needle) ||
    (b.id || "").toLowerCase().includes(needle);

  const goChapter = (b: Lib2Book, ch: number): void => {
    // structured jump — DC display names ("I Enoch (Book of Enoch)") would
    // defeat the string parser, so the shelves never go through it.
    if (lw().codexGoto) lw().codexGoto!(b.id, ch, 1);
    else if (lw().codexJumpToRef) lw().codexJumpToRef!(`${b.name} ${ch}`);
  };

  const refMatch = needle.match(/^([1-4]?\s*[a-zé' ]+?)\s+(\d+)(?::(\d+))?$/i);
  let refJump: RefJump | null = null;
  if (refMatch) {
    const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(refMatch[1] ?? "");
    const b = data.books.find(
      (x) => norm(x.name) === want || norm(x.id) === want || norm(x.name).startsWith(want),
    );
    if (b) {
      refJump = {
        b,
        ch: Math.min(parseInt(refMatch[2] ?? "1", 10) || 1, b.chapters),
        v: refMatch[3] != null ? parseInt(refMatch[3], 10) : null,
      };
    }
  }

  const renderBook = (b: Lib2Book): React.ReactElement => {
    const light = lib2SourceLight(b, primary);
    const active = b.id === now.bookId;
    const open = b.id === openId;
    return (
      <div key={b.id} className={`cxl-book ${open ? "is-open" : ""}`}>
        <button
          className={`cxl-row ${active ? "is-active" : ""}`}
          onClick={() => setOpenId(open ? null : b.id)}
          aria-expanded={open}
        >
          <span
            className={`cxl-light is-${light}`}
            aria-hidden={true}
            title={
              light === "own"
                ? `In ${(primary || "").toUpperCase()}`
                : light === "other"
                  ? "Served from another corpus"
                  : "No known source"
            }
          />
          <span className="cxl-name">{b.name}</span>
          <span className="cxl-meta">
            {active ? `${now.chapter} / ${b.chapters}` : b.chapters}
          </span>
        </button>
        {open ? (
          <div className="cxl-chs" role="group" aria-label={`${b.name} chapters`}>
            {light === "none" ? (
              <div className="cxl-nosource">
                ○ no corpus in the registry carries {b.name} yet — install one via the
                marketplace
              </div>
            ) : null}
            {Array.from({ length: b.chapters }, (_, i) => i + 1).map((ch) => (
              <button
                key={ch}
                className={`cxl-ch ${active && ch === now.chapter ? "is-active" : ""}`}
                onClick={() => goChapter(b, ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="cxl">
      <div className="cxl-search">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && refJump) {
              e.preventDefault();
              goChapter(refJump.b, refJump.ch);
              if (refJump.v != null && lw().codexJumpToRef)
                lw().codexJumpToRef!(`${refJump.b.name} ${refJump.ch}:${refJump.v}`);
              setQ("");
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Book · 'John 3:16' · any words…"
          aria-label="Search the shelves — book, reference, or text"
          spellCheck={false}
        />
        {q ? (
          <button className="cxl-clear" onClick={() => setQ("")} aria-label="Clear">
            ×
          </button>
        ) : null}
      </div>

      {refJump ? (
        <button
          className="cxl-jump"
          onClick={() => {
            const rj = refJump!;
            goChapter(rj.b, rj.ch);
            if (rj.v != null && lw().codexJumpToRef)
              lw().codexJumpToRef!(`${rj.b.name} ${rj.ch}:${rj.v}`);
            setQ("");
          }}
        >
          ✦ OPEN {refJump.b.name.toUpperCase()} {refJump.ch}
          {refJump.v != null ? ":" + refJump.v : ""}
        </button>
      ) : null}

      {hits.length ? (
        <div className="cxl-hits" role="list">
          {hits.map((h, i) => {
            const p = String(h.ref || "").split(".");
            const b = data.books.find((x) => x.id === p[0]);
            if (!b) return null;
            return (
              <button
                key={i}
                className="cxl-hit"
                role="listitem"
                onClick={() => {
                  if (lw().codexJumpToRef)
                    lw().codexJumpToRef!(`${b.name} ${p[1]}:${p[2]}`);
                  setQ("");
                }}
              >
                <b>
                  {b.name} {p[1]}:{p[2]}
                </b>
                <span>{String(h.snippet || h.text || "").replace(/<[^>]+>/g, "")}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="cxl-scroll">
        {LIB2_SHELVES.map((shelf) => {
          const books = data.books.filter((b) => shelf.filter(b) && matches(b));
          if (!books.length) return null;
          return (
            <section key={shelf.key} className="cxl-shelf">
              <h3 className="cxl-h">{shelf.label()}</h3>
              {books.map(renderBook)}
            </section>
          );
        })}
      </div>

      <footer className="cxl-foot" aria-hidden={true}>
        ● in {(primary || "").toUpperCase()} · ◐ other corpus · ○ no source
      </footer>
    </div>
  );
}
