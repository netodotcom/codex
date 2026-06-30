// strongs — StrongsPanel + renderInterlinear (migrated verbatim from strongs.jsx).
// Pure layout/render; logic lives in helpers.ts. DOM output is byte-for-intent
// identical to the legacy IIFE — React.createElement throughout, no JSX transform.
import React from "react";
import {
  _lex,
  ensureLoaded,
  lookup,
  canonRef,
  alignmentFor,
  openLookup,
} from "./helpers.js";
import type { AlignmentToken, StrongsEntry, StrongsPanelProps } from "./strongs-window.js";
import type { VerseRefParts } from "./helpers.js";

const { useState, useEffect, useMemo } = React;

interface QueryHit {
  key: string;
  entry: StrongsEntry | null;
}

export function StrongsPanel(props: StrongsPanelProps): React.ReactElement {
  const book = String(props.book ?? props.bookId ?? "");
  const chapter = props.chapter;
  const verse = props.verse;
  const ref = canonRef({
    book,
    bookId: typeof props.bookId === "string" ? props.bookId : undefined,
    chapter: typeof chapter === "number" || typeof chapter === "string" ? chapter : undefined,
    verse: typeof verse === "number" || typeof verse === "string" ? verse : undefined,
  });

  const [loading, setLoading] = useState(!_lex.hebrew || !_lex.greek || !_lex.alignment);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(function () {
    if (!loading) return;
    ensureLoaded().then(function () { setLoading(false); }, function (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : String(e);
      setErr(msg);
      setLoading(false);
    });
  }, []);

  // Listen for external "open this Strong's number" requests.
  useEffect(function () {
    function onOpen(ev: Event): void {
      const d = (ev as CustomEvent<{ strongs?: string } | null>).detail;
      const s = d && d.strongs;
      if (s) { setQuery(s); setFocused(s); }
    }
    window.addEventListener("codex:strongs-open", onOpen);
    return function () { window.removeEventListener("codex:strongs-open", onOpen); };
  }, []);

  // Reset focused entry when the verse changes.
  useEffect(function () { setFocused(null); }, [ref]);

  const tokens = useMemo(function () { return alignmentFor(ref) || []; }, [ref, loading]);

  const strongsInVerse = useMemo(function () {
    const seen: Record<string, number> = {};
    const out: AlignmentToken[] = [];
    tokens.forEach(function (t) {
      if (t.strongs && !seen[t.strongs]) { seen[t.strongs] = 1; out.push(t); }
    });
    return out;
  }, [tokens]);

  const queryHit = useMemo(function (): QueryHit | null {
    const q = (query || "").trim().toUpperCase();
    if (!q) return null;
    // Normalize: allow "h1" / "h 1" / "1722" (default to G if numeric)
    const key = q.replace(/\s+/g, "");
    if (/^\d+$/.test(key)) {
      // ambiguous — try Hebrew first if number <= 8674
      const n = parseInt(key, 10);
      if (n > 0 && n <= 8674) {
        const hh = lookup("H" + n); if (hh) return { key: "H" + n, entry: hh };
      }
      const gg = lookup("G" + n); if (gg) return { key: "G" + n, entry: gg };
      return { key: q, entry: null };
    }
    const ent = lookup(key);
    return { key, entry: ent };
  }, [query, loading]);

  const activeKey = focused || (queryHit && queryHit.entry ? queryHit.key : null);
  const activeEntry = activeKey ? lookup(activeKey) : null;

  const partialNote = useMemo(function (): string | null {
    const partial: string[] = [];
    if (_lex.hebrew && _lex.hebrew.meta && _lex.hebrew.meta._partial) partial.push("Hebrew");
    if (_lex.greek && _lex.greek.meta && _lex.greek.meta._partial) partial.push("Greek");
    if (!partial.length) return null;
    return partial.join(" & ") + " lexicon is partial (starter set of ~500 entries — full lexicon coming).";
  }, [loading]);

  if (loading) {
    return React.createElement("div", { className: "cx-strongs-panel cx-pane-body" },
      React.createElement("p", { className: "cx-muted" }, "Loading Strong’s lexicons…")
    );
  }

  if (err) {
    return React.createElement("div", { className: "cx-strongs-panel cx-pane-body" },
      React.createElement("p", { className: "cx-error" }, "Couldn’t load Strong’s data: " + err)
    );
  }

  return React.createElement("div", { className: "cx-strongs-panel cx-pane-body", style: { padding: "0.5rem 0.75rem" } },

    // ── Lookup search box ─────────────────────────────────────────
    React.createElement("div", { className: "cx-strongs-search", style: { marginBottom: "0.75rem" } },
      React.createElement("input", {
        type: "text",
        value: query,
        onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setQuery(e.target.value); setFocused(null); },
        placeholder: "Strong’s # (e.g. G2316 or H430)",
        "aria-label": "Strong’s number lookup",
        style: {
          width: "100%", padding: "0.35rem 0.5rem", fontFamily: "inherit", fontSize: "0.9em",
          background: "transparent", border: "1px solid var(--cx-border, #444)",
          color: "inherit", borderRadius: "3px",
        },
      }),
      query && queryHit && !queryHit.entry
        ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.8em", marginTop: "0.35em" } },
            "No entry for " + queryHit.key + " in the starter lexicon.")
        : null
    ),

    // ── Words in current verse ───────────────────────────────────
    React.createElement("h4", {
      className: "cx-strongs-h",
      style: { margin: "0.25rem 0 0.4rem", fontSize: "0.85em", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 },
    },
      verse
        ? ("Words in " + book + " " + String(chapter) + ":" + String(verse))
        : ("Words in " + book + " " + String(chapter))
    ),

    strongsInVerse.length
      ? React.createElement("ul", { className: "cx-strongs-wordlist", style: { listStyle: "none", padding: 0, margin: "0 0 1rem" } },
          strongsInVerse.map(function (t) {
            const entry = t.strongs ? lookup(t.strongs) : null;
            return React.createElement("li", {
              key: t.strongs,
              onClick: function () {
                const s = t.strongs;
                if (!s) return;
                setFocused(s); setQuery(s);
                if (entry && s) {
                  try {
                    window.dispatchEvent(new CustomEvent("codex:depth-action", {
                      detail: { type: "lemma-open", ref: s, weight: 1, domain: "hebrew-greek" },
                    }));
                  } catch { /* no-op */ }
                }
              },
              style: {
                padding: "0.3rem 0.4rem", cursor: "pointer",
                borderBottom: "1px solid var(--cx-border-soft, rgba(128,128,128,0.18))",
                display: "flex", justifyContent: "space-between", gap: "0.5rem",
              },
            },
              React.createElement("span", null,
                React.createElement("b", null, t.en.replace(/^[\s,;.:]+|[\s,;.:]+$/g, "")),
                entry
                  ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.4em", opacity: 0.7 } },
                      "· " + entry.translit + (entry.gloss ? " — " + entry.gloss : ""))
                  : null
              ),
              React.createElement("code", { style: { opacity: 0.7, fontSize: "0.85em" } }, t.strongs)
            );
          })
        )
      : React.createElement("p", { className: "cx-muted", style: { fontSize: "0.85em", marginBottom: "1rem" } },
          "No alignment data for this verse yet. Sample coverage: Genesis 1, Psalm 23, John 1, John 3, Romans 8. Use the search above to look up any Strong’s number."),

    // ── Focused entry detail ─────────────────────────────────────
    activeEntry
      ? React.createElement("div", {
          className: "cx-strongs-entry",
          style: {
            padding: "0.6rem", border: "1px solid var(--cx-border, #444)",
            borderRadius: "4px", background: "var(--cx-bg-soft, rgba(128,128,128,0.06))",
          },
        },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4em" } },
            React.createElement("strong", { style: { fontSize: "1.4em" } }, activeEntry.word),
            React.createElement("code", { style: { opacity: 0.7 } }, activeKey)
          ),
          React.createElement("div", { style: { fontSize: "0.9em", marginBottom: "0.4em" } },
            React.createElement("i", null, activeEntry.translit),
            activeEntry.pron
              ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.5em", opacity: 0.7 } }, "/" + activeEntry.pron + "/")
              : null,
            activeEntry.pos
              ? React.createElement("span", { className: "cx-muted", style: { marginLeft: "0.5em", opacity: 0.7 } }, "· " + activeEntry.pos)
              : null
          ),
          React.createElement("div", { style: { fontSize: "1em", marginBottom: "0.5em" } },
            React.createElement("b", null, activeEntry.gloss)
          ),
          React.createElement("p", { style: { fontSize: "0.9em", lineHeight: 1.45, margin: "0 0 0.5em" } }, activeEntry.def),
          typeof activeEntry.usage === "number"
            ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.8em", opacity: 0.7, margin: 0 } },
                "Occurs ~" + activeEntry.usage + " times in scripture.")
            : null
        )
      : query && queryHit && queryHit.entry === null
        ? null
        : !focused && !strongsInVerse.length
          ? null
          : React.createElement("p", { className: "cx-muted", style: { fontSize: "0.85em", opacity: 0.7 } },
              "Tap a word above to see its Strong’s entry."),

    // ── Partial-data note ────────────────────────────────────────
    partialNote
      ? React.createElement("p", { className: "cx-muted", style: { fontSize: "0.75em", marginTop: "1rem", opacity: 0.6, fontStyle: "italic" } }, partialNote)
      : null
  );
}

// ── Interlinear renderer ───────────────────────────────────────────────────
// Exported so index.tsx can set window.CODEX_StrongsRenderer.renderInterlinear.
// If alignment data exists, renders each token with the Strong's number beneath.
// Otherwise falls back to plain text — preserves legacy behavior faithfully.
export function renderInterlinear(
  verseRef: string | VerseRefParts | null | undefined,
  englishText: string,
): React.ReactElement {
  const ref = canonRef(verseRef as Parameters<typeof canonRef>[0]);
  const tokens = alignmentFor(ref);
  if (!tokens || !tokens.length) {
    return React.createElement("span", { className: "cx-interlinear-fallback" }, englishText || "");
  }
  const children = tokens.map(function (tok, i) {
    if (!tok.strongs) {
      return React.createElement("span", { key: i, className: "cx-interlinear-plain" }, tok.en + " ");
    }
    return React.createElement(
      "span",
      {
        key: i,
        className: "cx-interlinear-word",
        "data-strongs": tok.strongs,
        title: tok.lemma ? tok.strongs + " · " + tok.lemma : tok.strongs,
        onClick: function () { openLookup(tok.strongs!); },
        style: { cursor: "pointer", borderBottom: "1px dotted currentColor", marginRight: "0.15em" },
      },
      React.createElement("span", { className: "cx-il-en" }, tok.en),
      React.createElement(
        "sub",
        { className: "cx-il-strongs", style: { opacity: 0.6, fontSize: "0.7em", marginLeft: "0.1em" } },
        tok.strongs
      )
    );
  });
  return React.createElement("span", { className: "cx-interlinear" }, children);
}
