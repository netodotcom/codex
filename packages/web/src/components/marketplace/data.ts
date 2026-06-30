// marketplace — data layer (migrated from marketplace.jsx).
// Module interfaces, category definitions, and the curated index loader.

export const INDEX_URL = "data/module-index.json";

export interface Category {
  id: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: "all",          label: "All" },
  { id: "lexicons",     label: "Lexicons" },
  { id: "cross-refs",   label: "Cross-Refs" },
  { id: "commentaries", label: "Commentaries" },
  { id: "plans",        label: "Reading Plans" },
  { id: "dictionaries", label: "Dictionaries" },
  { id: "maps",         label: "Maps" },
  { id: "timelines",    label: "Timelines" },
  { id: "languages",    label: "Language Packs" },
  { id: "devotionals",  label: "Devotionals" },
];

export interface IndexModule {
  id: string;
  name: string;
  type?: string;
  category?: string;
  description?: string;
  author?: string;
  license?: string;
  size_kb?: number;
  version?: string;
  url?: string;
  featured?: boolean;
  _status?: string;
}

export interface IndexData {
  modules?: IndexModule[];
  updated?: string;
}

export interface InstalledModule {
  id: string;
  name?: string;
  type?: string;
  version?: string;
  installedAt?: string | number;
}

// Module-scope singleton — mirrors the legacy `let _indexPromise = null`.
let _indexPromise: Promise<IndexData> | null = null;

export function loadIndex(): Promise<IndexData> {
  if (_indexPromise) return _indexPromise;
  _indexPromise = fetch(INDEX_URL, { credentials: "same-origin" })
    .then((r): Promise<IndexData> => {
      if (!r.ok) throw new Error("index fetch " + r.status);
      return r.json() as Promise<IndexData>;
    })
    .catch((e: unknown) => {
      _indexPromise = null;
      throw e;
    });
  return _indexPromise;
}
