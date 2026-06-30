// reader — "schizo" gematria margin (migrated from components.jsx). Significant
// gematria values get a coloured glow class; single source of truth so VerseRow
// and VerseSideRow agree. schizoCompute reads the runtime gematria engine
// (window.CODEX_GEMATRIA by default, injectable for tests).

export const SCHIZO_SIGNIFICANT: Record<number, string> = {
  666: "rev", 888: "gold", 358: "cyan", 144: "violet", 153: "blue",
  777: "white", 7: "accent", 12: "accent", 40: "accent", 70: "accent",
  1000: "accent", 1776: "accent",
};

export interface GematriaAll {
  hechrachi?: number;
  isopsephy?: number;
  ordinal?: number;
  [k: string]: number | string | undefined;
}
export interface GematriaEngine {
  detectLang(text: string): string;
  all(text: string, lang: string): GematriaAll;
}
export interface SchizoInfo {
  lang: string;
  primaryVal: number;
  primarySys: string;
  all: GematriaAll;
}

interface SchizoWindow {
  CODEX_GEMATRIA?: GematriaEngine;
}

export function schizoCompute(text: string, engine?: GematriaEngine): SchizoInfo | null {
  try {
    const g = engine ?? (window as unknown as SchizoWindow).CODEX_GEMATRIA;
    if (!g || !text) return null;
    const lang = g.detectLang(text);
    const all = g.all(text, lang);
    let primaryVal = 0;
    let primarySys = "";
    if (lang === "hebrew") {
      primaryVal = all.hechrachi ?? 0;
      primarySys = "hechrachi";
    } else if (lang === "greek") {
      primaryVal = all.isopsephy ?? 0;
      primarySys = "isopsephy";
    } else {
      primaryVal = all.ordinal ?? 0;
      primarySys = "ordinal";
    }
    return { lang, primaryVal, primarySys, all };
  } catch {
    return null;
  }
}
