// marketplace — pure helpers (migrated from marketplace.jsx).
// Formatting and category derivation. Pure and ground-truth tested.

export interface ModuleForCategory {
  category?: string;
  type?: string;
}

export function fmtSize(kb: number | null | undefined): string {
  if (!kb && kb !== 0) return "—";
  if (kb < 1024) return kb + " KB";
  return (kb / 1024).toFixed(1) + " MB";
}

export function fmtDate(ts: string | number | null | undefined): string {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString(); } catch { return "—"; }
}

export function typeBadge(t: string | null | undefined): string {
  return (t || "module").toUpperCase().replace("-", " ");
}

export function CategoryFromIndex(m: ModuleForCategory): string {
  if (m.category) return m.category;
  switch ((m.type || "").toLowerCase()) {
    case "lexicon":
    case "concordance":
      return "lexicons";
    case "cross-reference":
      return "cross-refs";
    case "commentary":
      return "commentaries";
    case "reading-plan":
      return "plans";
    case "dictionary":
      return "dictionaries";
    case "map-overlay":
      return "maps";
    case "timeline":
      return "timelines";
    default:
      return "other";
  }
}
