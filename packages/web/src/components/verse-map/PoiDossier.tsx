// verse-map — PoiDossier (Backlog 4.1, sub-slice 8). Migrated from verse-map.jsx
// (l.1819). The legacy fetched Wikipedia + scripture refs via module-level
// resolvers; here they're injected (resolveWiki/resolveRefs/onGoto/fmtYear) so
// the component is decoupled from window and testable. osisDisplay comes from
// the already-migrated osis module.
import React, { useEffect, useState } from "react";
import { poiGlyph } from "./geo.js";
import { osisDisplay } from "./osis.js";

export interface WikiInfo {
  summary: string;
  thumbUrl: string | null;
  pageUrl: string | null;
}

export interface PoiRefs {
  refs: string[];
  src: string;
}

export interface Poi {
  name: string;
  kind?: string;
  lat?: number;
  lng?: number;
  from?: number;
  to?: number;
  main?: boolean;
  wiki?: string;
}

export interface PoiDossierProps {
  poi: Poi;
  onClose(): void;
  resolveWiki(poi: Poi): Promise<WikiInfo>;
  resolveRefs(poi: Poi): Promise<PoiRefs>;
  onGoto(osis: string): void;
  fmtYear(year: number): string;
}

export function PoiDossier({
  poi,
  onClose,
  resolveWiki,
  resolveRefs,
  onGoto,
  fmtYear,
}: PoiDossierProps): React.ReactElement {
  const [wiki, setWiki] = useState<WikiInfo | null>(null);
  const [refs, setRefs] = useState<string[] | null>(null);
  const [refsSrc, setRefsSrc] = useState("");

  useEffect(() => {
    let live = true;
    setWiki(null);
    setRefs(null);
    setRefsSrc("");
    resolveWiki(poi)
      .then((w) => {
        if (live) setWiki(w);
      })
      .catch(() => {
        if (live) setWiki({ summary: "", thumbUrl: null, pageUrl: null });
      });
    resolveRefs(poi).then((r) => {
      if (live) {
        setRefs(r.refs);
        setRefsSrc(r.src);
      }
    });
    return () => {
      live = false;
    };
  }, [poi.name, poi.lat]);

  const yrRange =
    typeof poi.from === "number" && typeof poi.to === "number" ? `${fmtYear(poi.from)} – ${fmtYear(poi.to)}` : null;
  const resolving = wiki === null || refs === null;

  return (
    <aside className="cx-mapx-dossier" role="region" aria-label={`Dossier: ${poi.name}`}>
      <header className="cx-mapx-dossier-h">
        <span className="cx-mapx-dossier-glyph" aria-hidden="true">
          {poi.main ? "⌖" : poiGlyph(poi.kind || "")}
        </span>
        <span className="cx-mapx-dossier-name">{poi.name}</span>
        <button
          className="cx-mapx-dossier-fly"
          title="Center the map here"
          aria-label={`Center map on ${poi.name}`}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("codex:map-fly", { detail: { lat: poi.lat, lng: poi.lng, zoom: poi.main ? 7 : 8 } }),
            )
          }
        >
          ⌖
        </button>
        <button className="cx-mapx-dossier-x" onClick={onClose} aria-label="Close dossier">
          ×
        </button>
      </header>
      <div className="cx-mapx-dossier-meta">
        <span>{(poi.kind || "site").toUpperCase()}</span>
        {yrRange ? <span>· known {yrRange}</span> : null}
        {typeof poi.lat === "number" ? (
          <span>
            · {poi.lat.toFixed(2)}°, {(poi.lng ?? 0).toFixed(2)}°
          </span>
        ) : null}
      </div>

      {wiki && wiki.thumbUrl ? <img className="cx-mapx-dossier-img" loading="lazy" src={wiki.thumbUrl} alt={poi.name} /> : null}

      {resolving ? (
        <div className="cx-mapx-dossier-busy" role="status">
          <span className="cx-mapx-orb" />
          <span>CONSULTING ARCHIVES…</span>
        </div>
      ) : null}

      {wiki !== null ? (
        <p className="cx-mapx-dossier-sum">
          {wiki.summary
            ? wiki.summary.length > 320
              ? wiki.summary.slice(0, 320).trim() + "…"
              : wiki.summary
            : "No encyclopedia summary found for this site."}
        </p>
      ) : null}

      {refs && refs.length ? (
        <div className="cx-mapx-dossier-refs">
          {refs.map((r, i) => (
            <button
              key={i}
              className="cx-mapx-readchip"
              data-osis={r}
              onClick={() => onGoto(r)}
              title={`Open the reader at ${osisDisplay(r)}`}
            >
              ✦ READ {osisDisplay(r)}
            </button>
          ))}
        </div>
      ) : refs && refs.length === 0 ? (
        <div className="cx-mapx-dossier-norefs">
          {refsSrc === "offline" ? "gazetteer offline · no cached refs" : "no direct scripture refs on record"}
        </div>
      ) : null}

      <footer className="cx-mapx-dossier-foot">
        <span>
          intel: wikipedia
          {refsSrc === "ai"
            ? " · refs: AI-suggested"
            : refsSrc === "atlas"
              ? " · refs: atlas"
              : refsSrc === "cache"
                ? " · refs: cached"
                : ""}
        </span>
        {wiki && wiki.pageUrl ? (
          <a href={wiki.pageUrl} target="_blank" rel="noopener noreferrer">
            wikipedia ↗
          </a>
        ) : null}
      </footer>
    </aside>
  );
}
