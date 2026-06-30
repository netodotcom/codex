// app — first-run tour + engagement welcome-back card (migrated from app.jsx).
import React from "react";
import { aw } from "./app-window.js";

const wi = (i: number): React.CSSProperties => ({ ["--cx-w-i" as string]: i }) as React.CSSProperties;

export function WelcomeTour({ onClose }: { onClose: () => void }): React.ReactElement {
  const [step, setStep] = React.useState(0);
  const total = 4;
  const next = React.useCallback(() => {
    setStep((s) => (s >= total - 1 ? (onClose(), s) : s + 1));
  }, [onClose]);
  const prev = React.useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, prev, onClose]);

  const openSettings = (): void => {
    try {
      window.dispatchEvent(new CustomEvent("codex:open-settings", { detail: { section: "api-keys" } }));
    } catch {
      /* ignore */
    }
    next();
  };

  const renderStep = (): React.ReactElement => {
    if (step === 0) {
      return (
        <div className="cx-welcome-stage cx-welcome-stage--hero">
          <p className="cx-welcome-eyebrow" style={wi(0)}>scripture · study · terminal</p>
          <h1 className="cx-welcome-wordmark" style={wi(1)}>CODEX</h1>
          <div className="cx-welcome-scripture" style={wi(2)}>
            <p className="cx-welcome-scripture-greek" lang="grc">Ἐν ἀρχῇ ἦν ὁ Λόγος</p>
            <p className="cx-welcome-scripture-en">In the beginning was the Word.</p>
          </div>
          <p className="cx-welcome-prompt" style={wi(3)}>
            <span>press</span>
            <kbd>↵</kbd>
            <span>to enter study</span>
            <span className="cx-welcome-caret" aria-hidden="true">▍</span>
          </p>
        </div>
      );
    }
    if (step === 1) {
      const pairs = [
        { keys: ["⌘", "K"], label: "Library · command palette" },
        { keys: ["/"], label: "Smart search · jump anywhere" },
        { keys: ["J", "K"], label: "Next / previous verse" },
        { keys: ["←", "→"], label: "Previous / next chapter · or swipe" },
        { keys: ["?"], label: "Every shortcut" },
      ];
      return (
        <div className="cx-welcome-stage">
          <p className="cx-welcome-eyebrow" style={wi(0)}>02 · keystrokes</p>
          <h2 className="cx-welcome-headline2" style={wi(1)}>Reach anything, instantly.</h2>
          <ul className="cx-welcome-keylist" style={wi(2)}>
            {pairs.map((p, i) => (
              <li key={i}>
                <span className="cx-welcome-keys-cell">{p.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}</span>
                <span className="cx-welcome-keys-desc">{p.label}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="cx-welcome-stage">
          <p className="cx-welcome-eyebrow" style={wi(0)}>03 · the oracle</p>
          <h2 className="cx-welcome-headline2" style={wi(1)}>Wake the Oracle.</h2>
          <p className="cx-welcome-sub" style={wi(2)}>Optional. Everything else works without it.</p>
          <ul className="cx-welcome-locked" style={wi(3)}>
            <li>Commentary</li>
            <li>Talmudic parallels</li>
            <li>Gnosis overlay</li>
            <li>Semantic search</li>
          </ul>
          <div className="cx-welcome-pair" style={wi(4)}>
            <button className="cx-welcome-btn cx-welcome-btn--primary" onClick={openSettings}>Add a key →</button>
            <button className="cx-welcome-btn cx-welcome-btn--ghost" onClick={next}>Skip for now</button>
          </div>
        </div>
      );
    }
    return (
      <div className="cx-welcome-stage cx-welcome-stage--final">
        <p className="cx-welcome-eyebrow" style={wi(0)}>04 · open the book</p>
        <h2 className="cx-welcome-headline2 cx-welcome-headline2--lg" style={wi(1)}>Begin reading.</h2>
        <p className="cx-welcome-sub cx-welcome-sub--lg" style={wi(2)}>
          John 1 is open. Tap any verse number to highlight. Click the title to jump books. Swipe left or right for chapters.
        </p>
        <div className="cx-welcome-pair cx-welcome-pair--center" style={wi(3)}>
          <button className="cx-welcome-btn cx-welcome-btn--primary cx-welcome-btn--lg" onClick={next}>Begin →</button>
        </div>
      </div>
    );
  };

  const pct = ((step + 1) / total) * 100;
  return (
    <div className="cx-welcome-backdrop" role="dialog" aria-modal="true" aria-label="Welcome to CODEX">
      <div className="cx-welcome-scanlines" aria-hidden="true" />
      <div className="cx-welcome-vignette" aria-hidden="true" />
      <button className="cx-welcome-skip" onClick={onClose} aria-label="Skip tour">skip tour ✕</button>
      <div className="cx-welcome-shell" key={step}>{renderStep()}</div>
      <div className="cx-welcome-nav" aria-hidden="false">
        <div className="cx-welcome-dots" role="tablist" aria-label="Tour progress">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={"cx-welcome-dot" + (i === step ? " is-active" : "") + (i < step ? " is-done" : "")} />
          ))}
        </div>
        <div className="cx-welcome-arrows">
          {step > 0 ? (
            <button className="cx-welcome-arrow" onClick={prev} aria-label="Previous step">← back</button>
          ) : (
            <span className="cx-welcome-arrow cx-welcome-arrow--ghost">&nbsp;</span>
          )}
          <button className="cx-welcome-arrow cx-welcome-arrow--next" onClick={next} aria-label="Next step">
            {step === total - 1 ? "begin →" : "next →"}
          </button>
        </div>
      </div>
      <div className="cx-welcome-progress" aria-hidden="true">
        <div className="cx-welcome-progress-fill" style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

export function WelcomeBack({
  onContinue,
  onDismiss,
  onDiscoveryClick,
}: {
  onContinue: (session: { bookId: string; bookName: string; chapter: number }) => void;
  onDismiss: () => void;
  onDiscoveryClick: (disc: { title?: string; type?: string; body?: string; ref?: string }) => void;
}): React.ReactElement | null {
  const engage = aw().CODEX_ENGAGE;
  if (!engage) return null;
  const stats = engage.loadStats();
  if (stats.sessionCount <= 1) return null;

  const sk = engage.loadStreak();
  const session = engage.loadSession();
  const disc = engage.getDailyDiscovery();
  const warn = engage.streakWarning();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="cx-welcome-back">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="cx-wb-greeting">{greeting}</div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--cx-fg-dim)", cursor: "pointer", fontSize: "14px", padding: "0 2px" }} title="Dismiss">
          &times;
        </button>
      </div>

      {sk.current > 0 && (
        <div className="cx-wb-streak">
          <span className="cx-flame">{"🔥"}</span>
          <span>
            {sk.current}-day streak{sk.current === sk.longest ? " (personal best!)" : ""}
          </span>
        </div>
      )}

      {warn && (
        <div className="cx-streak-warn">
          <span className="cx-streak-warn-icon">{"🔥"}</span>
          <span>{warn.msg}</span>
        </div>
      )}

      {session && (
        <button className="cx-wb-continue" onClick={() => onContinue(session)}>
          <span className="cx-wb-continue-icon">{"▶"}</span>
          <div className="cx-wb-continue-text">
            <div className="cx-wb-continue-ref">
              Continue: {session.bookName} {session.chapter}
            </div>
            <div className="cx-wb-continue-sub">Pick up where you left off</div>
          </div>
        </button>
      )}

      {disc && disc.title && (
        <div className="cx-daily-disc" onClick={() => onDiscoveryClick(disc)}>
          <div className="cx-daily-disc-badge">{"✦"} daily discovery · {disc.type}</div>
          <div className="cx-daily-disc-title">{disc.title}</div>
          <div className="cx-daily-disc-body">{disc.body}</div>
          {disc.ref && <div className="cx-daily-disc-ref">{disc.ref}</div>}
        </div>
      )}
    </div>
  );
}
