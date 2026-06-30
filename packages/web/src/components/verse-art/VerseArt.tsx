// verse-art — React components (migrated faithfully from verse-art.jsx).
// VerseArt: the modal backdrop + grid. ArtCard: individual artwork tile.
import React from "react";
import { ART_PROMPT, ART_MORE_PROMPT, tolerantParse, resolveArtImage } from "./helpers.js";
import type { ArtWork, ArtData } from "./helpers.js";
import type { VerseArtProps } from "./verse-art-window.js";

const { useState, useEffect } = React;

// ── VerseArt ──────────────────────────────────────────────────────────────
export function VerseArt({ verse, refStr, verseText, passage, onClose }: VerseArtProps): React.ReactElement {
  const key = `codex.art.${passage.bookId}.${passage.chapter}.${verse?.n}`;
  const [data, setData]    = useState<ArtData | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as ArtData;
    } catch {
      // ignore
    }
    return null;
  });
  const [err, setErr]        = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!data);
  const [moreBusy, setMoreBusy] = useState<boolean>(false);

  // Initial fetch
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetchArt({ excludeTitles: [] })
      .then(obj => { if (!cancelled) { setData(obj); setLoading(false); persist(obj); } })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setErr(msg);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function persist(obj: ArtData): void {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch {
      // ignore
    }
  }

  async function fetchArt({ excludeTitles }: { excludeTitles: string[]; append?: boolean }): Promise<ArtData> {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: ART_PROMPT,
        messages: [{
          role: "user",
          content: excludeTitles?.length
            ? `Verse: ${refStr}\nText: ${verseText}\n\n${ART_MORE_PROMPT(excludeTitles)}`
            : `Verse: ${refStr}\nText: ${verseText}\n\nReturn the JSON object.`,
        }],
        max_tokens: 2400,
      }),
    });
    const body = (await r.json()) as { error?: string; text?: string };
    if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
    const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const i = text.indexOf("{");
    if (i === -1) throw new Error("Art response not JSON");
    return tolerantParse(text.slice(i)) as ArtData;
  }

  async function loadMore(): Promise<void> {
    if (moreBusy || !data?.works) return;
    setMoreBusy(true);
    try {
      const exclude = data.works.map(w => w.title);
      const more = await fetchArt({ excludeTitles: exclude, append: true });
      const merged: ArtData = {
        scene: data.scene,
        works: [...data.works, ...(more.works || [])],
      };
      setData(merged);
      persist(merged);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <div className="cx-art-backdrop" onClick={onClose} role="dialog" aria-label="Verse artworks">
      <div className="cx-art" onClick={e => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-art-h">
          <span className="cx-art-h-tag">CODEX · ART</span>
          <span className="cx-art-h-ref">{refStr}</span>
          {data?.scene ? <span className="cx-art-h-scene">— {data.scene}</span> : null}
          <button className="cx-art-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        {loading ? (
          <div className="cx-art-loading">
            <div className="cx-art-spin"><i/><i/><i/><i/></div>
            <span>SURVEYING · PAINTINGS · ILLUMINATIONS · FILMS</span>
            <span className="cx-art-loading-sub">querying the visual record across two millennia…</span>
          </div>
        ) : err ? (
          <div className="cx-art-err">
            <b>ART ORACLE OFFLINE</b>
            <code>{err}</code>
          </div>
        ) : data ? (
          <>
            <div className="cx-art-grid">
              {(data.works || []).map((w, i) => <ArtCard key={`${w.title}-${i}`} work={w} />)}
            </div>
            <footer className="cx-art-foot">
              <span className="cx-art-foot-count">{data.works?.length || 0} works</span>
              <button
                className="cx-art-more"
                onClick={loadMore}
                disabled={moreBusy}
                title="Surface more artworks for this verse"
              >{moreBusy ? "loading…" : "+ MORE"}</button>
            </footer>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── ArtCard ───────────────────────────────────────────────────────────────
interface ArtCardProps {
  work: ArtWork;
}

export function ArtCard({ work }: ArtCardProps): React.ReactElement {
  const [src, setSrc] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    resolveArtImage(work).then(url => {
      if (!cancelled) { setSrc(url); setResolving(false); }
    });
    return () => { cancelled = true; };
  }, [work.title, work.artist, work.commonsFile, work.wikipedia]);

  const wikiHref = work.wikipedia
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(work.wikipedia.replace(/ /g, "_"))}`
    : work.commonsFile
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(work.commonsFile)}`
      : `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${work.title} ${work.artist || ""}`)}`;

  const yr = (() => {
    if (!work.year && work.year !== 0) return "";
    const n = Math.abs(work.year);
    return `${n} ${work.year < 0 ? "BCE" : "CE"}`;
  })();

  return (
    <a className="cx-art-card" href={wikiHref} target="_blank" rel="noopener noreferrer" title={`Open ${work.title}`}>
      <div className="cx-art-card-img" data-loading={resolving ? "1" : null}>
        {src ? (
          <img src={src} alt={`${work.title} — ${work.artist || ""}`} loading="lazy"
               onError={() => setSrc(null)} />
        ) : resolving ? (
          <div className="cx-art-placeholder">
            <span className="cx-art-placeholder-frame">
              <span className="cx-art-placeholder-glyph">⟳</span>
            </span>
            <span className="cx-art-placeholder-l">searching wikimedia…</span>
          </div>
        ) : (
          <div className="cx-art-placeholder">
            <span className="cx-art-placeholder-frame">
              <span className="cx-art-placeholder-glyph">◬</span>
            </span>
            <span className="cx-art-placeholder-l">no image catalogued</span>
          </div>
        )}
      </div>
      <div className="cx-art-card-meta">
        <h4 className="cx-art-card-title">{work.title}</h4>
        <div className="cx-art-card-attrib">
          <span className="cx-art-card-artist">{work.artist || "Anonymous"}</span>
          {yr ? <span className="cx-art-card-year">· {yr}</span> : null}
        </div>
        {(work.medium || work.location) ? (
          <div className="cx-art-card-tech">
            {work.medium ? <span>{work.medium}</span> : null}
            {work.medium && work.location ? <span> · </span> : null}
            {work.location ? <span>{work.location}</span> : null}
          </div>
        ) : null}
        {work.summary ? <p className="cx-art-card-summary">{work.summary}</p> : null}
        {work.themes ? <div className="cx-art-card-themes">{work.themes}</div> : null}
      </div>
    </a>
  );
}
