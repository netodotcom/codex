// verse-map — LeafletField (Backlog 4.1, sub-slice 13: the big imperative shell).
//
// Migrated faithfully from verse-map.jsx (l.618). Imperative Leaflet: owns the
// map, markers, overlay layers, popups and the window-event bus wiring. Verified
// by the integration probe (not unit tests — it manipulates the DOM directly).
// Pure helpers come from geo/popups/sites; fmtYear + the AI empire-polygon fetch
// are injected.
import React, { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { haversineKm, poiGlyph, poiSignificance } from "./geo.js";
import { escapeHtml, touristPopupHtml } from "./popups.js";
import { BIBLE_SITES, MANUSCRIPT_SITES, PILGRIM_ROUTES } from "./sites.js";

type Leaflet = typeof LType;

interface CodexWindow {
  L?: Leaflet;
  __CODEX_MAP_ERA?: { name?: string } | null;
  __CODEX_MAP_CAM?: { lat: number; lng: number; zoom: number; at: number };
  CODEX_ENGAGEMENT?: {
    emit?: (type: string, ref: string, weight: number, domain: unknown) => void;
    record?: (e: { type: string; ref: string; weight: number; domain: unknown }) => void;
  };
}
function win(): CodexWindow {
  return window as unknown as CodexWindow;
}
function getL(): Leaflet | null {
  return win().L ?? null;
}
function prefersReducedMotion(): boolean {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

export interface MapPoi {
  name: string;
  kind?: string;
  lat?: number;
  lng?: number;
  from?: number;
  to?: number;
  wiki?: string;
}

export interface MapData {
  lat: number;
  lng: number;
  place?: string;
  verseYear?: number;
  pointsOfInterest?: MapPoi[];
}

export interface EmpirePolygon {
  name: string;
  note?: string;
  coords: Array<[number, number]>;
}

interface DiscoveredSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  refs?: string[];
  narrative?: string;
  at?: number;
}

export interface LeafletFieldProps {
  data: MapData;
  mirrorKey: string;
  fmtYear(year: number): string;
  fetchEmpirePolygon(lat: number, lng: number, year: number): Promise<EmpirePolygon | null>;
}

type LayerMap = Record<string, LType.Layer | null>;

export function LeafletField({ data, mirrorKey, fmtYear, fetchEmpirePolygon }: LeafletFieldProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layersRef = useRef<LayerMap>({ poi: null, marker: null, tile: null });
  const [year, setYear] = useState(typeof data.verseYear === "number" ? data.verseYear : 0);
  const dark = !!document.querySelector(".cx-app.is-dark");

  function addTiles(map: LType.Map, isDark: boolean): void {
    const L = getL();
    if (!L) return;
    const url = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const prev = layersRef.current["tile"];
    if (prev) map.removeLayer(prev);
    layersRef.current["tile"] = L.tileLayer(url, { maxZoom: 18, subdomains: "abcd", crossOrigin: true }).addTo(map);
  }

  function addMainMarker(map: LType.Map, d: MapData): void {
    const L = getL();
    if (!L) return;
    const prev = layersRef.current["marker"];
    if (prev) map.removeLayer(prev);
    const icon = L.divIcon({
      className: "cx-map-mark-leaflet",
      html: `<span class="cx-mark-sweep"></span><span class="cx-mark-pulse"></span><span class="cx-mark-core"></span><span class="cx-mark-lbl">${escapeHtml((d.place || "").toUpperCase())}</span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    const grp = L.layerGroup().addTo(map);
    [100, 500, 1500].forEach((km) => {
      L.circle([d.lat, d.lng], {
        radius: km * 1000,
        color: "#7ee0ff",
        weight: 0.7,
        opacity: 0.28,
        fill: false,
        dashArray: "2 7",
        interactive: false,
        className: "cx-map-ring",
      }).addTo(grp);
    });
    const mk = L.marker([d.lat, d.lng], { icon, riseOnHover: true }).addTo(grp);
    mk.on("click", () => {
      window.dispatchEvent(
        new CustomEvent("codex:map-poi", {
          detail: { poi: { name: d.place, kind: "site", lat: d.lat, lng: d.lng, wiki: "", main: true } },
        }),
      );
    });
    layersRef.current["marker"] = grp;
  }

  function redrawPOIs(map: LType.Map, d: MapData, currentYear: number): void {
    const L = getL();
    if (!L) return;
    const prev = layersRef.current["poi"];
    if (prev) map.removeLayer(prev);
    const group = L.layerGroup();
    (d.pointsOfInterest || []).forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      if (typeof p.from === "number" && currentYear < p.from) return;
      if (typeof p.to === "number" && currentYear > p.to) return;
      const glyph = poiGlyph(p.kind || "");
      const sig = poiSignificance(p.kind || "");
      const icon = L.divIcon({
        className: `cx-map-poi-leaflet kind-${p.kind || "default"} cx-mapx-sig-${sig}`,
        html: `<span class="cx-mapx-poi-pulse"></span><span class="cx-poi-dot"></span><span class="cx-poi-lbl">${glyph} ${escapeHtml(p.name)}</span>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const marker = L.marker([p.lat, p.lng], { icon, riseOnHover: true }).addTo(group);
      marker.on("click", () => window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: p } })));
    });
    group.addTo(map);
    layersRef.current["poi"] = group;
  }

  // Initialise once
  useEffect(() => {
    const L = getL();
    if (!wrapRef.current || mapRef.current || !L) return;
    const map = L.map(wrapRef.current, {
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: false,
      preferCanvas: true,
    });
    map.setView([data.lat, data.lng], 5);
    L.control
      .attribution({ prefix: false })
      .addAttribution('© <a href="https://openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">Carto</a>')
      .addTo(map);
    mapRef.current = map;
    addTiles(map, dark);
    addMainMarker(map, data);
    redrawPOIs(map, data, year);

    map.on("mousemove", (e: LType.LeafletMouseEvent) => {
      const el = document.getElementById("cx-map-cursor");
      if (!el) return;
      const km = haversineKm(data.lat, data.lng, e.latlng.lat, e.latlng.lng);
      const era = win().__CODEX_MAP_ERA?.name ? ` · ${win().__CODEX_MAP_ERA?.name}` : "";
      el.textContent = `⌖ ${e.latlng.lat.toFixed(3)}°, ${e.latlng.lng.toFixed(3)}° · ${km < 10 ? km.toFixed(1) : Math.round(km)} km out${era}`;
    });
    map.on("mouseout", () => {
      const el = document.getElementById("cx-map-cursor");
      if (el) el.textContent = "";
    });
    const publishCam = (): void => {
      try {
        const c = map.getCenter();
        win().__CODEX_MAP_CAM = { lat: c.lat, lng: c.lng, zoom: map.getZoom(), at: Date.now() };
      } catch {
        /* ignore */
      }
    };
    map.on("move", publishCam);
    map.on("zoomend", publishCam);
    publishCam();
    const onFlyReq = (e: Event): void => {
      const d = (e as CustomEvent).detail || {};
      if (typeof d.lat !== "number" || typeof d.lng !== "number") return;
      const z = typeof d.zoom === "number" ? d.zoom : Math.max(map.getZoom(), 7);
      if (prefersReducedMotion()) map.setView([d.lat, d.lng], z);
      else map.flyTo([d.lat, d.lng], z, { duration: 1.1, easeLinearity: 0.2 });
    };
    window.addEventListener("codex:map-fly", onFlyReq);
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.removeEventListener("codex:map-fly", onFlyReq);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch — swap tile layer
  useEffect(() => {
    if (mapRef.current) addTiles(mapRef.current, dark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // Cinematic fly-to when the verse moves under an open map
  const firstFlight = useRef(true);
  useEffect(() => {
    if (!mapRef.current) return;
    if (firstFlight.current) {
      firstFlight.current = false;
      return;
    }
    if (prefersReducedMotion()) mapRef.current.setView([data.lat, data.lng], 5);
    else mapRef.current.flyTo([data.lat, data.lng], 5, { duration: 1.8, easeLinearity: 0.18 });
    addMainMarker(mapRef.current, data);
    redrawPOIs(mapRef.current, data, year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lat, data.lng, data.place]);

  // Year-slider broadcasts from PolityTimeline
  useEffect(() => {
    const onYr = (e: Event): void => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.year === "number") {
        setYear(detail.year);
        if (mapRef.current) redrawPOIs(mapRef.current, data, detail.year);
      }
    };
    window.addEventListener("codex:year", onYr);
    return () => window.removeEventListener("codex:year", onYr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Tourist + overlays + discoveries — listen to MapBody's events.
  useEffect(() => {
    const layers = layersRef.current;
    const L = getL();
    if (!L) return;

    const ensureLayer = (key: string): LType.LayerGroup | null => {
      if (!mapRef.current) return null;
      if (!layers[key]) layers[key] = L.layerGroup().addTo(mapRef.current);
      return layers[key] as LType.LayerGroup;
    };
    const clearLayer = (key: string): void => {
      const lyr = layers[key];
      if (lyr && mapRef.current) {
        mapRef.current.removeLayer(lyr);
        layers[key] = null;
      }
    };

    const readDiscovered = (): Record<string, DiscoveredSite> => {
      try {
        return JSON.parse(localStorage.getItem("codex.discovered") || "{}") as Record<string, DiscoveredSite>;
      } catch {
        return {};
      }
    };

    const onPos = (e: Event): void => {
      const p = (e as CustomEvent).detail;
      if (!p || !mapRef.current) return;
      clearLayer("user");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["user"] = grp;
      const userIcon = L.divIcon({
        className: "cx-map-user",
        html: '<span class="cx-user-core"></span><span class="cx-user-pulse"></span><span class="cx-user-lbl">YOU</span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([p.lat, p.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(grp);
      L.circle([p.lat, p.lng], { radius: Math.min(p.accuracy || 100, 2000), color: "#7cf", weight: 1, opacity: 0.4, fillOpacity: 0.05 }).addTo(grp);
      mapRef.current.flyTo([p.lat, p.lng], 10, { duration: 0.9 });
    };

    const onTourist = (e: Event): void => {
      const { tourist, pos } = (e as CustomEvent).detail || {};
      if (!tourist || !mapRef.current) return;
      clearLayer("tourist");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["tourist"] = grp;
      const places: Array<Record<string, unknown>> = Array.isArray(tourist.places) ? tourist.places : [];
      places.forEach((pl) => {
        if (typeof pl["lat"] !== "number" || typeof pl["lng"] !== "number") return;
        const icon = L.divIcon({
          className: "cx-map-tourist-pin",
          html: `<span class="cx-tpin-glyph">⛪</span><span class="cx-tpin-lbl">${escapeHtml(pl["name"])}</span><span class="cx-tpin-dist">${pl["distance_km"] != null ? (pl["distance_km"] as number).toFixed(1) + " km" : ""}</span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const m = L.marker([pl["lat"] as number, pl["lng"] as number], { icon, riseOnHover: true })
          .bindPopup(touristPopupHtml(pl), { maxWidth: 280, className: "cx-poi-popup cx-tourist-pop" })
          .addTo(grp);
        m.on("click", () => window.dispatchEvent(new CustomEvent("codex:tourist-select", { detail: { place: pl, from: pos } })));
      });
    };

    const onSelect = (e: Event): void => {
      const { place, from } = (e as CustomEvent).detail || {};
      if (!place || !mapRef.current) return;
      clearLayer("breadcrumbs");
      if (from && typeof place.lat === "number") {
        const line = L.polyline(
          [
            [from.lat, from.lng],
            [place.lat, place.lng],
          ],
          { color: "#7cf", weight: 2, opacity: 0.7, dashArray: "6 8", className: "cx-map-breadcrumb" },
        );
        layers["breadcrumbs"] = L.layerGroup([line]).addTo(mapRef.current);
        const b = L.latLngBounds([
          [from.lat, from.lng],
          [place.lat, place.lng],
        ]).pad(0.4);
        mapRef.current.flyToBounds(b, { duration: 0.9, maxZoom: 11 });
      } else {
        mapRef.current.flyTo([place.lat, place.lng], 11, { duration: 0.9 });
      }
    };

    const onTouristMode = (e: Event): void => {
      if (!(e as CustomEvent).detail?.on) {
        ["tourist", "breadcrumbs", "discoverable", "discovered"].forEach(clearLayer);
      } else {
        drawDiscoverables();
        drawDiscovered();
      }
    };

    const onOverlays = (e: Event): void => {
      const o = (e as CustomEvent).detail || {};
      if (!o.mine) clearLayer("discovered");
      else drawDiscovered();
      if (!o.pilgrimage) clearLayer("pilgrimage");
      else drawPilgrimage();
      if (!o.manuscripts) clearLayer("manuscripts");
      else drawManuscripts();
      if (!o.empires) clearLayer("empires");
      else void drawEmpires(year);
      if (!o.resonance) clearLayer("resonance");
      else drawResonance();
      if (!o.network) clearLayer("network");
      else drawNetwork();
      const poiLayer = layers["poi"];
      if (poiLayer && mapRef.current) {
        if (o.biblical) {
          try {
            poiLayer.addTo(mapRef.current);
          } catch {
            /* ignore */
          }
        } else {
          try {
            mapRef.current.removeLayer(poiLayer);
          } catch {
            /* ignore */
          }
        }
      }
      if (o._changed && o._on && mapRef.current) {
        const groupKey = (
          { mine: "discovered", pilgrimage: "pilgrimage", manuscripts: "manuscripts", empires: "empires", biblical: "poi", resonance: "resonance", network: "network" } as Record<string, string>
        )[o._changed];
        const label = (
          {
            mine: "⚐ My discoveries",
            pilgrimage: "◯ Pilgrimage routes",
            manuscripts: "⬡ Manuscript sites",
            empires: "☰ Empire borders",
            biblical: "✦ Biblical events",
            resonance: "⌖ Resonance events",
            network: "◈ Known sites",
          } as Record<string, string>
        )[o._changed];
        const toast = (msg: string, kind = "ok"): void => {
          try {
            window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } }));
          } catch {
            /* ignore */
          }
        };
        const fit = (): void => {
          const grp = groupKey ? layers[groupKey] : null;
          const feats =
            grp && typeof (grp as LType.LayerGroup).getLayers === "function" ? (grp as LType.LayerGroup).getLayers() : [];
          if (!feats.length) {
            toast(`${label}: none in this view`, "warn");
            return;
          }
          try {
            const b = L.featureGroup(feats).getBounds();
            if (b && b.isValid && b.isValid()) mapRef.current?.fitBounds(b, { maxZoom: 6, padding: [40, 40] });
          } catch {
            /* ignore */
          }
          toast(`${label}: ${feats.length} shown`);
        };
        if (o._changed === "empires") {
          toast(`${label}: drawing…`);
          setTimeout(fit, 600);
        } else fit();
      }
    };

    const onDiscovered = (): void => {
      drawDiscovered();
      drawDiscoverables();
    };

    function drawDiscoverables(): void {
      if (!mapRef.current || !L) return;
      clearLayer("discoverable");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["discoverable"] = grp;
      const userMarker = layers["user"] as LType.LayerGroup | null;
      const userLatLng = userMarker?.getLayers?.()[0] as LType.Marker | undefined;
      const userLL = userLatLng?.getLatLng?.();
      const disc = readDiscovered();
      BIBLE_SITES.forEach((s) => {
        if (disc[s.id]) return;
        const near = userLL ? haversineKm(userLL.lat, userLL.lng, s.lat, s.lng) <= 1 : false;
        const icon = L.divIcon({
          className: `cx-map-disc ${near ? "is-near" : ""}`,
          html: near
            ? `<span class="cx-disc-pulse"></span><span class="cx-disc-lbl">DISCOVERABLE · ${escapeHtml(s.name)}</span>`
            : `<span class="cx-disc-dot"></span>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });
        const m = L.marker([s.lat, s.lng], { icon }).addTo(grp);
        m.on("click", () => void discoverSite(s, userLL ?? null));
      });
    }
    function drawDiscovered(): void {
      if (!mapRef.current || !L) return;
      clearLayer("discovered");
      const disc = readDiscovered();
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["discovered"] = grp;
      Object.values(disc).forEach((s) => {
        const icon = L.divIcon({
          className: "cx-map-mine",
          html: `<span class="cx-mine-flag">⚐</span><span class="cx-mine-lbl">${escapeHtml(s.name)}</span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(
            `<div class="cx-mine-pop"><b>${escapeHtml(s.name)}</b><p>${escapeHtml(s.narrative || "")}</p>${s.refs ? `<small>${escapeHtml(s.refs.join(", "))}</small>` : ""}<button class="cx-mine-tts" onclick="window.codexSpeak(this.parentNode.querySelector('p').textContent)">▶ PLAY TOUR</button></div>`,
          )
          .addTo(grp);
      });
    }
    function drawPilgrimage(): void {
      if (!mapRef.current || !L) return;
      clearLayer("pilgrimage");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["pilgrimage"] = grp;
      PILGRIM_ROUTES.forEach((r) => {
        L.polyline(r.path, { color: r.color || "#d1a45a", weight: 2.5, opacity: 0.7, dashArray: "2 6" })
          .bindPopup(`<b>${escapeHtml(r.name)}</b><br><small>${escapeHtml(r.note || "")}</small>`)
          .addTo(grp);
      });
    }
    function drawManuscripts(): void {
      if (!mapRef.current || !L) return;
      clearLayer("manuscripts");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["manuscripts"] = grp;
      MANUSCRIPT_SITES.forEach((s) => {
        const icon = L.divIcon({
          className: "cx-map-ms",
          html: `<span class="cx-ms-glyph">⬡</span><span class="cx-ms-lbl">${escapeHtml(s.name)}</span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([s.lat, s.lng], { icon }).bindPopup(`<b>${escapeHtml(s.name)}</b><br><small>${escapeHtml(s.note || "")}</small>`).addTo(grp);
      });
    }
    async function drawEmpires(yr: number): Promise<void> {
      if (!mapRef.current || !L) return;
      clearLayer("empires");
      try {
        const c = mapRef.current.getCenter();
        const poly = await fetchEmpirePolygon(c.lat, c.lng, yr);
        if (!poly || !poly.coords) return;
        const grp = L.layerGroup().addTo(mapRef.current);
        layers["empires"] = grp;
        L.polygon(poly.coords, { color: "#b88cff", weight: 1.5, opacity: 0.7, fillOpacity: 0.08, dashArray: "4 4" })
          .bindPopup(`<b>${escapeHtml(poly.name)}</b><br><small>${escapeHtml(poly.note || "")} · ${fmtYear(yr)}</small>`)
          .addTo(grp);
      } catch {
        /* ignore */
      }
    }
    function drawResonance(): void {
      if (!mapRef.current || !L) return;
      clearLayer("resonance");
      let mirror: Record<string, unknown> | null = null;
      try {
        const raw = localStorage.getItem(mirrorKey);
        if (raw) mirror = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const evs: Array<Record<string, unknown>> = mirror
        ? [
            ...((mirror["historicalParallels"] as Array<Record<string, unknown>>) || []).map(
              (e): Record<string, unknown> => ({ ...e, _kind: "hist" }),
            ),
            ...((mirror["modernResonances"] as Array<Record<string, unknown>>) || []).map(
              (e): Record<string, unknown> => ({ ...e, _kind: "mod" }),
            ),
          ].filter((e) => typeof e["lat"] === "number" && typeof e["lng"] === "number")
        : [];
      if (!evs.length) {
        try {
          window.dispatchEvent(
            new CustomEvent("codex:toast", {
              detail: {
                msg: mirror
                  ? "⌖ Resonance: this Mirror analysis predates geo intel — reopen MIRROR and tap ⟲ UPGRADE INTEL"
                  : "⌖ Resonance: open MIRROR on this verse first — its analysis feeds this layer",
                kind: "warn",
              },
            }),
          );
        } catch {
          /* ignore */
        }
        return;
      }
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["resonance"] = grp;
      evs.forEach((ev) => {
        const color = ev["_kind"] === "mod" ? "#e8b465" : "#7ee0ff";
        const pts: Array<[number, number]> = [];
        const N = 48;
        const evLat = ev["lat"] as number;
        const evLng = ev["lng"] as number;
        const dLat = evLat - data.lat;
        const dLng = evLng - data.lng;
        const span = Math.hypot(dLat, dLng);
        const bow = Math.min(14, span * 0.18);
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          pts.push([data.lat + dLat * t + Math.sin(Math.PI * t) * bow, data.lng + dLng * t]);
        }
        L.polyline(pts, { color, weight: 1.4, opacity: 0.65, dashArray: "1 6", className: "cx-map-resarc", interactive: false }).addTo(grp);
        const icon = L.divIcon({
          className: `cx-map-res ${ev["_kind"] === "mod" ? "is-mod" : ""}`,
          html: `<span class="cx-res-dot"></span><span class="cx-res-lbl">${escapeHtml(ev["place"] || ev["event"] || "")}</span>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([evLat, evLng], { icon, riseOnHover: true })
          .bindPopup(
            `<div class="cx-res-pop"><b>${escapeHtml(ev["event"] || "")}</b>` +
              `<div class="cx-res-pop-meta">${escapeHtml(fmtYear(ev["year"] as number))} · ${escapeHtml(ev["place"] || "")}` +
              `${typeof ev["intensity"] === "number" ? ` · resonance ${ev["intensity"]}/100` : ""}</div>` +
              `<p>${escapeHtml(ev["connection"] || "")}</p></div>`,
            { maxWidth: 280, className: "cx-poi-popup" },
          )
          .addTo(grp);
      });
    }
    function drawNetwork(): void {
      if (!mapRef.current || !L) return;
      clearLayer("network");
      const sites: Array<{ lat: number; lng: number; place: string; ref: string }> = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith("codex.maps.")) continue;
          try {
            const d = JSON.parse(localStorage.getItem(k) || "{}") as { lat?: number; lng?: number; place?: string };
            if (typeof d.lat !== "number" || typeof d.lng !== "number") continue;
            const ref = k.slice("codex.maps.".length).split(".");
            sites.push({ lat: d.lat, lng: d.lng, place: d.place || "", ref: `${ref[0]} ${ref[1]}:${ref[2]}` });
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      const seen = new Map<string, { lat: number; lng: number; place: string; refs: string[] }>();
      sites.forEach((s) => {
        const key2 = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
        const existing = seen.get(key2);
        if (existing) existing.refs.push(s.ref);
        else seen.set(key2, { lat: s.lat, lng: s.lng, place: s.place, refs: [s.ref] });
      });
      const grp = L.layerGroup().addTo(mapRef.current);
      layers["network"] = grp;
      seen.forEach((s) => {
        const isHere = Math.abs(s.lat - data.lat) < 0.05 && Math.abs(s.lng - data.lng) < 0.05;
        if (!isHere) {
          L.polyline(
            [
              [data.lat, data.lng],
              [s.lat, s.lng],
            ],
            { color: "#7ee0ff", weight: 0.6, opacity: 0.18, interactive: false },
          ).addTo(grp);
        }
        const icon = L.divIcon({
          className: "cx-map-net",
          html: `<span class="cx-net-dot"></span>${s.refs.length > 1 ? `<span class="cx-net-n">${s.refs.length}</span>` : ""}`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(
            `<div class="cx-res-pop"><b>${escapeHtml(s.place)}</b>` +
              `<div class="cx-res-pop-meta">${s.refs.length} verse${s.refs.length > 1 ? "s" : ""} studied here</div>` +
              `<p>${escapeHtml(s.refs.slice(0, 8).join(" · "))}${s.refs.length > 8 ? " …" : ""}</p></div>`,
            { maxWidth: 260, className: "cx-poi-popup" },
          )
          .addTo(grp);
      });
    }

    function notifyEngagementDiscovery(site: DiscoveredSite): void {
      try {
        const ref = "site:" + (site.id || site.name || "");
        const eng = win().CODEX_ENGAGEMENT;
        if (eng && typeof eng.emit === "function") {
          eng.emit("discovery-logged", ref, 2, null);
          return;
        }
        if (eng && typeof eng.record === "function") {
          eng.record({ type: "discovery-logged", ref, weight: 2, domain: null });
          return;
        }
        window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type: "discovery-logged", ref, weight: 2, domain: null } }));
      } catch {
        /* best-effort */
      }
    }

    async function discoverSite(s: { id: string; name: string; lat: number; lng: number; refs?: string[]; note?: string }, _userLatLng: LType.LatLng | null): Promise<void> {
      const disc = readDiscovered();
      if (disc[s.id]) return;
      const entry: DiscoveredSite = { id: s.id, name: s.name, lat: s.lat, lng: s.lng, refs: s.refs || [], narrative: "Discovering…", at: Date.now() };
      disc[s.id] = entry;
      localStorage.setItem("codex.discovered", JSON.stringify(disc));
      window.dispatchEvent(new CustomEvent("codex:discovered", { detail: { site: entry } }));
      notifyEngagementDiscovery(entry);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            system:
              "You are CODEX DISCOVERY. The user is physically present at a biblical site. Write a single short evocative paragraph (60-90 words) in second person ('You are standing where…'), naming the verse references, what happened here, and one sensory detail of the place today. No fences. No headings. Just prose.",
            messages: [{ role: "user", content: `Site: ${s.name}\nRefs: ${(s.refs || []).join(", ")}\nNotes: ${s.note || ""}` }],
            max_tokens: 240,
          }),
        });
        const body = (await r.json()) as { text?: string };
        entry.narrative = (body.text || "").trim() || "Discovered.";
      } catch {
        entry.narrative = `Discovered ${s.name}.`;
      }
      disc[s.id] = entry;
      localStorage.setItem("codex.discovered", JSON.stringify(disc));
      window.dispatchEvent(new CustomEvent("codex:discovered", { detail: { site: entry } }));
    }

    void ensureLayer; // reserved for future on-demand layers (parity with legacy)

    window.addEventListener("codex:userpos", onPos);
    window.addEventListener("codex:tourist", onTourist);
    window.addEventListener("codex:tourist-select", onSelect);
    window.addEventListener("codex:tourist-mode", onTouristMode);
    window.addEventListener("codex:overlays", onOverlays);
    window.addEventListener("codex:discovered", onDiscovered);
    return () => {
      window.removeEventListener("codex:userpos", onPos);
      window.removeEventListener("codex:tourist", onTourist);
      window.removeEventListener("codex:tourist-select", onSelect);
      window.removeEventListener("codex:tourist-mode", onTouristMode);
      window.removeEventListener("codex:overlays", onOverlays);
      window.removeEventListener("codex:discovered", onDiscovered);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, year, mirrorKey]);

  if (!getL()) {
    return <div className="cx-map-fallback">Leaflet failed to load — check your network and reload.</div>;
  }
  return <div ref={wrapRef} className="cx-map-leaflet" />;
}
