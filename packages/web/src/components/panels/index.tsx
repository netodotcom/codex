// panels — migrated feature entry (Backlog 4.1). Replaces dist/panels.js in the
// Vite build (gen-web-entry maps it). Re-exposes the same window globals the
// legacy panels.jsx did so app.jsx / winhost / mobile keep rendering them. The
// migrated panels take injected services; thin wrappers here supply those from
// window (CODEX_PANELS, gematria index) so the call sites stay unchanged.
import React, { useMemo } from "react";
import "./translations-dl.js"; // side-effect: registers window.CODEX_TP + CODEX_TRANS_STATE
import { railTabs, codexOpenPanel, PluginPanelHost } from "./host.js";
import { LeftRailResizer } from "./rail.js";
import { createGemServices } from "./gem-services.js";
import { TalmudPanel } from "./TalmudPanel.js";
import { CommentaryPanel } from "./CommentaryPanel.js";
import { GnosisPanel } from "./GnosisPanel.js";
import { DisarmPanel } from "./DisarmPanel.js";
import { GematriaPanel as GematriaPanelBase } from "./GematriaPanel.js";
import { ExegesisPanel as ExegesisPanelBase, type ExegesisService, type ExegesisData, type ExegPassage } from "./ExegesisPanel.js";
import {
  TranslationAnalysisPanel as TxPanelBase,
  type TxAnalysisService,
  type TxAnalysisData,
  type TransItem,
  type TxPassage,
} from "./TranslationAnalysisPanel.js";
import type { PanelProps } from "./types.js";

interface CodexPanelsApi {
  getExegesisCached?(k: string): ExegesisData | null;
  getExegesisMeta?(k: string): { fetchedAt: number } | null;
  loadExegesis(k: string, opts: { passageLabel: string; provider?: string; model?: string; force?: boolean }): Promise<ExegesisData>;
  purgeExegesis?(k: string): void;
  getTxAnalysisCached?(k: string, ids: string[]): TxAnalysisData | null;
  getTxAnalysisMeta?(k: string, ids: string[]): { fetchedAt: number } | null;
  loadTranslationAnalysis(k: string, list: TransItem[], opts: { passageLabel: string; provider?: string; model?: string; force?: boolean }): Promise<TxAnalysisData>;
  purgeTxAnalysis?(k: string, ids: string[]): void;
}
function panelsApi(): CodexPanelsApi {
  return (window as unknown as { CODEX_PANELS?: CodexPanelsApi }).CODEX_PANELS as CodexPanelsApi;
}

// GematriaPanel: inject the runtime gematria services (index/strongs/kab/nav).
function GematriaPanel(props: PanelProps): React.ReactElement {
  const services = useMemo(() => createGemServices(), []);
  return <GematriaPanelBase {...props} services={services} />;
}

function exegesisService(): ExegesisService {
  const P = panelsApi();
  return {
    getCached: (k) => P?.getExegesisCached?.(k) ?? null,
    getMeta: (k) => P?.getExegesisMeta?.(k) ?? null,
    load: (k, opts) => P.loadExegesis(k, opts),
    purge: (k) => P?.purgeExegesis?.(k),
  };
}
function ExegesisPanel(props: { passage: ExegPassage; currentVerse?: number }): React.ReactElement {
  const service = useMemo(() => exegesisService(), []);
  return <ExegesisPanelBase {...props} service={service} />;
}

function txAnalysisService(): TxAnalysisService {
  const P = panelsApi();
  return {
    getCached: (k, ids) => P?.getTxAnalysisCached?.(k, ids) ?? null,
    getMeta: (k, ids) => P?.getTxAnalysisMeta?.(k, ids) ?? null,
    load: (k, list, opts) => P.loadTranslationAnalysis(k, list, opts),
    purge: (k, ids) => P?.purgeTxAnalysis?.(k, ids),
  };
}
function TranslationAnalysisPanel(props: {
  passage: TxPassage;
  currentVerse?: number;
  primary: string;
  compareSet?: string[];
  onJumpRef?: (ref: string) => void;
}): React.ReactElement {
  const service = useMemo(() => txAnalysisService(), []);
  return <TxPanelBase {...props} service={service} />;
}

Object.assign(window, {
  LeftRailResizer,
  PluginPanelHost,
  TalmudPanel,
  CommentaryPanel,
  GematriaPanel,
  GnosisPanel,
  DisarmPanel,
  ExegesisPanel,
  TranslationAnalysisPanel,
  railTabs,
  codexOpenPanel,
});
