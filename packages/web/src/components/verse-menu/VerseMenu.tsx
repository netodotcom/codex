// verse-menu — MINIMAL BY LAW (migrated faithfully from verse-menu.jsx v11.3).
// In the name of Jesus Christ, may this serve the careful reading of His word.
//
// The omnibar is the point of origin now; this float is only the few
// gestures a reader wants AT the verse, nothing else:
//
//   ref header            — where you are
//   ⚔ ⌬ ◎  verb row       — sword / mirror / map via codex:os-open
//   ✦ MARK                — toggle the highlight
//   ⊕ COMPARE             — the verse across translations
//   ⌘ more…               — opens the omnibar pre-seeded with the ref
//
// Keyboard: Esc closes · ↑/↓ walk the rows · Enter activates.
// Cross-boundary law: drives the app through window.* and events only.
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { vmw } from "./verse-menu-window.js";

// i18n helper — faithful copy of the legacy vmt().
function vmt(k: string, fb?: string): string {
  const t = vmw().t;
  const s = t ? t(k) : null;
  return (s && s !== k) ? s : (fb ?? k);
}

export interface VerseObject {
  n?: number | string;
  [key: string]: unknown;
}

export interface PassageObject {
  book: string;
  bookId?: string;
  chapter: number | string;
}

export interface VerseMenuProps {
  anchor?: DOMRect | null;
  verse?: VerseObject | null;
  passage: PassageObject;
  primary?: unknown;
  currentHighlight?: string | null;
  highlightColor?: string;
  onClose: () => void;
  onToggleHighlight?: (() => void) | null;
}

interface VerbDef {
  kind: string;
  glyph: string;
  label: string;
  title: string;
  depth: string | null;
}

interface PosState {
  top: number;
  left: number;
  side: string;
}

export function VerseMenu({
  anchor,
  verse,
  passage,
  currentHighlight,
  highlightColor,
  onClose,
  onToggleHighlight,
}: VerseMenuProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PosState>({ top: 0, left: 0, side: "right" });

  // Position the menu next to the verse, flipping if it would overflow.
  useLayoutEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 230;
    const h = el.offsetHeight || 190;
    const vw2 = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left = anchor.right + 10;
    let side = "right";
    if (left + w + margin > vw2) {
      left = anchor.left - w - 10;
      side = "left";
      if (left < margin) {
        left = Math.max(margin, Math.min(vw2 - w - margin, anchor.left));
        side = "below";
      }
    }
    let top = anchor.top;
    if (side === "below") top = anchor.bottom + 8;
    if (top + h + margin > vh) top = Math.max(margin, vh - h - margin);
    if (top < margin) top = margin;
    setPos({ top, left, side });
  }, [anchor]);

  // A11y — restore focus to the opener on close.
  const triggerRef = useRef<Element | null | false>(null);
  if (triggerRef.current === null) {
    try { triggerRef.current = document.activeElement; } catch (_) { triggerRef.current = false; }
  }

  const close = (): void => {
    try {
      const el = triggerRef.current;
      if (el && typeof (el as HTMLElement).focus === "function" && document.contains(el)) {
        (el as HTMLElement).focus();
      }
    } catch (_) {}
    onClose();
  };

  // Focus the first row on open; Esc closes; ↑/↓ walk every actionable
  // control (verb buttons + rows) in document order.
  useEffect(() => {
    try {
      const first = ref.current?.querySelector<HTMLElement>(".cx-vm-verb, .cx-vm-row");
      if (first) first.focus();
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const root = ref.current;
      if (!root) return;
      e.preventDefault();
      const items = Array.from(root.querySelectorAll<HTMLElement>(".cx-vm-verb, .cx-vm-row"));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown"
        ? (items[Math.min(items.length - 1, i + 1)] ?? items[0])
        : (items[Math.max(0, i - 1)] ?? items[items.length - 1]);
      try { if (next) next.focus(); } catch (_) {}
    };
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node | null)) close();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return (): void => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const refStr = `${passage.book} ${passage.chapter}:${verse?.n ?? "?"}`;
  const depthRef = `${passage.book}.${passage.chapter}.${verse?.n ?? ""}`;

  const emitDepth = (type: string, weight: number): void => {
    try {
      window.dispatchEvent(new CustomEvent("codex:depth-action", { detail: { type, ref: depthRef, weight } }));
    } catch (_) {}
  };

  const osOpen = (kind: string, depthType?: string | null): void => {
    if (depthType) emitDepth(depthType, 2);
    try { window.dispatchEvent(new CustomEvent("codex:os-open", { detail: { kind, ref: refStr } })); } catch (_) {}
    close();
  };

  const VERBS: VerbDef[] = [
    { kind: "sword", glyph: "⚔", label: "SWORD", title: "Sword — fourfold edge · pardes × quadriga", depth: "sword-cleave" },
    { kind: "mirror", glyph: "⌬", label: "MIRROR", title: vmt("vm.mirror", "Mirror — the verse across every translation"), depth: null },
    { kind: "map", glyph: "◎", label: "MAP", title: vmt("vm.map", "Map — place · era · timeline"), depth: "map-place-study" },
  ];

  return (
    <div
      ref={ref}
      className={`cx-vm cx-vm-min cx-vm-${pos.side}`}
      style={{ top: pos.top + "px", left: pos.left + "px" }}
      role="menu"
      aria-label={`Verse menu — ${refStr}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cx-vm-head">
        <span className="cx-vm-ref">{refStr}</span>
        <button className="cx-vm-x" onClick={close} aria-label="Close">×</button>
      </div>

      <div className="cx-vm-body">
        {/* the verb row — sword / mirror / map */}
        <div className="cx-vm-verbs" role="group" aria-label="Depth verbs">
          {VERBS.map(v => (
            <button key={v.kind} className="cx-vm-verb" role="menuitem"
                    title={v.title} onClick={() => osOpen(v.kind, v.depth)}>
              <i aria-hidden={true}>{v.glyph}</i><span>{v.label}</span>
            </button>
          ))}
        </div>

        <button
          className={`cx-vm-row ${currentHighlight ? "is-on" : ""}`}
          role="menuitem"
          onClick={() => { if (onToggleHighlight) onToggleHighlight(); close(); }}
        >
          <span className="cx-vm-icon">{currentHighlight ? "✓" : "✦"}</span>
          <span className="cx-vm-lbl">{currentHighlight ? vmt("vm.unmark", "UNMARK") : vmt("vm.mark", "MARK")}</span>
          <span className="cx-vm-sub">{currentHighlight ? currentHighlight : (highlightColor || "amber")}</span>
        </button>

        <button className="cx-vm-row" role="menuitem" onClick={() => osOpen("compare")}>
          <span className="cx-vm-icon">⊕</span>
          <span className="cx-vm-lbl">{vmt("vm.compare", "COMPARE")}</span>
          <span className="cx-vm-sub">all translations</span>
        </button>

        <button
          className="cx-vm-row"
          role="menuitem"
          onClick={() => { close(); const o = vmw().codexOpenOmni; if (o) o(`${refStr} `); }}
        >
          <span className="cx-vm-icon">⌘</span>
          <span className="cx-vm-lbl">more…</span>
          <span className="cx-vm-sub">everything, via the omnibar</span>
        </button>
      </div>
    </div>
  );
}
