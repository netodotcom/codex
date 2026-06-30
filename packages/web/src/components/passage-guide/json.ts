// passage-guide — tolerant JSON extraction (migrated verbatim from
// passage-guide.jsx; mirrors panels-gen smartRepair/extractJSON). Pure logic,
// ground-truth tested. The drafter sometimes returns fenced / truncated JSON;
// smartRepair walks the string tracking the last "safe" cut and closes any open
// brackets so a partial chapter guide still parses.

export interface GuideOutline {
  title?: string;
  range?: string;
  summary?: string;
  [k: string]: unknown;
}
export interface GuideTheme {
  name?: string;
  verse_anchor?: number;
  [k: string]: unknown;
}
export interface GuideKeyWord {
  word?: string;
  original?: string;
  translit?: string;
  verse_anchor?: number;
  strongs?: string;
  [k: string]: unknown;
}
export interface Guide {
  _schema?: number;
  overview?: string;
  outline?: GuideOutline[];
  themes?: GuideTheme[];
  key_words?: GuideKeyWord[];
  historical_context?: string;
  synthesis?: string;
  _provider?: string;
  _model?: string | null;
  [k: string]: unknown;
}

export function smartRepair(s: string): string {
  let inString = false,
    escape = false;
  const stk: string[] = [];
  let lastSafe = 0,
    safeStack: string[] = [];
  const mark = (idx: number): void => {
    lastSafe = idx;
    safeStack = stk.slice();
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        mark(i + 1);
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") stk.push("}");
    else if (c === "[") stk.push("]");
    else if (c === "}" || c === "]") {
      stk.pop();
      mark(i + 1);
    } else if (c === ",") mark(i);
    else if (/[\d.eE+-]/.test(c)) mark(i + 1);
    else if (/[a-zA-Z]/.test(c)) mark(i + 1);
  }
  let head = s.slice(0, lastSafe).replace(/[,\s]+$/, "");
  head = head.replace(/,?\s*"[^"]*"\s*:\s*$/, "");
  return head + safeStack.reverse().join("");
}

export function extractJSON(text: string): unknown {
  if (!text) throw new Error("empty response");
  const s = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i === -1) throw new Error("no json object found");
  const candidate = j > i ? s.slice(i, j + 1) : s.slice(i);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    /* fall through to repair */
  }
  try {
    return JSON.parse(smartRepair(s.slice(i)));
  } catch (e) {
    try {
      return JSON.parse(smartRepair(candidate));
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      throw new Error("could not repair JSON: " + msg);
    }
  }
}

export function validate(input: unknown): Guide {
  if (!input || typeof input !== "object") throw new Error("not an object");
  const obj = input as Guide;
  obj._schema = 1;
  obj.overview = obj.overview || "";
  obj.outline = Array.isArray(obj.outline) ? obj.outline.slice(0, 8) : [];
  obj.themes = Array.isArray(obj.themes) ? obj.themes.slice(0, 8) : [];
  obj.key_words = Array.isArray(obj.key_words) ? obj.key_words.slice(0, 8) : [];
  obj.historical_context = obj.historical_context || "";
  obj.synthesis = obj.synthesis || "";
  obj.outline = obj.outline.filter((s) => s && (s.title || s.summary));
  obj.themes = obj.themes.filter((t) => t && t.name);
  obj.key_words = obj.key_words.filter((w) => w && w.word);
  return obj;
}
