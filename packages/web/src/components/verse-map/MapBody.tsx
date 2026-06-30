// verse-map — MapBody (Backlog 4.1, sub-slice 14). Migrated from verse-map.jsx
// (l.345). The orchestrator: owns tourist/overlay/dossier state and composes the
// already-migrated children (LeafletField, FootScrub, PolityTimeline, PoiDossier,
// TouristPanel, MapField). Intel + AI deps arrive via `deps` (injected by VerseMap).
import React, { useCallback, useEffect, useState } from "react";
import { poiGlyph, touristCacheKey } from "./geo.js";
import { readTouristCache, writeTouristCache, parseTouristResponse } from "./tourist.js";
import { MapField } from "./MapField.js";
import { TouristPanel, type TouristData, type TouristPlace, type UserPos } from "./TouristPanel.js";
import { FootScrub } from "./FootScrub.js";
import { PolityTimeline, type TheoryName } from "./PolityTimeline.js";
import { PoiDossier, type Poi } from "./PoiDossier.js";
import { LeafletField } from "./LeafletField.js";
import type { Polity } from "./polity.js";
import type { VerseMapDeps } from "./deps.js";

export interface MapData {
  lat: number;
  lng: number;
  place?: string;
  verseYear?: number;
  pointsOfInterest?: Array<{ name: string; kind?: string; lat?: number; lng?: number; from?: number; to?: number }>;
  polities?: Polity[];
  theoryNames?: TheoryName[];
  modernEquivalent?: string;
  region?: string;
  era?: string;
  century?: string;
  summary?: string;
  populations?: string;
  structures?: string;
  neighbours?: string;
  period?: string;
}

type Overlays = {
  biblical: boolean;
  pilgrimage: boolean;
  manuscripts: boolean;
  empires: boolean;
  mine: boolean;
  resonance: boolean;
  network: boolean;
};

export interface MapBodyProps {
  data: MapData;
  mirrorKey: string;
  refStr: string;
  cur: { bookId: string; chapter: number; verse: number };
  refetching?: boolean;
  softErr?: string | null;
  deps: VerseMapDeps;
}

export function MapBody({ data, mirrorKey, refStr, refetching, softErr, deps }: MapBodyProps): React.ReactElement {
  const [touristOn, setTouristOn] = useState(false);
  const [tourist, setTourist] = useState<TouristData | null>(null);
  const [touristErr, setTouristErr] = useState<string | null>(null);
  const [touristLoading, setTouristLoading] = useState(false);
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<TouristPlace | null>(null);
  const [dossier, setDossier] = useState<Poi | null>(null);

  useEffect(() => {
    const onPoi = (e: Event): void => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.poi) setDossier(detail.poi);
    };
    window.addEventListener("codex:map-poi", onPoi);
    return () => window.removeEventListener("codex:map-poi", onPoi);
  }, []);
  useEffect(() => {
    setDossier(null);
  }, [data.place, data.lat, data.lng]);

  const [overlays, setOverlays] = useState<Overlays>({
    biblical: true,
    pilgrimage: false,
    manuscripts: false,
    empires: false,
    mine: true,
    resonance: false,
    network: false,
  });
  const [discoveredCount, setDiscoveredCount] = useState(() => {
    try {
      return Object.keys(JSON.parse(localStorage.getItem("codex.discovered") || "{}")).length;
    } catch {
      return 0;
    }
  });

  const fetchTourist = useCallback(
    async (pos: UserPos): Promise<void> => {
      setTouristLoading(true);
      setTouristErr(null);
      const cacheKey = touristCacheKey(pos);
      try {
        const cached = readTouristCache(cacheKey, localStorage) as TouristData | null;
        if (cached) {
          setTourist(cached);
          setTouristLoading(false);
          window.dispatchEvent(new CustomEvent("codex:tourist", { detail: { tourist: cached, pos } }));
          return;
        }
        const body = await deps.chat({
          model: "claude-haiku-4-5-20251001",
          system: deps.touristPrompt,
          messages: [
            {
              role: "user",
              content: `User location: lat ${pos.lat.toFixed(4)}, lng ${pos.lng.toFixed(4)} (±${Math.round(pos.accuracy || 0)}m).\nList biblical/historical/sacred-text places within 50 km. Return ONLY the JSON object.`,
            },
          ],
          max_tokens: 2600,
        });
        if (body.error) throw new Error(body.error);
        const obj = parseTouristResponse(String(body.text || "")) as TouristData;
        writeTouristCache(cacheKey, obj, localStorage);
        setTourist(obj);
        setTouristLoading(false);
        window.dispatchEvent(new CustomEvent("codex:tourist", { detail: { tourist: obj, pos } }));
      } catch (e) {
        setTouristErr(String((e as Error).message || e));
        setTouristLoading(false);
      }
    },
    [deps],
  );

  const requestGPS = useCallback((): void => {
    setTouristErr(null);
    if (!navigator.geolocation) {
      setTouristErr("Geolocation not supported on this device.");
      return;
    }
    setTouristLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: UserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setUserPos(p);
        window.dispatchEvent(new CustomEvent("codex:userpos", { detail: p }));
        void fetchTourist(p);
      },
      (err) => {
        setTouristLoading(false);
        setTouristErr(
          err.code === 1
            ? "Location denied. Enable location in your browser to use Tourist mode."
            : `Location unavailable (${err.message || "unknown"}).`,
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [fetchTourist]);

  const onToggleTourist = useCallback((): void => {
    const next = !touristOn;
    setTouristOn(next);
    window.dispatchEvent(new CustomEvent("codex:tourist-mode", { detail: { on: next } }));
    if (next && !userPos) requestGPS();
    else if (next && userPos && !tourist) void fetchTourist(userPos);
  }, [touristOn, userPos, tourist, requestGPS, fetchTourist]);

  const onSelectPlace = useCallback(
    (place: TouristPlace): void => {
      setSelectedPlace(place);
      window.dispatchEvent(new CustomEvent("codex:tourist-select", { detail: { place, from: userPos } }));
    },
    [userPos],
  );

  const onToggleOverlay = useCallback((k: keyof Overlays): void => {
    setOverlays((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      window.dispatchEvent(new CustomEvent("codex:overlays", { detail: { ...next, _changed: k, _on: next[k] } }));
      return next;
    });
  }, []);

  useEffect(() => {
    const onDisc = (): void => {
      try {
        setDiscoveredCount(Object.keys(JSON.parse(localStorage.getItem("codex.discovered") || "{}")).length);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("codex:discovered", onDisc);
    return () => window.removeEventListener("codex:discovered", onDisc);
  }, []);

  const layer = (k: keyof Overlays, title: string, glyph: string): React.ReactElement => (
    <button className={`cx-map-layer ${overlays[k] ? "is-on" : ""}`} onClick={() => onToggleOverlay(k)} title={title}>
      {glyph}
    </button>
  );

  return (
    <div className={`cx-map-body ${touristOn ? "is-tourist" : ""}`}>
      <div className="cx-map-field-wrap">
        <div className="cx-map-controls">
          <button
            className={`cx-map-ctrl cx-map-ctrl-tourist ${touristOn ? "is-on" : ""}`}
            onClick={onToggleTourist}
            title="Tourist mode — show biblical sites near you"
          >
            {touristOn ? "◉ TOURIST" : "○ TOURIST"}
          </button>
          <div className="cx-map-ctrl-layers" role="group" aria-label="Map layers">
            {layer("biblical", "Biblical events", "✦")}
            {layer("pilgrimage", "Pilgrimage routes", "◯")}
            {layer("manuscripts", "Manuscript discoveries", "⬡")}
            {layer("empires", "Empire borders (era)", "☰")}
            {layer("mine", "My discoveries", "⚐")}
            {layer("resonance", "Resonance — Mirror events plotted with arcs", "⌖")}
            {layer("network", "Known sites — every verse you've mapped", "◈")}
          </div>
          <span className="cx-map-discovered" title="Sites you have discovered">
            🏛 {discoveredCount}
          </span>
        </div>
        <LeafletField data={data} mirrorKey={mirrorKey} fmtYear={deps.fmtYear} fetchEmpirePolygon={deps.fetchEmpirePolygon} />

        <div className="cx-mapx-eraglow" aria-hidden="true" />

        {refetching ? (
          <div className="cx-mapx-busy" role="status">
            <span className="cx-mapx-orb" />
            <span>RESOLVING · {refStr}</span>
          </div>
        ) : null}
        {softErr ? (
          <div className="cx-mapx-softerr" role="status" title={softErr}>
            ⚠ MAP ORACLE OFFLINE · showing last fix
          </div>
        ) : null}

        {dossier ? (
          <PoiDossier
            key={(dossier.name || "") + (dossier.lat || "")}
            poi={dossier}
            onClose={() => setDossier(null)}
            resolveWiki={deps.resolvePoiWiki}
            resolveRefs={deps.resolvePoiRefs}
            onGoto={deps.gotoOsis}
            fmtYear={deps.fmtYear}
          />
        ) : null}

        <nav className="cx-mapx-alist-wrap" aria-label="Points of interest">
          <ul className="cx-mapx-alist">
            <li>
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("codex:map-poi", {
                      detail: { poi: { name: data.place, kind: "site", lat: data.lat, lng: data.lng, wiki: "", main: true } },
                    }),
                  );
                  window.dispatchEvent(new CustomEvent("codex:map-fly", { detail: { lat: data.lat, lng: data.lng, zoom: 7 } }));
                }}
              >
                ⌖ {data.place}
              </button>
            </li>
            {(data.pointsOfInterest || []).map((p, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: p } }));
                    window.dispatchEvent(new CustomEvent("codex:map-fly", { detail: { lat: p.lat, lng: p.lng, zoom: 8 } }));
                  }}
                >
                  {poiGlyph(p.kind || "")} {p.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {Array.isArray(data.polities) && data.polities.length > 0 ? (
          <FootScrub key={`${data.place}:${data.lat}`} polities={data.polities} verseYear={data.verseYear} fmtYear={deps.fmtYear} />
        ) : null}

        <div className="cx-map-coords">
          <span>
            <b>LAT</b> {data.lat?.toFixed(3)}°
          </span>
          <span>
            <b>LNG</b> {data.lng?.toFixed(3)}°
          </span>
          <span className="cx-mapx-coords-era" id="cx-map-era" aria-live="polite"></span>
          <span className="cx-map-cursor" id="cx-map-cursor" aria-hidden="true"></span>
        </div>
        {touristOn ? (
          <TouristPanel
            loading={touristLoading}
            err={touristErr}
            tourist={tourist}
            userPos={userPos}
            selected={selectedPlace}
            onSelect={onSelectPlace}
            onRetry={requestGPS}
          />
        ) : null}
      </div>

      <div className="cx-map-info">
        <div className="cx-map-info-place">
          <h3>{data.place}</h3>
          {data.modernEquivalent ? <span className="cx-map-info-modern">today: {data.modernEquivalent}</span> : null}
          {data.region ? <span className="cx-map-info-region">{data.region}</span> : null}
        </div>

        {Array.isArray(data.polities) && data.polities.length > 0 ? (
          <PolityTimeline
            polities={data.polities}
            verseYear={data.verseYear}
            theoryNames={data.theoryNames}
            fmtYear={deps.fmtYear}
            fetchYearContext={deps.fetchYearContext}
          />
        ) : null}

        <div className="cx-map-info-era">
          <span className="cx-map-info-era-tag">ERA</span>
          <span className="cx-map-info-era-name">{data.era}</span>
          {data.century ? <span className="cx-map-info-era-c">· {data.century}</span> : null}
        </div>

        <p className="cx-map-info-summary">{data.summary}</p>

        {data.populations ? <MapField label="POPULATIONS" body={data.populations} /> : null}
        {data.structures ? <MapField label="STRUCTURES" body={data.structures} /> : null}
        {data.neighbours ? <MapField label="NEIGHBOURS" body={data.neighbours} /> : null}
        {data.period ? <MapField label="CLIMATE" body={data.period} /> : null}
      </div>
    </div>
  );
}
