// verse-map — VerseMap (Backlog 4.1, sub-slice 16: the top-level modal). Migrated
// from verse-map.jsx (l.121). Owns the verse cursor (follows codex:now), resolves
// the AI map dossier (cache-first), and renders MapBody with the real deps.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapBody, type MapData } from "./MapBody.js";
import { createVerseMapDeps, fetchMapData, mapAiBusy } from "./fetchers.js";

interface CodexNowWindow {
  CODEX_NOW?: { bookId: string; chapter: number; verse: number; ref?: string };
}

export interface VerseMapProps {
  verse?: number | { n?: number };
  refStr: string;
  verseText?: string;
  passage: { bookId: string; chapter: number };
  primary?: string;
  onClose(): void;
}

interface Cursor {
  bookId: string;
  chapter: number;
  verse: number;
  refStr: string;
  verseText: string;
}

export function VerseMap({ verse, refStr, verseText, passage, onClose }: VerseMapProps): React.ReactElement {
  const initV = typeof verse === "number" ? verse : verse?.n || 1;
  const deps = useMemo(() => createVerseMapDeps(), []);

  const [cur, setCur] = useState<Cursor>({
    bookId: passage.bookId,
    chapter: passage.chapter,
    verse: initV,
    refStr,
    verseText: verseText || "",
  });
  useEffect(() => {
    const onNow = (e: Event): void => {
      const n = (e as CustomEvent).detail || (window as unknown as CodexNowWindow).CODEX_NOW;
      if (!n || !n.bookId) return;
      setCur((c) =>
        c.bookId === n.bookId && c.chapter === n.chapter && c.verse === n.verse
          ? c
          : { bookId: n.bookId, chapter: n.chapter, verse: n.verse, refStr: n.ref || c.refStr, verseText: "" },
      );
    };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  const key = `codex.maps.${cur.bookId}.${cur.chapter}.${cur.verse}`;
  const mirrorKey = `codex.mirrors.${cur.bookId}.${cur.chapter}.${cur.verse}`;

  const [data, setData] = useState<MapData | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as MapData;
    } catch {
      /* ignore */
    }
    return null;
  });
  const dataRef = useRef<MapData | null>(data);
  dataRef.current = data;
  const [err, setErr] = useState<string | null>(null);
  const [softErr, setSoftErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!data);
  const [refetching, setRefetching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSoftErr(null);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setData(JSON.parse(raw) as MapData);
        setErr(null);
        setLoading(false);
        setRefetching(false);
        return;
      }
    } catch {
      /* ignore */
    }
    void (async () => {
      if (dataRef.current) setRefetching(true);
      else setLoading(true);
      mapAiBusy(true, "map");
      try {
        const obj = (await fetchMapData(cur.refStr, cur.verseText)) as unknown as MapData;
        if (typeof obj.lat !== "number" || typeof obj.lng !== "number") throw new Error("Map response missing coordinates");
        if (cancelled) return;
        try {
          localStorage.setItem(key, JSON.stringify(obj));
        } catch {
          /* ignore */
        }
        setData(obj);
        setErr(null);
      } catch (e) {
        if (cancelled) return;
        if (dataRef.current) setSoftErr(String((e as Error).message || e));
        else setErr(String((e as Error).message || e));
      } finally {
        mapAiBusy(false, "map");
        if (!cancelled) {
          setLoading(false);
          setRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      mapAiBusy(false, "map");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cx-map-backdrop" onClick={onClose} role="dialog" aria-label="Verse map">
      <div className="cx-map" onClick={(e) => e.stopPropagation()}>
        <span className="cx-corner cx-tl" />
        <span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" />
        <span className="cx-corner cx-br" />

        <header className="cx-map-h">
          <span className="cx-map-h-tag">CODEX · MAP</span>
          <span className="cx-map-h-ref">{cur.refStr}</span>
          <button className="cx-map-x" onClick={onClose} aria-label="Close" title="Close (ESC)">
            ×
          </button>
        </header>

        {loading && !data ? (
          <div className="cx-map-loading">
            <div className="cx-map-spin">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>TRIANGULATING · {cur.refStr}</span>
            <span className="cx-map-loading-sub">resolving place · era · context across cartographic record…</span>
          </div>
        ) : err && !data ? (
          <div className="cx-map-err">
            <b>MAP ORACLE OFFLINE</b>
            <code>{err}</code>
          </div>
        ) : data ? (
          <MapBody
            data={data}
            mirrorKey={mirrorKey}
            refStr={cur.refStr}
            cur={cur}
            refetching={refetching}
            softErr={softErr}
            deps={deps}
          />
        ) : null}
      </div>
    </div>
  );
}
