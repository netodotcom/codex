// ai-quests — QuestPanel + imperative launchers (migrated verbatim from
// ai-quests.jsx). QuestPanel renders the generator UI and the saved-quests
// catalog. launchRunner / launchCatalog imperatively mount React roots (the
// same pattern the legacy IIFE used) so they can be triggered from the
// status-bar QUESTS button or from within the panel itself.
// DOM output, class names, state shape, and side-effects are unchanged from v1.
import React from "react";
import { QuestRunner, Skeleton } from "./QuestRunner.js";
import {
  SUGGESTED,
  SAVED_KEY,
  stateKey,
  answersKey,
  draftKey,
  lsGet,
  lsSet,
  lsDel,
  hasAiKey,
  newQuestId,
  tryImportFromHash,
} from "./helpers.js";
import { generateQuest } from "./api.js";
import { aqw } from "./ai-quests-window.js";
import type { Quest, QuestEnvelope } from "./helpers.js";

const { useState, useEffect } = React;

// ── Imperative launchers ───────────────────────────────────────────────────────
export function launchRunner(
  quest: Quest,
  onCompleteCb?: (envelope: QuestEnvelope) => void,
): void {
  const rd = aqw().ReactDOM;
  if (!rd) return;

  let host = document.getElementById("cx-ai-quest-host");
  if (!host) {
    const el = document.createElement("div");
    el.id = "cx-ai-quest-host";
    document.body.appendChild(el);
    host = el;
  }
  const safeHost = host;
  const root = rd.createRoot(safeHost);
  const close = (): void => { root.unmount(); safeHost.remove(); };
  root.render(
    React.createElement(QuestRunner, {
      quest,
      onClose: close,
      onComplete: (envelope: QuestEnvelope): void => {
        if (typeof onCompleteCb === "function") onCompleteCb(envelope);
      },
    }),
  );
}

export function launchCatalog(): void {
  const rd = aqw().ReactDOM;
  if (!rd) return;

  let host = document.getElementById("cx-ai-quest-cat-host");
  if (!host) {
    const el = document.createElement("div");
    el.id = "cx-ai-quest-cat-host";
    document.body.appendChild(el);
    host = el;
  }
  const safeHost = host;
  const root = rd.createRoot(safeHost);
  const close = (): void => { root.unmount(); safeHost.remove(); };

  const Wrapper = (): React.ReactElement =>
    React.createElement(
      "div",
      {
        className: "cx-quest-overlay cx-quest-overlay-catalog",
        role: "dialog",
      },
      React.createElement(
        "header",
        { className: "cx-quest-head" },
        React.createElement("span", { className: "cx-quest-tag" }, "AI QUESTS"),
        React.createElement(
          "h2",
          { className: "cx-quest-title-bar" },
          "Study Quest Catalog",
        ),
        React.createElement("button", {
          className: "cx-quest-close",
          onClick: close,
          "aria-label": "Close",
        }, "✕"),
      ),
      React.createElement(
        "div",
        { className: "cx-quest-body cx-quest-body-catalog" },
        React.createElement(QuestPanel, null),
      ),
    );

  root.render(React.createElement(Wrapper));
}

// ── QuestPanel ────────────────────────────────────────────────────────────────
export function QuestPanel(): React.ReactElement {
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Quest | null>(null);
  const [completed, setCompleted] = useState<QuestEnvelope[]>(() =>
    lsGet<QuestEnvelope[]>(SAVED_KEY, []),
  );

  useEffect(() => {
    // Pick up shared quests from URL hash on mount
    const shared = tryImportFromHash();
    if (shared && shared.steps) {
      setPreview({ ...shared, id: shared.id ?? newQuestId() } as Quest);
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch { /* ignore */ }
    }
  }, []);

  const refreshCompleted = (): void =>
    setCompleted(lsGet<QuestEnvelope[]>(SAVED_KEY, []));

  const startGenerate = async (q?: string): Promise<void> => {
    const query = (q ?? theme ?? "").trim();
    if (!query) return;
    if (!hasAiKey()) {
      setErr("Add an AI key in Settings → AI Engines.");
      return;
    }
    setLoading(true); setErr(null); setPreview(null);
    try {
      const quest = await generateQuest(query);
      setPreview(quest);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const begin = (quest: Quest): void => {
    launchRunner(quest, () => refreshCompleted());
  };

  const resume = (envelope: QuestEnvelope): void => {
    // Re-launch a previously-completed (or in-progress) quest envelope.
    const quest: Quest = {
      id: envelope.id,
      title: envelope.title,
      theme: envelope.theme,
      blurb: envelope.blurb,
      estimate_minutes: envelope.estimate_minutes,
      steps: envelope.steps,
      synthesis_prompt: envelope.synthesis_prompt,
    };
    launchRunner(quest, () => refreshCompleted());
  };

  const deleteSaved = (id: string): void => {
    const list = lsGet<QuestEnvelope[]>(SAVED_KEY, []).filter((x) => x.id !== id);
    lsSet(SAVED_KEY, list);
    lsDel(stateKey(id));
    lsDel(answersKey(id));
    lsDel(draftKey(id));
    setCompleted(list);
  };

  return React.createElement(
    "div",
    { className: "cx-quest-panel" },
    React.createElement(
      "header",
      { className: "cx-quest-panel-h" },
      React.createElement("span", { className: "cx-quest-panel-glyph" }, "⚔"),
      React.createElement(
        "div",
        null,
        React.createElement("h3", null, "AI Study Quests"),
        React.createElement(
          "p",
          { className: "cx-quest-panel-sub" },
          "Custom guided tours through scripture, generated on demand.",
        ),
      ),
    ),

    // Suggested chip catalog
    React.createElement(
      "section",
      { className: "cx-quest-catalog" },
      React.createElement("div", { className: "cx-quest-cat-label" }, "Suggested quests"),
      React.createElement(
        "div",
        { className: "cx-quest-chips" },
        ...SUGGESTED.map((s, i) =>
          React.createElement(
            "button",
            {
              key: i,
              className: "cx-quest-chip",
              onClick: (): void => {
                setTheme(s);
                void startGenerate(s);
              },
              disabled: loading,
            },
            s,
          ),
        ),
      ),
    ),

    // Free-form input
    React.createElement(
      "section",
      { className: "cx-quest-gen" },
      React.createElement(
        "label",
        { className: "cx-quest-gen-label" },
        "Generate a quest about…",
      ),
      React.createElement(
        "div",
        { className: "cx-quest-gen-row" },
        React.createElement("input", {
          type: "text",
          className: "cx-quest-gen-input",
          placeholder: "e.g. The role of bread from Eden to Emmaus",
          value: theme,
          onChange: (e: React.ChangeEvent<HTMLInputElement>): void =>
            setTheme(e.target.value),
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
            if (e.key === "Enter") void startGenerate();
          },
          disabled: loading,
        }),
        React.createElement(
          "button",
          {
            className: "cx-quest-gen-btn",
            onClick: (): void => { void startGenerate(); },
            disabled: loading || !theme.trim(),
          },
          loading ? "Designing…" : "Generate",
        ),
      ),
      loading ? React.createElement(Skeleton, { lines: 7 }) : null,
      err
        ? React.createElement("p", { className: "cx-quest-err" }, "⚠ " + err)
        : null,
    ),

    // Preview of freshly generated quest
    preview
      ? React.createElement(
          "section",
          { className: "cx-quest-preview" },
          React.createElement(
            "div",
            { className: "cx-quest-preview-card" },
            React.createElement("div", { className: "cx-quest-preview-tag" }, "READY"),
            React.createElement("h3", null, preview.title),
            preview.blurb
              ? React.createElement(
                  "p",
                  { className: "cx-quest-preview-blurb" },
                  preview.blurb,
                )
              : null,
            React.createElement(
              "div",
              { className: "cx-quest-preview-meta" },
              React.createElement("span", null, `${preview.steps.length} steps`),
              preview.estimate_minutes
                ? React.createElement("span", null, `~${preview.estimate_minutes} min`)
                : null,
            ),
            React.createElement(
              "ol",
              { className: "cx-quest-preview-steps" },
              ...preview.steps.map((s, i) =>
                React.createElement(
                  "li",
                  { key: i },
                  React.createElement("b", null, s.passage),
                  " — ",
                  s.question,
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "cx-quest-preview-actions" },
              React.createElement(
                "button",
                {
                  className: "cx-quest-primary",
                  onClick: (): void => begin(preview),
                },
                "Begin",
              ),
              React.createElement(
                "button",
                {
                  className: "cx-quest-secondary",
                  onClick: (): void => setPreview(null),
                },
                "Dismiss",
              ),
            ),
          ),
        )
      : null,

    // My Quests
    completed && completed.length
      ? React.createElement(
          "section",
          { className: "cx-quest-saved" },
          React.createElement("div", { className: "cx-quest-cat-label" }, "My quests"),
          React.createElement(
            "ul",
            { className: "cx-quest-saved-list" },
            ...completed.map((e) =>
              React.createElement(
                "li",
                { key: e.id, className: "cx-quest-saved-item" },
                React.createElement(
                  "div",
                  { className: "cx-quest-saved-body" },
                  React.createElement("b", null, e.title),
                  e.blurb
                    ? React.createElement("i", null, e.blurb)
                    : null,
                  React.createElement(
                    "span",
                    { className: "cx-quest-saved-meta" },
                    `${e.steps.length} steps · ${new Date(e.completed_at || Date.now()).toLocaleDateString()}`,
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "cx-quest-saved-actions" },
                  React.createElement(
                    "button",
                    {
                      className: "cx-quest-mini",
                      onClick: (): void => resume(e),
                    },
                    "Open",
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "cx-quest-mini cx-quest-mini-warn",
                      onClick: (): void => deleteSaved(e.id),
                    },
                    "Delete",
                  ),
                ),
              ),
            ),
          ),
        )
      : null,
  );
}
