// help — typed window boundary (migrated from help.jsx). The Help Wiki reads two
// runtime globals: the registered i18n languages (CODEX_LANGS) and the active UI
// language (CODEX_LANG). Centralise the typing here, exactly like reader-window.ts.
export interface CodexLangDef {
  id?: string;
  label?: string;
}

export interface HelpWindow {
  CODEX_LANGS?: CodexLangDef[];
  CODEX_LANG?: string;
}

export function hw(): HelpWindow {
  return window as unknown as HelpWindow;
}
