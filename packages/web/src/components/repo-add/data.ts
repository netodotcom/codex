// repo-add — catalog of known remote Bible repositories and shared domain types.
// Migrated verbatim from legacy/repo-add.jsx PROVIDER_CATALOG + Repo shape.

export interface CatalogEntry {
  id: string;
  name: string;
  year: string;
  apiId: string;
  lang?: string;
}

// Shape stored to localStorage and pushed into CODEX_DATA.translations.
// The index signature mirrors RepoAddTranslation (CODEX_DATA.translations is a
// loose record): a Repo is one such translation, so it carries the same shape.
export interface Repo {
  id: string;
  name: string;
  year: string;
  license: string;
  glyph: string;
  lang: string;
  source: string;
  apiId: string;
  [key: string]: unknown;
}

// Known providers · catalog of common ids the search auto-completes against.
export const PROVIDER_CATALOG: Record<string, CatalogEntry[]> = {
  bolls: [
    { id: "nasb",  name: "New American Standard",   year: "2020", apiId: "NASB" },
    { id: "niv",   name: "New International",       year: "1984", apiId: "NIV" },
    { id: "nkjv",  name: "New King James",          year: "1982", apiId: "NKJV" },
    { id: "esv",   name: "English Standard",        year: "2001", apiId: "ESV" },
    { id: "nlt",   name: "New Living",              year: "2015", apiId: "NLT" },
    { id: "csb",   name: "Christian Standard",      year: "2017", apiId: "CSB" },
    { id: "amp",   name: "Amplified",               year: "2015", apiId: "AMP" },
    { id: "msg",   name: "The Message",             year: "2002", apiId: "MSG" },
    { id: "net",   name: "NET",                     year: "2017", apiId: "NET" },
    { id: "lsv",   name: "Literal Standard",        year: "2020", apiId: "LSV" },
    { id: "rv",    name: "Revised",                 year: "1885", apiId: "RV1885" },
    { id: "web2",  name: "WEB (Bolls)",             year: "2000", apiId: "WEB" },
    { id: "lxx",   name: "Septuagint (Greek)",      year: "3rd c. BC", apiId: "LXX", lang: "GR" },
    { id: "tr",    name: "Textus Receptus",         year: "1550", apiId: "TR", lang: "GR" },
    { id: "wlc",   name: "Westminster Leningrad",   year: "2008", apiId: "WLC", lang: "HE" },
  ],
  "bible-api": [
    { id: "bbe",       name: "Basic English",            year: "1949", apiId: "bbe" },
    { id: "webbe",     name: "WEB · British",            year: "2000", apiId: "webbe" },
    { id: "oeb-cw",   name: "Open English (CW)",        year: "2014", apiId: "oeb-cw" },
    { id: "cherokee", name: "Cherokee NT",               year: "1860", apiId: "cherokee", lang: "CHR" },
    { id: "almeida",  name: "João Ferreira Almeida",    year: "1819", apiId: "almeida", lang: "PT" },
  ],
};
