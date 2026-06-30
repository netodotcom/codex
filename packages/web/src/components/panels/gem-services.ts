// panels — gematria runtime services (Backlog 4.1). The window boundary for the
// gematria UI: the cross-reference index (built from the user's cached verses),
// reader navigation, Strong's open, the engagement bus, and the kabbalah map
// fetch. The pure value math comes from @codex/core; only these runtime hooks
// touch window. Injected into the gematria components so they stay testable.
import { bookById } from "@codex/core/data";

export interface GemMatch {
  ref: string;
  word: string;
  system: string;
}

export interface GematriaIndexService {
  ensure(): Promise<void>;
  find(value: number, opts?: { system?: string }): GemMatch[];
}

export interface KabSefirah {
  value: number;
  name: string;
  translit: string;
  meaning: string;
  n: number;
  color?: string;
  world?: string;
  body?: string;
}

export interface KabConcept {
  category: string;
  concept: string;
}

export interface KabMap {
  value_to_concept?: Record<string, KabConcept>;
  sefirot?: KabSefirah[];
  concepts?: Record<string, { name: string; hebrew?: string; meaning?: string; source?: string }>;
  partzufim?: Array<{ name: string; translit?: string; sefirah?: string; polarity?: string }>;
}

export interface GemServices {
  index: GematriaIndexService | null;
  jumpRef(ref: string): void;
  openStrongs(word: string): void;
  emitDepth(type: string, ref: string, weight: number): void;
  loadKabMap(): Promise<KabMap | null>;
}

interface GemWindow {
  CODEX_GEMATRIA_INDEX?: GematriaIndexService;
  CODEX_StrongsLookup?: (word: string) => { id?: string } | null;
  codexJumpToRef?: (ref: string) => void;
  __CODEX_KAB__?: KabMap;
}
function gw(): GemWindow {
  return window as unknown as GemWindow;
}

export function createGemServices(): GemServices {
  return {
    index: gw().CODEX_GEMATRIA_INDEX ?? null,
    jumpRef(ref) {
      const jump = gw().codexJumpToRef;
      if (!jump) return;
      const parts = ref.split(".");
      if (parts.length < 3) {
        jump(ref);
        return;
      }
      const book = bookById(parts[0] ?? "");
      jump(`${book?.name || parts[0]} ${parts[1]}:${parts[2]}`);
    },
    openStrongs(word) {
      if (!word) return;
      try {
        const lex = gw().CODEX_StrongsLookup;
        if (typeof lex === "function") {
          const hit = lex(word);
          if (hit?.id) {
            window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { strongs: hit.id } }));
            return;
          }
        }
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("codex:strongs-open", { detail: { query: word, strongs: word } }));
    },
    emitDepth(type, ref, weight) {
      try {
        window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type, ref, weight, domain: null } }));
      } catch {
        /* best-effort */
      }
    },
    async loadKabMap() {
      const cached = gw().__CODEX_KAB__;
      if (cached) return cached;
      try {
        const r = await fetch("data/modules/kabbalah-mappings.json");
        if (r.ok) {
          const j = (await r.json()) as KabMap;
          gw().__CODEX_KAB__ = j;
          return j;
        }
      } catch {
        /* offline */
      }
      return null;
    },
  };
}
