// verse-map — POI / Tourist popup HTML builders (Backlog 4.1, sub-slice 7).
//
// Extracted from verse-map.jsx (poiPopupHtml l.1171, touristPopupHtml l.1615).
// Pure string builders. The legacy delegated escaping to window.CODEX_INTEL;
// here we inline the standard HTML escape (the MutationObserver hydration that
// consumes these strings stays in the component/legacy layer).
import { poiGlyph } from "./geo.js";

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export interface PoiPopup {
  name?: string;
  kind?: string;
  from?: number;
  to?: number;
  wiki?: string;
}

export function poiPopupHtml(p: PoiPopup): string {
  const glyph = poiGlyph(p.kind || "");
  const yrRange =
    typeof p.from === "number" && typeof p.to === "number"
      ? `<span class="cx-poi-pop-yr">${p.from < 0 ? Math.abs(p.from) + " BCE" : p.from + " CE"} – ${
          p.to < 0 ? Math.abs(p.to) + " BCE" : p.to + " CE"
        }</span>`
      : "";
  return `
    <div class="cx-poi-pop"
         data-pending-fetch="1"
         data-wiki="${escapeHtml(p.wiki || "")}"
         data-name="${escapeHtml(p.name || "")}"
         data-kind="${escapeHtml(p.kind || "place")}">
      <div class="cx-poi-pop-img" data-pending="1">
        <span class="cx-poi-pop-glyph">${glyph}</span>
      </div>
      <h4 class="cx-poi-pop-title">${escapeHtml(p.name)}</h4>
      <div class="cx-poi-pop-meta">
        <span class="cx-poi-pop-kind">${escapeHtml((p.kind || "place").toUpperCase())}</span>
        ${yrRange}
      </div>
      <p class="cx-poi-pop-body">…</p>
      <a class="cx-poi-pop-more" href="" target="_blank" rel="noopener noreferrer" hidden>open on wikipedia ↗</a>
    </div>`;
}

export interface TouristPopupPlace {
  name?: string;
  era?: string;
  distance_km?: number;
  summary?: string;
  things_to_see?: string[];
  best_at?: string;
  walking_route_hint?: string;
  biblical_refs?: string[];
}

export function touristPopupHtml(pl: TouristPopupPlace): string {
  const things = Array.isArray(pl.things_to_see)
    ? pl.things_to_see
        .slice(0, 4)
        .map((t) => `<li>${escapeHtml(t)}</li>`)
        .join("")
    : "";
  const refs =
    Array.isArray(pl.biblical_refs) && pl.biblical_refs.length
      ? `<div class="cx-tpop-refs">${pl.biblical_refs
          .slice(0, 4)
          .map((r) => `<code>${escapeHtml(r)}</code>`)
          .join(" ")}</div>`
      : "";
  return `<div class="cx-tpop">
    <h4>${escapeHtml(pl.name || "")}</h4>
    <div class="cx-tpop-meta">${escapeHtml(pl.era || "")}${pl.distance_km != null ? ` · ${pl.distance_km.toFixed(1)} km` : ""}</div>
    <p>${escapeHtml(pl.summary || "")}</p>
    ${things ? `<ul class="cx-tpop-things">${things}</ul>` : ""}
    ${pl.best_at ? `<div class="cx-tpop-tip"><b>Best at:</b> ${escapeHtml(pl.best_at)}</div>` : ""}
    ${pl.walking_route_hint ? `<div class="cx-tpop-tip"><b>Route:</b> ${escapeHtml(pl.walking_route_hint)}</div>` : ""}
    ${refs}
    <button class="cx-tpop-tts" onclick="window.codexSpeak(this.parentNode.querySelector('p').textContent)">▶ PLAY TOUR</button>
  </div>`;
}
