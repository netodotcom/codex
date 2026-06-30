// ai-quests — QuestRunner component (migrated verbatim from ai-quests.jsx).
// Includes the tiny shared bits (RefLink, Skeleton) that QuestRunner depends
// on so there are no circular imports. Render is kept as React.createElement
// (the classic factory) so the DOM output is byte-for-intent identical to the
// legacy IIFE. All window-global reads go through aqw().
import React from "react";
import {
  lsGet,
  lsSet,
  stateKey,
  answersKey,
  draftKey,
  emitDepth,
  emitQuestStep,
  encodeShare,
  SAVED_KEY,
} from "./helpers.js";
import { generateFeedback } from "./api.js";
import { aqw } from "./ai-quests-window.js";
import type { Quest, QuestEnvelope, Answers } from "./helpers.js";

const { useState, useEffect } = React;

// ── Shared UI bits ─────────────────────────────────────────────────────────────
interface RefLinkProps {
  refStr: string;
  onAfterJump?: () => void;
}
export function RefLink({ refStr, onAfterJump }: RefLinkProps): React.ReactElement | null {
  if (!refStr) return null;
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    const jump = aqw().codexJumpToRef;
    if (jump) jump(refStr);
    if (typeof onAfterJump === "function") onAfterJump();
  };
  return React.createElement(
    "a",
    { className: "cx-quest-ref", href: "#", onClick, title: `Open ${refStr} in the reader` },
    refStr,
  );
}

interface SkeletonProps {
  lines?: number;
}
export function Skeleton({ lines = 6 }: SkeletonProps): React.ReactElement {
  return React.createElement(
    "div",
    { className: "cx-quest-skel" },
    ...Array.from({ length: lines }).map((_, i) =>
      React.createElement("div", {
        key: i,
        className: "cx-quest-skel-line",
        style: { width: (60 + (i * 7) % 35) + "%" },
      }),
    ),
  );
}

// ── QuestRunner ────────────────────────────────────────────────────────────────
export interface QuestRunnerProps {
  quest: Quest;
  onClose: () => void;
  onComplete?: (envelope: QuestEnvelope) => void;
}

export function QuestRunner({ quest, onClose, onComplete }: QuestRunnerProps): React.ReactElement {
  const initial = lsGet<{ stepIdx?: number; hintsShown?: number[] }>(
    stateKey(quest.id),
    { stepIdx: 0, hintsShown: [] },
  );
  const [stepIdx, setStepIdx] = useState(initial.stepIdx ?? 0);
  const [hintsShown, setHintsShown] = useState(
    new Set<number>(initial.hintsShown ?? []),
  );
  const [answers, setAnswers] = useState<Answers>(() =>
    lsGet<Answers>(answersKey(quest.id), {}),
  );
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<"step" | "synthesis">(
    stepIdx >= quest.steps.length ? "synthesis" : "step",
  );
  const [reflection, setReflection] = useState<string>(() =>
    lsGet<string>(draftKey(quest.id), ""),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const step = quest.steps[stepIdx];
  const total = quest.steps.length;

  useEffect(() => {
    lsSet(stateKey(quest.id), { stepIdx, hintsShown: [...hintsShown] });
  }, [stepIdx, hintsShown, quest.id]);

  useEffect(() => {
    // Seed draft from any previously-stored answer when stepping in/out.
    if (phase === "step" && step !== undefined) {
      setDraft((answers[step.n] as string | undefined) ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return (): void => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveAnswer = (): void => {
    if (!step) return;
    const next: Answers = { ...answers, [step.n]: draft };
    setAnswers(next);
    lsSet(answersKey(quest.id), next);
  };

  const goNext = (): void => {
    saveAnswer();
    // Depth-gated: completing a quest step feeds continuity + mastery.
    emitDepth("quest-step", step ? step.passage : quest.id, 3, "canon-coverage");
    emitQuestStep(quest.id, stepIdx + 1, "active", "canon-coverage");
    if (stepIdx < total - 1) setStepIdx((i) => i + 1);
    else { setPhase("synthesis"); setStepIdx(total); }
  };

  const goPrev = (): void => {
    saveAnswer();
    if (phase === "synthesis") { setPhase("step"); setStepIdx(total - 1); }
    else if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const toggleHint = (): void => {
    if (!step) return;
    const next = new Set(hintsShown);
    if (next.has(step.n)) next.delete(step.n); else next.add(step.n);
    setHintsShown(next);
  };

  const requestFeedback = async (): Promise<void> => {
    lsSet(draftKey(quest.id), reflection);
    setLoadingFb(true); setFbErr(null);
    try {
      // combined is built but intentionally not passed to generateFeedback;
      // the original passes { ...answers, reflection } directly — preserved.
      const combined: Record<string, string> = Object.assign(
        {},
        answers as Record<string, string>,
      );
      if (reflection && reflection.trim()) combined["__reflection"] = reflection.trim();
      // Include the reflection as a virtual final answer
      const fb = await generateFeedback(quest, {
        ...answers,
        reflection: reflection,
      });
      setFeedback(fb);
    } catch (e) {
      setFbErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFb(false);
    }
  };

  const saveCompleted = (): void => {
    const list = lsGet<QuestEnvelope[]>(SAVED_KEY, []);
    const envelope: QuestEnvelope = {
      id: quest.id,
      title: quest.title,
      theme: quest.theme,
      blurb: quest.blurb,
      estimate_minutes: quest.estimate_minutes,
      steps: quest.steps,
      answers,
      reflection,
      feedback,
      completed_at: Date.now(),
    };
    // Replace if exists
    const idx = list.findIndex((x) => x.id === envelope.id);
    if (idx >= 0) list[idx] = envelope; else list.unshift(envelope);
    lsSet(SAVED_KEY, list);
    setSaved(true);
    // Mark the quest closed in the unified engine.
    emitQuestStep(quest.id, total, "complete", "canon-coverage");
    if (typeof onComplete === "function") onComplete(envelope);
  };

  const share = (): void => {
    const envelope = {
      id: quest.id,
      title: quest.title,
      theme: quest.theme,
      blurb: quest.blurb,
      estimate_minutes: quest.estimate_minutes,
      steps: quest.steps,
    };
    const url = encodeShare(envelope);
    try {
      if (navigator.share) {
        void navigator.share({ title: quest.title, url });
      } else {
        void navigator.clipboard?.writeText(url);
        alert("Share link copied to clipboard.");
      }
    } catch {
      try {
        void navigator.clipboard?.writeText(url);
        alert("Link copied.");
      } catch { /* ignore */ }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const progressPct =
    phase === "synthesis" ? 100 : Math.round((stepIdx / total) * 100);

  return React.createElement(
    "div",
    {
      className: "cx-quest-overlay",
      role: "dialog",
      "aria-label": `Quest: ${quest.title}`,
    },
    React.createElement(
      "header",
      { className: "cx-quest-head" },
      React.createElement("span", { className: "cx-quest-tag" }, "AI QUEST"),
      React.createElement("h2", { className: "cx-quest-title-bar" }, quest.title),
      React.createElement(
        "span",
        { className: "cx-quest-progress" },
        phase === "synthesis" ? "Reflection" : `Step ${stepIdx + 1} / ${total}`,
      ),
      React.createElement("button", {
        className: "cx-quest-close",
        onClick: onClose,
        "aria-label": "Close quest (Esc)",
        title: "Close · Esc",
      }, "✕"),
    ),
    React.createElement(
      "div",
      { className: "cx-quest-pbar" },
      React.createElement("div", {
        className: "cx-quest-pbar-fill",
        style: { width: progressPct + "%" },
      }),
    ),
    React.createElement(
      "div",
      { className: "cx-quest-body" },
      phase === "step" && step
        ? React.createElement(
            "article",
            { className: "cx-quest-page" },
            React.createElement("div", { className: "cx-quest-step-no" }, `Step ${step.n} of ${total}`),
            React.createElement(
              "div",
              { className: "cx-quest-passage" },
              React.createElement(RefLink, { refStr: step.passage, onAfterJump: onClose }),
            ),
            step.intro
              ? React.createElement("p", { className: "cx-quest-intro" }, step.intro)
              : null,
            React.createElement(
              "div",
              { className: "cx-quest-q-wrap" },
              React.createElement("div", { className: "cx-quest-q-label" }, "Question"),
              React.createElement("p", { className: "cx-quest-question" }, step.question),
            ),
            React.createElement("textarea", {
              className: "cx-quest-answer",
              placeholder: "Write your thoughts here…",
              value: draft,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>): void =>
                setDraft(e.target.value),
              onBlur: saveAnswer,
              rows: 6,
            }),
            step.guidance
              ? React.createElement(
                  "div",
                  { className: "cx-quest-hint-wrap" },
                  React.createElement(
                    "button",
                    { className: "cx-quest-hint-btn", onClick: toggleHint },
                    hintsShown.has(step.n) ? "▾ Hide hint" : "▸ Show hint",
                  ),
                  hintsShown.has(step.n)
                    ? React.createElement("p", { className: "cx-quest-hint" }, step.guidance)
                    : null,
                )
              : null,
          )
        : null,
      phase === "synthesis"
        ? React.createElement(
            "article",
            { className: "cx-quest-page cx-quest-synthesis" },
            React.createElement("h1", { className: "cx-quest-syn-h" }, "Reflection"),
            React.createElement(
              "p",
              { className: "cx-quest-syn-intro" },
              quest.synthesis_prompt ||
                "Write a one-paragraph reflection tying together what you saw across this quest.",
            ),
            React.createElement("textarea", {
              className: "cx-quest-answer cx-quest-reflection",
              placeholder: "Your reflection…",
              value: reflection,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>): void =>
                setReflection(e.target.value),
              onBlur: (): void => lsSet(draftKey(quest.id), reflection),
              rows: 8,
            }),
            React.createElement(
              "div",
              { className: "cx-quest-syn-actions" },
              React.createElement(
                "button",
                {
                  className: "cx-quest-primary",
                  onClick: (): void => { void requestFeedback(); },
                  disabled: loadingFb,
                },
                loadingFb
                  ? "Reading your answers…"
                  : feedback
                  ? "↻ Regenerate feedback"
                  : "Get AI feedback",
              ),
              feedback
                ? React.createElement(
                    "button",
                    {
                      className: `cx-quest-secondary ${saved ? "is-saved" : ""}`,
                      onClick: saveCompleted,
                    },
                    saved ? "✓ Saved" : "Save quest",
                  )
                : null,
              feedback
                ? React.createElement(
                    "button",
                    { className: "cx-quest-secondary", onClick: share },
                    "Share",
                  )
                : null,
            ),
            loadingFb ? React.createElement(Skeleton, { lines: 5 }) : null,
            fbErr
              ? React.createElement("p", { className: "cx-quest-err" }, "⚠ " + fbErr)
              : null,
            feedback
              ? React.createElement(
                  "section",
                  { className: "cx-quest-feedback" },
                  React.createElement("h3", null, "Feedback"),
                  React.createElement("p", null, feedback),
                )
              : null,
          )
        : null,
    ),
    React.createElement(
      "footer",
      { className: "cx-quest-foot" },
      React.createElement(
        "button",
        {
          className: "cx-quest-nav cx-quest-prev",
          onClick: goPrev,
          disabled: phase === "step" && stepIdx === 0,
        },
        "← Previous",
      ),
      React.createElement(
        "span",
        { className: "cx-quest-foot-mid" },
        quest.blurb || "",
      ),
      phase === "step"
        ? React.createElement(
            "button",
            { className: "cx-quest-nav cx-quest-next", onClick: goNext },
            stepIdx === total - 1 ? "Finish →" : "Next →",
          )
        : null,
    ),
  );
}
