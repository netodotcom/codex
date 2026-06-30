// reels — card renderers, feed, actions, and panel wrapper (faithfully ported
// from reels.jsx). The panel mounts as a portal to document.body via
// window.ReactDOM.createPortal (same as v1 — escapes the rail's clipping
// context). No CSS self-injection: the legacy relied on styles.css.
import React from "react";
import {
  State, emitDepth, refillDeck, restoreDeck, cardKey,
} from "./data.js";
import type { ReelCard, NavCtx } from "./reels-window.js";
import { rw } from "./reels-window.js";
import { TYPE_LABELS, refLabel, navigateToAnchor } from "./helpers.js";

// ── Card components ──────────────────────────────────────────────────────────

interface CardProps {
  card: ReelCard;
}

function CardArtVerse({ card }: CardProps): React.ReactElement {
  return (
    <div className="cx-reel cx-reel-art" style={{ background: card.hue }}>
      {card.image ? (
        <img className="cx-reel-hero" src={card.image} alt={card.title} loading="lazy" />
      ) : null}
      <div className="cx-reel-art-grad" />
      <div className="cx-reel-art-meta">
        <div className="cx-reel-art-title">{card.title}</div>
        <div className="cx-reel-art-artist">
          {card.artist ?? ""}{card.year ? ` · ${String(card.year)}` : ""}
        </div>
      </div>
      <div className="cx-reel-art-verse">
        <div className="cx-reel-art-ref">{refLabel(card.anchor)}</div>
        {card.body ? <p>{card.body}</p> : null}
      </div>
    </div>
  );
}

function CardLightVerse({ card }: CardProps): React.ReactElement {
  return (
    <div className="cx-reel cx-reel-light" style={{ background: card.hue || "#06080e" }}>
      <div className="cx-reel-light-text">{card.body}</div>
      <div className="cx-reel-light-ref">{refLabel(card.anchor)}</div>
    </div>
  );
}

function CardSymbol({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-symbol"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-symbol-glyph">{card.glyph || "◊"}</div>
      <div className="cx-reel-symbol-title">{card.title}</div>
      <p className="cx-reel-symbol-body">{card.body}</p>
      <div className="cx-reel-symbol-ref">{refLabel(card.anchor)}</div>
    </div>
  );
}

function CardNameOfGod({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-name"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-name-hebrew">{card.title}</div>
      <p className="cx-reel-name-body">{card.body}</p>
      <div className="cx-reel-name-ref">{refLabel(card.anchor)}</div>
    </div>
  );
}

function CardDidYouKnow({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-fact"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-fact-label">DID YOU KNOW</div>
      <div className="cx-reel-fact-title">{card.title}</div>
      <p className="cx-reel-fact-body">{card.body}</p>
      {card.anchor ? (
        <div className="cx-reel-fact-ref">{refLabel(card.anchor)}</div>
      ) : null}
    </div>
  );
}

function CardParable({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-parable"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-parable-label">A PARABLE IN THREE SENTENCES</div>
      <div className="cx-reel-parable-title">{card.title}</div>
      <p className="cx-reel-parable-body">{card.body}</p>
      <div className="cx-reel-parable-ref">{refLabel(card.anchor)}</div>
    </div>
  );
}

function CardProphecyPair({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-prophecy"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-prophecy-title">{card.title}</div>
      <div className="cx-reel-prophecy-half">
        <div className="cx-reel-prophecy-tag">PROPHECY · {refLabel(card.anchor)}</div>
        <p>{card.prophecy}</p>
      </div>
      <div className="cx-reel-prophecy-arrow">↓</div>
      <div className="cx-reel-prophecy-half is-fulfilled">
        <div className="cx-reel-prophecy-tag">
          FULFILLED · {refLabel(card.fulfillment)}
        </div>
        <p>{card.fulfillment_text}</p>
      </div>
    </div>
  );
}

function CardCounting({ card }: CardProps): React.ReactElement {
  return (
    <div
      className="cx-reel cx-reel-count"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-count-num">{card.title}</div>
      <p className="cx-reel-count-body">{card.body}</p>
    </div>
  );
}

function CardQuestion({ card }: CardProps): React.ReactElement {
  const [revealed, setRevealed] = React.useState(false);
  // Resolving a question is a genuine depth action ("find/question" card
  // resolved). Log it as a discovery (weight 2, cross-cutting / no domain).
  // Only on the explicit reveal tap, never on mount/scroll.
  const resolve = (): void => {
    setRevealed(true);
    emitDepth(
      "discovery-logged",
      card.anchor || (card.id ? "reel:" + card.id : null),
      2,
      null,
    );
  };
  return (
    <div
      className="cx-reel cx-reel-q"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-q-label">QUESTION</div>
      <div className="cx-reel-q-text">{card.question}</div>
      {revealed ? (
        <p className="cx-reel-q-answer">{card.answer}</p>
      ) : (
        <button type="button" className="cx-reel-q-reveal" onClick={resolve}>
          tap to reveal
        </button>
      )}
      {card.anchor ? (
        <div className="cx-reel-q-ref">{refLabel(card.anchor)}</div>
      ) : null}
    </div>
  );
}

function CardQuest({ card }: CardProps): React.ReactElement {
  // Picking up a quest-tease is a genuine depth action: the reader is opening
  // a thread. Emit on the explicit tap only (never on scroll/view), then try
  // to start a matching curated quest if the engine exposes one, and follow
  // the passage. All engine calls guarded for Lite/offline.
  const openThread = (): void => {
    emitDepth("quest-step", card.questId || card.id || card.anchor || null, 3, null);
    try {
      const eng = rw().CODEX_ENGAGEMENT;
      const qid = card.questId || card.id;
      if (
        qid && eng &&
        typeof eng.questState === "function" &&
        typeof eng.startQuest === "function"
      ) {
        const st = eng.questState(qid);
        if (!st || st.status === "available") {
          Promise.resolve(eng.startQuest(qid)).catch(() => {});
        }
      }
    } catch {}
    if (card.anchor) navigateToAnchor(card.anchor);
  };
  return (
    <div
      className="cx-reel cx-reel-quest"
      style={{ "--card-hue": card.hue } as React.CSSProperties}
    >
      <div className="cx-reel-quest-label">A QUEST</div>
      <button
        type="button"
        className="cx-reel-quest-tap"
        onClick={openThread}
        title="Open this thread"
      >
        <div className="cx-reel-quest-title">{card.title}</div>
        <p className="cx-reel-quest-body">{card.body}</p>
      </button>
      <div className="cx-reel-quest-ref">{refLabel(card.anchor)}</div>
    </div>
  );
}

const CARD_RENDERERS: Record<string, React.ComponentType<CardProps>> = {
  "art-verse":     CardArtVerse,
  "light-verse":   CardLightVerse,
  "symbol":        CardSymbol,
  "name-of-god":   CardNameOfGod,
  "did-you-know":  CardDidYouKnow,
  "parable-3":     CardParable,
  "prophecy-pair": CardProphecyPair,
  "counting":      CardCounting,
  "question":      CardQuestion,
  "quest-tease":   CardQuest,
};

// ── ReelActions ──────────────────────────────────────────────────────────────

interface ReelActionsProps {
  card: ReelCard;
  onClose?: () => void;
}

function ReelActions({ card, onClose }: ReelActionsProps): React.ReactElement {
  const ENG = rw().CODEX_ENGAGE ?? null;
  const [liked, setLiked] = React.useState<boolean>(() => {
    try { return !!(ENG && ENG.isReelLiked && ENG.isReelLiked(card)); } catch { return false; }
  });

  const toast = (msg: string, kind?: string): void => {
    try {
      window.dispatchEvent(
        new CustomEvent("codex:toast", { detail: { msg, kind: kind ?? "ok" } }),
      );
    } catch {}
  };

  // LIKE — records the explicit taste signal and, if the card points at a
  // passage, also bookmarks it. Works on every card type.
  const like = (): void => {
    let res: { liked: boolean } = { liked: !liked };
    try { if (ENG && ENG.toggleReelLike) res = ENG.toggleReelLike(card); } catch {}
    setLiked(res.liked);
    if (res.liked && card.anchor) {
      try {
        const list = JSON.parse(
          localStorage.getItem("codex.bookmarks") || "[]",
        ) as Array<{ ref: string; kind: string; title: string; at: number }>;
        if (!list.some((b) => b.ref === card.anchor && b.kind === "reel")) {
          list.push({
            ref: card.anchor,
            kind: "reel",
            title: card.title || card.type,
            at: Date.now(),
          });
          localStorage.setItem("codex.bookmarks", JSON.stringify(list));
          window.dispatchEvent(
            new CustomEvent("codex:bookmark-added", {
              detail: { ref: card.anchor, title: card.title || card.type },
            }),
          );
        }
      } catch {}
    }
    toast(res.liked ? "♥ Liked — your feed will lean this way" : "Removed from likes");
  };

  const openPassage = (): void => {
    // Genuine depth action: the reader is following the card's thread into
    // the passage. crossref-follow type (weight 1, cross-references).
    if (card.anchor) emitDepth("crossref-follow", card.anchor, 1, "cross-references");
    navigateToAnchor(card.anchor);
    if (onClose) onClose();
  };

  // SHARE — native share sheet when available (mobile + supported desktop),
  // clipboard fallback otherwise, with explicit feedback either way.
  const share = async (): Promise<void> => {
    const text = [
      card.title,
      card.body || card.question || "",
      card.anchor ? `— ${refLabel(card.anchor)}` : "",
      "",
      "✦ via CODEX",
    ].filter(Boolean).join("\n");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: card.title || "CODEX", text });
        return; // native sheet handled it
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // user dismissed — silent
      // otherwise fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard");
    } catch {
      toast("Share unavailable here", "warn");
    }
  };

  const Toggle = rw().CODEX_NormieToggle;
  const normieText = card.body || card.fulfillment_text;

  return (
    <div className="cx-reel-actions">
      <button
        type="button"
        className={`cx-reel-act ${liked ? "is-liked" : ""}`}
        onClick={like}
        title={liked ? "Unlike" : "Like — show me more like this"}
        aria-pressed={liked}
      >{liked ? "♥" : "♡"}</button>
      <button
        type="button"
        className="cx-reel-act"
        onClick={openPassage}
        title="Open passage"
        disabled={!card.anchor}
      >📖</button>
      {Toggle && normieText
        ? <Toggle text={normieText} scope={`reel-${card.type}`} />
        : null}
      <button
        type="button"
        className="cx-reel-act"
        onClick={() => { void share(); }}
        title="Share"
      >⤴</button>
    </div>
  );
}

// ── ReelsFeed ────────────────────────────────────────────────────────────────

export interface ReelsFeedProps {
  ctx: NavCtx;
  fullscreen?: boolean;
  onClose?: () => void;
}

export function ReelsFeed({ ctx, fullscreen, onClose }: ReelsFeedProps): React.ReactElement {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const bump = (): void => { force((n) => n + 1); };
    State.listeners.add(bump);
    restoreDeck();
    if (State.deck.length < 10) refillDeck(ctx, 30).catch(() => {});
    return (): void => { State.listeners.delete(bump); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeIdx, setActiveIdx] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Watch for scroll-snap position.
  const onScroll = React.useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;
    const cardH = el.clientHeight;
    const idx = Math.round(el.scrollTop / cardH);
    if (idx !== activeIdx) {
      setActiveIdx(idx);
      rw().CODEX_ENGAGE?.trackReel?.();
    }
    // Refill near the end.
    if (idx > State.deck.length - 8) {
      refillDeck(ctx, State.deck.length + 20).catch(() => {});
    }
  }, [activeIdx, ctx]);

  // Keyboard nav. Resolve the scroller INSIDE the handler — on first render
  // the deck is still loading, so scrollRef.current is null and an early-return
  // here would mean Escape never binds (the deps never change).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = scrollRef.current;
      if (
        e.key === "ArrowDown" || e.key === "PageDown" ||
        e.key === " " || e.key === "j"
      ) {
        if (!el) return;
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
      } else if (
        e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k"
      ) {
        if (!el) return;
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
      } else if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return (): void => { window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  if (!State.deck.length) {
    return <div className="cx-reels-empty">loading the feed…</div>;
  }

  return (
    <div className={`cx-reels ${fullscreen ? "is-fullscreen" : ""}`}>
      {fullscreen && onClose ? (
        <button
          type="button"
          className="cx-reels-close"
          onClick={onClose}
          aria-label="Close reels"
        >✕</button>
      ) : null}
      <div className="cx-reels-scroll" ref={scrollRef} onScroll={onScroll}>
        {State.deck.map((card, i) => {
          const Renderer = CARD_RENDERERS[card.type] ?? CardLightVerse;
          return (
            <section
              key={cardKey(card) + ":" + String(i)}
              className="cx-reels-slot"
              aria-label={card.title || card.type}
            >
              <div className="cx-reel-typebadge">{TYPE_LABELS[card.type] ?? "◌"}</div>
              <Renderer card={card} />
              <ReelActions card={card} onClose={onClose} />
            </section>
          );
        })}
      </div>
      <div className="cx-reels-dots" aria-hidden="true">
        {State.deck.slice(0, 10).map((_, i) => (
          <span
            key={i}
            className={`cx-reels-dot ${i === activeIdx ? "is-on" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── ReelsPanel ───────────────────────────────────────────────────────────────

// Reels is fullscreen ONLY. When the panel tab mounts, we immediately pop the
// fullscreen overlay; the in-panel area is just a thin launcher so the user
// can re-open after dismissing without leaving the tab.
export function ReelsPanel(ctx: NavCtx): React.ReactElement {
  const [fs, setFs] = React.useState(true);
  React.useEffect(() => { setFs(true); }, []);
  // Closing reels returns to reading: drop fullscreen AND ask the host to
  // close the rails, so we don't leave an open rail behind a dimmed scrim
  // (the "exit reels leaves the screen dimmed, needs an extra click" bug).
  const closeFs = (): void => {
    setFs(false);
    try { window.dispatchEvent(new CustomEvent("codex:close-rails")); } catch {}
  };

  // Render the overlay through a portal to document.body so it escapes
  // every parent stacking context / transform / clip (the right-rail
  // panel was clipping the "fullscreen" overlay on some viewports).
  const overlay: React.ReactElement | null = fs ? (
    <div
      className="cx-reels-overlay"
      role="dialog"
      aria-label="Reels fullscreen"
      onClick={(e) => { if (e.target === e.currentTarget) closeFs(); }}
    >
      <ReelsFeed ctx={ctx} fullscreen={true} onClose={closeFs} />
    </div>
  ) : null;

  const body = document.body;
  const reactDOM = rw().ReactDOM;
  const portal: React.ReactNode =
    overlay && reactDOM?.createPortal && body
      ? reactDOM.createPortal(overlay, body)
      : overlay;

  return (
    <div className="cx-reels-pane">
      <div className="cx-reels-head">
        <span className="cx-reels-title">REELS</span>
        <span
          className="cx-reels-sub"
          style={{ opacity: 0.6, fontSize: "11px", marginLeft: "8px" }}
        >fullscreen only</span>
        <button
          type="button"
          className="cx-reels-fs"
          onClick={() => { setFs(true); }}
          title="Open reels"
        >⛶ Open</button>
      </div>
      {portal}
    </div>
  );
}
