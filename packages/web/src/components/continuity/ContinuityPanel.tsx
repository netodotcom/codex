// continuity — Continuity & Mastery presentation layer (migrated from
// continuity.jsx). The "analyst desk" UI on top of window.CODEX_ENGAGEMENT.
// PRESENTATION + WIRING only — every number, status string, quest, season and
// milestone comes from the engine. We never compute streaks, never advance
// anything, never store engagement state here.
//
// Surfaces: (a) ContinuityIndicator, (b) AnalystDossier (+ MasteryGrid + IntelLog
// + QuestList/QuestPlayer), (d) NextThread, and the ContinuityMount composite.
import React from "react";
import { safe, asciiBar, isoStamp, pctToNext, STEP_KIND_KEY, STEP_KIND_EN } from "./helpers.js";
import {
  cw,
  ENG,
  LITE,
  t,
  reducedMotion,
  domains,
  jumpRef,
  saveReflectionNote,
  buildCtx,
} from "./continuity-window.js";
import type {
  ContinuityStatus,
  MasteryMap,
  MilestonesData,
  EventLogEntry,
  QuestModule,
  QuestState,
  QuestListItem,
  NextThreadSuggestion,
  BuildCtxDetail,
} from "./continuity-window.js";

const { useState, useEffect, useRef, useCallback } = React;

// ════════════════════════════════════════════════════════════════════════
// (a) ContinuityIndicator — terse readout. No flame, no guilt. Calm.
// ════════════════════════════════════════════════════════════════════════
export function ContinuityIndicator(props?: { compact?: boolean }): React.ReactElement | null {
  const compact = !!(props && props.compact);
  const [status, setStatus] = useState<ContinuityStatus | null>(() => {
    return safe(() => {
      const e = ENG();
      // continuity() reconciles a stale gap for display (may silently spend
      // grace). That's the correct read-only call for a passive indicator.
      return e ? e.continuity() : null;
    }, null);
  });

  useEffect(() => {
    function refresh() {
      setStatus(
        safe(() => {
          const e = ENG();
          return e ? e.continuityStatus() : null; // pure read, no side effects
        }, null),
      );
    }
    window.addEventListener("codex:continuity-tick", refresh);
    window.addEventListener("codex:depth-action", refresh);
    return () => {
      window.removeEventListener("codex:continuity-tick", refresh);
      window.removeEventListener("codex:depth-action", refresh);
    };
  }, []);

  if (!status) return null;

  const held = (status.graceSpent || 0) > 0;
  const idle = !status.lastDay;
  const cls = "cx-continuity" + (held ? " cx-continuity-held" : "") + (idle ? " cx-continuity-idle" : "");

  const grace = Math.max(0, status.grace || 0);
  const graceCap = status.graceCap || 2;
  // Grace tokens as calm dots — never a broken flame.
  const graceDots = "◆".repeat(grace) + "◇".repeat(Math.max(0, graceCap - grace));

  const ringPct = (() => {
    // Show progress within the current 7-day grace ring (purely cosmetic).
    const span = status.nextGraceIn != null && status.sinceGrace != null ? status.sinceGrace + status.nextGraceIn : 7;
    const done = status.sinceGrace || 0;
    return span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 0;
  })();

  return (
    <div className={cls} role="status" aria-live="polite">
      <div
        className="cx-continuity-ring"
        role="img"
        aria-label={t("cx.continuity.ring", "Continuity ring") + " · " + ringPct + "%"}
        data-static={reducedMotion() ? "1" : undefined}
        style={{ "--cx-ring-pct": ringPct } as React.CSSProperties}
      >
        <span className="cx-continuity-count">{status.current || 0}</span>
      </div>
      {!compact && (
        <div className="cx-continuity-meta">
          <span className="cx-continuity-status">{status.statusText || t("cx.continuity.active", "Continuity active")}</span>
          <span
            className="cx-continuity-grace"
            title={
              t("cx.continuity.grace", "Grace") +
              ((status.nextGraceIn || 0) > 0 ? " · " + t("cx.continuity.grace.next", "Next grace token in {n} days", { n: status.nextGraceIn }) : "")
            }
            aria-label={t("cx.continuity.grace", "Grace") + " " + grace + "/" + graceCap}
          >
            {t("cx.continuity.grace", "Grace")} {graceDots}
          </span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Mastery grid — per-domain bars in the analyst-desk voice.
// ════════════════════════════════════════════════════════════════════════
function MasteryGrid(): React.ReactElement {
  const [cells, setCells] = useState<MasteryMap | null>(() => {
    return safe(() => {
      const e = ENG();
      return e ? e.mastery() : null;
    }, null);
  });

  useEffect(() => {
    function refresh() {
      setCells(
        safe(() => {
          const e = ENG();
          return e ? e.mastery() : null;
        }, null),
      );
    }
    window.addEventListener("codex:depth-action", refresh);
    window.addEventListener("codex:milestone", refresh);
    window.addEventListener("codex:quest-step", refresh);
    return () => {
      window.removeEventListener("codex:depth-action", refresh);
      window.removeEventListener("codex:milestone", refresh);
      window.removeEventListener("codex:quest-step", refresh);
    };
  }, []);

  const e = ENG();
  const levels = e && Array.isArray(e.MASTERY_LEVELS) ? e.MASTERY_LEVELS : null;

  return (
    <div className="cx-mastery-grid">
      {domains().map((d) => {
        const cell = (cells && cells[d]) || { score: 0, threads: 0, level: 0, levelLabel: "" };
        const pct = pctToNext(levels, cell.score || 0, cell.level || 0);
        const bar = asciiBar(pct, 5);
        const domainLabel = t("cx.domain." + d, d);
        const levelLabel = cell.levelLabel || t("cx.mastery.lvl.dormant", "Dormant");
        return (
          <div className="cx-mastery-domain" key={d}>
            <div className="cx-mastery-domain-head">
              <span className="cx-mastery-domain-name">{domainLabel}</span>
              <span className="cx-mastery-level">{levelLabel}</span>
            </div>
            <div
              className="cx-mastery-bar"
              role="img"
              aria-label={domainLabel + " · " + levelLabel + " · " + pct + "%"}
              data-static={reducedMotion() ? "1" : undefined}
              style={{ "--cx-bar-pct": pct } as React.CSSProperties}
            >
              <span className="cx-mastery-bar-ascii" aria-hidden="true">{bar}</span>
              <span className="cx-mastery-bar-pct" aria-hidden="true">{pct}%</span>
            </div>
            <div className="cx-mastery-threads">{t("cx.mastery.threads", "{n} threads closed", { n: cell.threads || 0 })}</div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Intel log — the unified discovery/milestone feed with date stamps.
// ════════════════════════════════════════════════════════════════════════
interface IntelRow {
  kind: string;
  id: string;
  domain?: string | null;
  stamp?: unknown;
}

function IntelLog(): React.ReactElement {
  const [rows, setRows] = useState<IntelRow[]>([]);

  const load = useCallback(() => {
    const e = ENG();
    if (!e) {
      setRows([]);
      return;
    }
    // Milestones are the "discoveries logged" headline rows; the raw event log
    // gives weight>=4 (thread-closing) depth events as supporting intel.
    const ms = safe<MilestonesData>(() => e.milestones(), { unlocked: {} }) || { unlocked: {} };
    const unlocked = ms.unlocked || {};
    const msRows: IntelRow[] = Object.keys(unlocked).map((id) => {
      return { kind: "milestone", id: id, stamp: unlocked[id] };
    });
    Promise.resolve(safe<EventLogEntry[] | Promise<EventLogEntry[]>>(() => e.eventLog(), []))
      .then((log) => {
        const closing: IntelRow[] = (Array.isArray(log) ? log : [])
          .filter((ev) => ev && (ev.weight || 0) >= 4)
          .slice(-40)
          .reverse()
          .map((ev) => {
            return {
              kind: "thread",
              id: ev.type + (ev.ref ? " · " + ev.ref : ""),
              domain: ev.domain || null,
              stamp: ev.ts,
            };
          });
        // Merge, newest first by stamp.
        const all = msRows.concat(closing).sort((a, b) => {
          const av = +new Date(isoStamp(a.stamp)) || 0;
          const bv = +new Date(isoStamp(b.stamp)) || 0;
          return bv - av;
        });
        setRows(all.slice(0, 50));
      })
      .catch(() => {
        setRows(msRows);
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("codex:milestone", load);
    window.addEventListener("codex:depth-action", load);
    return () => {
      window.removeEventListener("codex:milestone", load);
      window.removeEventListener("codex:depth-action", load);
    };
  }, [load]);

  if (!rows.length) {
    return <div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div>;
  }

  return (
    <ul className="cx-intel-log" aria-label={t("cx.dossier.intel", "Intel")}>
      {rows.map((r, i) => {
        const label =
          r.kind === "milestone"
            ? t("cx.milestone.discovery", "Discovery logged")
            : r.domain
              ? t("cx.domain." + r.domain, r.domain)
              : t("cx.milestone.unlocked", "Milestone logged");
        return (
          <li className="cx-intel-badge" key={r.id + ":" + i}>
            <span className="cx-intel-badge-stamp">{isoStamp(r.stamp)}</span>
            <span className="cx-intel-badge-label">{label}</span>
            <span className="cx-intel-badge-ref">{r.id}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ════════════════════════════════════════════════════════════════════════
// (c) QuestPlayer — runs ONE curated quest. read/find/connect/reflect.
// ════════════════════════════════════════════════════════════════════════
export function QuestPlayer(props: { questId: string; onClose?: () => void }): React.ReactElement | null {
  const questId = props.questId;
  const onClose = props.onClose;
  const [quest, setQuest] = useState<QuestModule | null>(null); // full module { meta, steps }
  const [state, setState] = useState<QuestState | null>(null); // engine quest state
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const liveRef = useRef<HTMLDivElement>(null);

  // Load the full quest module + its local state.
  useEffect(() => {
    let alive = true;
    const e = ENG();
    if (!e || !questId) return;
    Promise.resolve(safe<QuestModule | Promise<QuestModule | null> | null>(() => e.getQuest(questId), null))
      .then((q) => {
        if (alive) setQuest(q || null);
      })
      .catch(() => {
        if (alive) setQuest(null);
      });
    setState(safe(() => e.questState(questId), null));
    return () => {
      alive = false;
    };
  }, [questId]);

  // Stay in sync with engine quest-step events.
  useEffect(() => {
    function onStep(ev: Event) {
      const d = ((ev as CustomEvent).detail || {}) as { questId?: string };
      if (d.questId && d.questId !== questId) return;
      setState(
        safe(() => {
          const e = ENG();
          return e ? e.questState(questId) : null;
        }, null),
      );
    }
    window.addEventListener("codex:quest-step", onStep);
    return () => {
      window.removeEventListener("codex:quest-step", onStep);
    };
  }, [questId]);

  if (!quest) return null;
  const steps = Array.isArray(quest.steps) ? quest.steps : [];
  const st: QuestState = state || { status: "available", step: 0 };
  const stepIdx = Math.min(st.step || 0, Math.max(0, steps.length - 1));
  const done = st.status === "complete";
  const cur = steps[stepIdx] || null;
  const isReflect = !!(cur && cur.kind === "reflect");

  const start = () => {
    const e = ENG();
    if (!e) return;
    Promise.resolve(safe(() => e.startQuest(questId), null)).then(() => {
      setState(safe(() => e.questState(questId), null));
    });
  };

  const advance = () => {
    // For a reflect step, require a saved reflection first (the depth action IS
    // the writing). For other steps the advance is the depth action.
    if (isReflect && !reflectionSaved && reflection.trim()) {
      saveReflectionNote(quest.meta && quest.meta.title, stepIdx, reflection);
      setReflectionSaved(true);
    }
    const e = ENG();
    if (!e) return;
    Promise.resolve(safe(() => e.advanceQuest(questId), null)).then(() => {
      setState(safe(() => e.questState(questId), null));
    });
  };

  // AI feedback — optional, clearly labeled, never required. Uses the same
  // /api/chat path the rest of the app uses; degrades to a calm error line.
  const requestFeedback = () => {
    setFbLoading(true);
    setFbError("");
    let provider = "anthropic";
    let model: string | undefined = undefined;
    try {
      // Same source the rest of the app uses for the active provider/model.
      const data = cw().CODEX_DATA;
      const tw = (data && data.tweaks) || {};
      provider = tw.provider || provider;
      model = tw.model || model;
    } catch {
      /* ignore */
    }
    const compiled = steps
      .map((s, i) => {
        return i + 1 + ". [" + (s.kind || "") + "] " + (s.prompt || "");
      })
      .join("\n");
    const system =
      "You are a careful, tradition-agnostic scripture analyst giving feedback on a reader's quest reflection. Be specific and honest, name the text, never push one tradition. 150-220 words, plain prose.";
    const userMsg =
      "Quest: " + ((quest.meta && quest.meta.title) || "") + "\n\nSteps:\n" + compiled + "\n\nReader's reflection:\n" + (reflection.trim() || "(none written)");
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider, model: model, system: system, messages: [{ role: "user", content: userMsg }], max_tokens: 700 }),
    })
      .then((r) => r.json())
      .then((d: { text?: string; error?: string } | null) => {
        if (!d || !d.text) throw new Error((d && d.error) || "no feedback");
        setFeedback(String(d.text).trim());
      })
      .catch(() => {
        setFbError(t("cx.dossier.empty", ""));
      })
      .finally(() => {
        setFbLoading(false);
      });
  };

  // Export the closed quest as a .codex-study module (local download only).
  const exportStudy = () => {
    try {
      const bundle = {
        format: "codex.study",
        version: 1,
        kind: "quest-reflection",
        exportedAt: new Date().toISOString(),
        quest: {
          id: quest.meta && quest.meta.id,
          title: quest.meta && quest.meta.title,
          tradition: quest.meta && quest.meta.tradition,
          domain: quest.meta && quest.meta.domain,
          ring: quest.meta && quest.meta.ring,
        },
        steps: steps.map((s) => {
          return { kind: s.kind, refs: s.refs || null, prompt: s.prompt, reveal: s.reveal || null };
        }),
        reflection: reflection.trim() || null,
        feedback: feedback || null,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (quest.meta && quest.meta.id ? quest.meta.id : "quest") + ".codex-study.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }, 0);
    } catch {
      /* ignore */
    }
  };

  const kindLabel = (k: string | undefined) => t(STEP_KIND_KEY[k || ""] || "cx.quest.step.read", STEP_KIND_EN[k || ""] || "Read");

  return (
    <div className={"cx-quest-card cx-quest-active" + (done ? " cx-quest-complete" : "")} role="group" aria-label={quest.meta && quest.meta.title}>
      <div className="cx-quest-card-head">
        <span className="cx-quest-card-title">{quest.meta && quest.meta.title}</span>
        {onClose && (
          <button type="button" className="cx-quest-close" onClick={onClose} aria-label="Close quest">
            ✕
          </button>
        )}
      </div>

      <div className="cx-quest-progress" aria-label={Math.min(st.step || 0, steps.length) + " / " + steps.length}>
        {steps.map((s, i) => {
          const cls = "cx-quest-progress-pip" + (i < (st.step || 0) ? " is-done" : "") + (i === stepIdx && !done ? " is-current" : "");
          return (
            <span key={i} className={cls} aria-hidden="true">
              {i < (st.step || 0) ? "▰" : "▱"}
            </span>
          );
        })}
      </div>

      {!done && st.status !== "active" && (
        <div className="cx-quest-step">
          <p className="cx-quest-step-prompt">{steps[0] && steps[0].prompt}</p>
          <button type="button" className="cx-quest-btn" onClick={start}>
            {t("cx.quest.start", "Open thread")}
          </button>
        </div>
      )}

      {!done && st.status === "active" && cur && (
        <div className="cx-quest-step" ref={liveRef} aria-live="polite">
          <div className="cx-quest-step-kind">{kindLabel(cur.kind)}</div>
          {Array.isArray(cur.refs) && cur.refs.length > 0 && (
            <div className="cx-quest-step-refs">
              {cur.refs.map((rf, i) => {
                return (
                  <a
                    key={i}
                    className="cx-quest-ref"
                    href="#"
                    onClick={(ev) => {
                      ev.preventDefault();
                      jumpRef(rf);
                    }}
                    title={"Open " + rf}
                  >
                    {rf}
                  </a>
                );
              })}
            </div>
          )}
          <p className="cx-quest-step-prompt">{cur.prompt}</p>

          {isReflect && (
            <div className="cx-quest-reflect">
              <label className="cx-quest-reflect-label" htmlFor="cx-quest-reflect-ta">
                {t("cx.quest.step.reflect", "Reflect")}
              </label>
              <textarea
                id="cx-quest-reflect-ta"
                className="cx-quest-reflect-ta"
                value={reflection}
                onChange={(ev) => {
                  setReflection(ev.target.value);
                  setReflectionSaved(false);
                }}
                rows={4}
              />
            </div>
          )}

          {cur.reveal && (
            <details className="cx-quest-reveal">
              <summary>{t("cx.quest.reveal", "Reveal")}</summary>
              <p>{cur.reveal}</p>
            </details>
          )}

          <button type="button" className="cx-quest-btn" onClick={advance} disabled={isReflect && !reflection.trim()}>
            {t("cx.quest.advance", "Advance")}
          </button>
        </div>
      )}

      {done && (
        <div className="cx-quest-step cx-quest-done">
          <p className="cx-quest-step-prompt">{t("cx.quest.complete", "Closed")}</p>

          {/* AI feedback — OPTIONAL + clearly labeled. Never gates completion. */}
          <div className="cx-quest-feedback">
            {!feedback && !fbLoading && (
              <button type="button" className="cx-quest-btn cx-quest-btn-ghost" onClick={requestFeedback}>
                {t("cx.milestone.unlocked", "AI analyst feedback")}
              </button>
            )}
            {fbLoading && <p className="cx-quest-feedback-loading">…</p>}
            {feedback && (
              <blockquote className="cx-quest-feedback-text" data-ai="1">
                <span className="cx-quest-feedback-flag" aria-hidden="true">
                  AI
                </span>
                {feedback}
              </blockquote>
            )}
            {fbError && <p className="cx-quest-feedback-err">{fbError || "—"}</p>}
          </div>

          <button type="button" className="cx-quest-btn" onClick={exportStudy}>
            ⤓ .codex-study
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Quest list — curated quests with per-quest state. Opening one mounts the
// QuestPlayer inline. Merely listing/opening NEVER advances anything.
// ════════════════════════════════════════════════════════════════════════
export function QuestList(): React.ReactElement {
  const [quests, setQuests] = useState<QuestListItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    const e = ENG();
    if (!e) {
      setQuests([]);
      return;
    }
    Promise.resolve(safe<QuestListItem[] | Promise<QuestListItem[]>>(() => e.listQuests(), []))
      .then((qs) => {
        setQuests(Array.isArray(qs) ? qs : []);
      })
      .catch(() => {
        setQuests([]);
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("codex:quest-step", load);
    return () => {
      window.removeEventListener("codex:quest-step", load);
    };
  }, [load]);

  function statusLabel(s: string | undefined) {
    if (s === "complete") return t("cx.quest.complete", "Closed");
    if (s === "active") return t("cx.quest.active", "In progress");
    return t("cx.quest.available", "Available");
  }

  if (openId) {
    return (
      <QuestPlayer
        questId={openId}
        onClose={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="cx-quest-list" aria-label={t("cx.quest.title", "Quests")}>
      {!quests.length && (
        <div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div>
      )}
      {quests.map((q) => {
        const cls = "cx-quest-card" + (q.status === "active" ? " cx-quest-active" : "") + (q.status === "complete" ? " cx-quest-complete" : "");
        return (
          <button
            type="button"
            key={q.id}
            className={cls}
            onClick={() => {
              setOpenId(q.id);
            }}
          >
            <span className="cx-quest-card-title">{q.title}</span>
            <span className="cx-quest-card-meta">
              {q.domain ? t("cx.domain." + q.domain, q.domain) : ""}
              {q.tradition ? " · " + q.tradition : ""}
            </span>
            <span className="cx-quest-card-status">
              {statusLabel(q.status)}
              {q.steps ? " · " + (q.step || 0) + "/" + q.steps : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// (b) AnalystDossier — the engagement home panel.
// ════════════════════════════════════════════════════════════════════════
export function AnalystDossier(_ctx?: Record<string, unknown>): React.ReactElement {
  const [snap, setSnap] = useState<{ continuity: ContinuityStatus | null; mastery: MasteryMap | null }>(() => {
    return {
      continuity: safe(() => {
        const e = ENG();
        return e ? e.continuityStatus() : null;
      }, null),
      mastery: safe(() => {
        const e = ENG();
        return e ? e.mastery() : null;
      }, null),
    };
  });

  useEffect(() => {
    function refresh() {
      setSnap({
        continuity: safe(() => {
          const e = ENG();
          return e ? e.continuityStatus() : null;
        }, null),
        mastery: safe(() => {
          const e = ENG();
          return e ? e.mastery() : null;
        }, null),
      });
    }
    window.addEventListener("codex:depth-action", refresh);
    window.addEventListener("codex:continuity-tick", refresh);
    window.addEventListener("codex:milestone", refresh);
    return () => {
      window.removeEventListener("codex:depth-action", refresh);
      window.removeEventListener("codex:continuity-tick", refresh);
      window.removeEventListener("codex:milestone", refresh);
    };
  }, []);

  if (!ENG()) {
    return (
      <div className="cx-dossier">
        <div className="cx-dossier-stat cx-dossier-empty">{t("cx.dossier.empty", "No threads opened yet. Begin any depth surface to open a case.")}</div>
      </div>
    );
  }

  // Derived intel stats from mastery: books-at-depth ≈ canon-coverage threads;
  // longest thread ≈ the top domain by closed threads.
  const m = snap.mastery || {};
  const canon = m["canon-coverage"] || { threads: 0 };
  let topDomain: string | null = null;
  let topThreads = 0;
  Object.keys(m).forEach((d) => {
    const cell = m[d];
    const th = (cell && cell.threads) || 0;
    if (th > topThreads) {
      topThreads = th;
      topDomain = d;
    }
  });
  const cont = snap.continuity || {};

  // window.IntelBanner is a host chrome global; the legacy referenced it as a
  // bare identifier (assumed present whenever the dossier renders).
  const IntelBanner = cw().IntelBanner as React.ComponentType<{ console?: string; scope?: string; note?: string }>;

  return (
    <div className="cx-dossier">
      <div className="cx-dossier-header">
        <span className="cx-dossier-title">{t("cx.dossier.title", "Analyst desk")}</span>
      </div>

      <IntelBanner console="CONTINUITY" scope="READER DOSSIER" note="YOUR OWN RECORD · STORED LOCALLY · NEVER UPLOADED" />

      <div className="cx-dossier-section cx-dossier-section--continuity">
        <ContinuityIndicator />
      </div>

      <div className="cx-dossier-section cx-dossier-section--intel">
        <div className="cx-dossier-stat">
          <span className="cx-dossier-stat-k">{t("cx.continuity.title", "Continuity")}</span>
          <span className="cx-dossier-stat-v">
            {cont.current || 0} · ↥ {cont.longest || 0}
          </span>
        </div>
        <div className="cx-dossier-stat">
          <span className="cx-dossier-stat-k">{t("cx.domain.canon-coverage", "Canon coverage")}</span>
          <span className="cx-dossier-stat-v">{t("cx.mastery.threads", "{n} threads closed", { n: canon.threads || 0 })}</span>
        </div>
        <div className="cx-dossier-stat">
          <span className="cx-dossier-stat-k">↻</span>
          <span className="cx-dossier-stat-v">{topDomain ? t("cx.domain." + topDomain, topDomain) + " · " + topThreads : "—"}</span>
        </div>
      </div>

      <div className="cx-dossier-section cx-dossier-section--mastery">
        <div className="cx-dossier-subhead">{t("cx.mastery.title", "Mastery")}</div>
        <MasteryGrid />
      </div>

      <div className="cx-dossier-section cx-dossier-section--quests">
        <div className="cx-dossier-subhead">{t("cx.quest.title", "Quests")}</div>
        <QuestList />
      </div>

      <div className="cx-dossier-section cx-dossier-section--log">
        <div className="cx-dossier-subhead">{t("cx.dossier.intel", "Intel")}</div>
        <IntelLog />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// (d) NextThread — one quiet "⌁ next: …" line. Refreshed on navigation /
//   panel-open. NEVER a modal, NEVER an infinite feed.
// ════════════════════════════════════════════════════════════════════════
export function NextThread(): React.ReactElement | null {
  const [sugg, setSugg] = useState<NextThreadSuggestion | null>(null);
  // Session-scoped dismissal — a professional surface must always be closable.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return safe(() => sessionStorage.getItem("cx-nextthread-dismissed") === "1", false);
  });

  const refresh = useCallback((detail: BuildCtxDetail | null) => {
    const e = ENG();
    if (!e) {
      setSugg(null);
      return;
    }
    const s = safe(() => e.nextThread(buildCtx(detail)), null);
    // "none" is not a suggestion — render nothing rather than ambient noise.
    setSugg(s && s.kind && s.kind !== "none" ? s : null);
  }, []);

  useEffect(() => {
    refresh(null);
    function onNav(ev: Event) {
      refresh(((ev as CustomEvent).detail as BuildCtxDetail) || null);
    }
    function onPanel(ev: Event) {
      refresh(((ev as CustomEvent).detail as BuildCtxDetail) || null);
    }
    function onStep() {
      refresh(null);
    }
    window.addEventListener("codex:navigate", onNav);
    window.addEventListener("codex:open-panel", onPanel);
    window.addEventListener("codex:quest-step", onStep);
    window.addEventListener("codex:depth-action", onStep);
    return () => {
      window.removeEventListener("codex:navigate", onNav);
      window.removeEventListener("codex:open-panel", onPanel);
      window.removeEventListener("codex:quest-step", onStep);
      window.removeEventListener("codex:depth-action", onStep);
    };
  }, [refresh]);

  if (!sugg || dismissed) return null;

  const kindKey =
    (
      {
        quest: "cx.nextthread.quest",
        "quest-start": "cx.nextthread.start",
        gematria: "cx.nextthread.gematria",
        crossref: "cx.nextthread.crossref",
        daf: "cx.nextthread.daf",
        parsha: "cx.nextthread.parsha",
      } as Record<string, string>
    )[sugg.kind || ""] || "cx.nextthread.start";

  const kindEn =
    (
      {
        quest: "Resume an open quest thread",
        "quest-start": "Open a new thread",
        gematria: "A gematria match sits in your own library",
        crossref: "Follow a cross-ref thread from here",
        daf: "Today's daf",
        parsha: "This week's parsha",
      } as Record<string, string>
    )[sugg.kind || ""] || "Open a new thread";

  const label = sugg.title || t(kindKey, kindEn);

  const act = () => {
    // Acting on the suggestion is just navigation — NOT a depth event.
    try {
      if (sugg.ref && cw().codexJumpToRef) {
        cw().codexJumpToRef?.(sugg.ref);
        return;
      }
      if (sugg.kind === "quest" || sugg.kind === "quest-start") {
        window.dispatchEvent(new CustomEvent("codex:open-panel", { detail: { panelId: "continuity:dossier" } }));
        return;
      }
    } catch {
      /* ignore */
    }
  };

  const dismiss = (ev?: React.MouseEvent) => {
    if (ev) ev.stopPropagation();
    safe(() => {
      sessionStorage.setItem("cx-nextthread-dismissed", "1");
      return null;
    }, null);
    setDismissed(true);
  };

  return (
    <div className="cx-nextthread" title={t("cx.nextthread.title", "Next thread")}>
      <button type="button" className="cx-nextthread-btn" onClick={act}>
        <span className="cx-nextthread-glyph" aria-hidden="true">
          ⌁
        </span>
        <span className="cx-nextthread-label">{label}</span>
        {sugg.reason ? <span className="cx-nextthread-reason">{sugg.reason}</span> : null}
      </button>
      <button
        type="button"
        className="cx-nextthread-x"
        onClick={dismiss}
        aria-label={t("cx.nextthread.dismiss", "Dismiss suggestion")}
        title={t("cx.nextthread.dismiss", "Dismiss suggestion")}
      >
        ×
      </button>
    </div>
  );
}

// A composite mount that the host renders once near the app root. Hosts the
// ambient surfaces (next-thread line). The dossier itself is a rail panel
// registered as a plugin in index.tsx.
export function ContinuityMount(): React.ReactElement | null {
  if (LITE || !ENG()) return null;
  return (
    <div className="cx-continuity-mount">
      <NextThread />
    </div>
  );
}
