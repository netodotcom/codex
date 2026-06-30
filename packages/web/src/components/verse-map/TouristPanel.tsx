// verse-map — TouristPanel (Backlog 4.1, sub-slice 5). Migrated faithfully from
// verse-map.jsx (l.1646). Presentational: renders the "PLACES NEAR YOU" list.
import React from "react";

export interface TouristPlace {
  name: string;
  distance_km?: number;
  era?: string;
  summary?: string;
  biblical_refs?: string[];
}

export interface TouristData {
  your_location?: string;
  places?: TouristPlace[];
  if_you_only_have_an_hour?: string;
  deeper_rabbit_hole?: string;
}

export interface UserPos {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface TouristPanelProps {
  loading: boolean;
  err: string | null;
  tourist: TouristData | null;
  userPos: UserPos | null;
  selected: TouristPlace | null;
  onSelect(place: TouristPlace): void;
  onRetry(): void;
}

export function TouristPanel({
  loading,
  err,
  tourist,
  userPos,
  selected,
  onSelect,
  onRetry,
}: TouristPanelProps): React.ReactElement {
  return (
    <div className="cx-tourist-panel">
      <div className="cx-tourist-h">
        <span className="cx-tourist-tag">PLACES NEAR YOU</span>
        {userPos ? (
          <span className="cx-tourist-pos">
            {userPos.lat.toFixed(3)}, {userPos.lng.toFixed(3)} ±{Math.round(userPos.accuracy || 0)}m
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="cx-tourist-loading">scanning 50 km radius for sacred sites…</div>
      ) : err ? (
        <div className="cx-tourist-err">
          <p>{err}</p>
          <button onClick={onRetry}>Retry</button>
        </div>
      ) : tourist ? (
        <>
          <div className="cx-tourist-here">📍 {tourist.your_location || "—"}</div>
          <ul className="cx-tourist-list">
            {(tourist.places || []).map((p, i) => (
              <li
                key={i}
                className={selected && selected.name === p.name ? "is-selected" : ""}
                onClick={() => onSelect(p)}
                role="button"
                tabIndex={0}
              >
                <div className="cx-tplace-h">
                  <span className="cx-tplace-name">{p.name}</span>
                  {p.distance_km != null ? <span className="cx-tplace-d">{p.distance_km.toFixed(1)} km</span> : null}
                </div>
                <div className="cx-tplace-era">{p.era}</div>
                <p className="cx-tplace-sum">{p.summary}</p>
                {Array.isArray(p.biblical_refs) && p.biblical_refs.length ? (
                  <div className="cx-tplace-refs">
                    {p.biblical_refs.slice(0, 3).map((r, j) => (
                      <code key={j}>{r}</code>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {tourist.if_you_only_have_an_hour ? (
            <div className="cx-tourist-hour">
              <b>If you only have an hour</b>
              <p>{tourist.if_you_only_have_an_hour}</p>
            </div>
          ) : null}
          {tourist.deeper_rabbit_hole ? (
            <div className="cx-tourist-hole">
              <b>Deeper rabbit hole</b>
              <p>{tourist.deeper_rabbit_hole}</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="cx-tourist-empty">
          <p>Tourist mode reveals biblical sites around your current location.</p>
          <button onClick={onRetry}>Enable location</button>
        </div>
      )}
    </div>
  );
}
