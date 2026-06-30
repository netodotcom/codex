// verse-map — injected dependencies (Backlog 4.1). The intel/AI/nav functions the
// legacy reached via window (CODEX_INTEL, /api/chat, codexGoto). Threaded through
// MapBody → children so the whole feature is decoupled and testable. VerseMap
// supplies the real implementations when it mounts.
import type { YearContext } from "./PolityTimeline.js";
import type { EmpirePolygon } from "./LeafletField.js";
import type { WikiInfo, PoiRefs, Poi } from "./PoiDossier.js";

export interface ChatResponse {
  text?: string;
  error?: string;
  status?: number;
}

export interface VerseMapDeps {
  /** intel year formatter (CODEX_INTEL.intelFmtYear) */
  fmtYear(year: number): string;
  /** POST /api/chat → provider-agnostic envelope */
  chat(body: unknown): Promise<ChatResponse>;
  /** system prompt for Tourist-mode place discovery */
  touristPrompt: string;
  fetchYearContext(year: number): Promise<YearContext>;
  fetchEmpirePolygon(lat: number, lng: number, year: number): Promise<EmpirePolygon | null>;
  resolvePoiWiki(poi: Poi): Promise<WikiInfo>;
  resolvePoiRefs(poi: Poi): Promise<PoiRefs>;
  /** navigate the reader to an OSIS ref (codexGoto/codexJumpToRef) */
  gotoOsis(osis: string): void;
}
