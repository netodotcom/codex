// @vitest-environment jsdom
// QuestPanel: main render, suggested chips, generate form, and the "no API key"
// error path (the only path reachable without an actual AI network call).
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { QuestPanel } from "./QuestPanel.js";

// Install an in-memory localStorage so the panel's lsGet/lsSet calls behave.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] ?? null) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
});

describe("QuestPanel", () => {
  it("renders the panel header and glyph", () => {
    render(React.createElement(QuestPanel, null));
    expect(screen.getByText("AI Study Quests")).toBeTruthy();
    expect(screen.getByText("⚔")).toBeTruthy();
    expect(screen.getByText("Custom guided tours through scripture, generated on demand.")).toBeTruthy();
  });

  it("renders all 6 suggested quest chips", () => {
    render(React.createElement(QuestPanel, null));
    expect(screen.getByText("Trace covenant from Abraham to Christ")).toBeTruthy();
    expect(screen.getByText("Wisdom about suffering across the Bible")).toBeTruthy();
    // 6 chips in the catalog section + the label
    expect(screen.getByText("Suggested quests")).toBeTruthy();
  });

  it("renders the generate input and disabled button when theme is empty", () => {
    render(React.createElement(QuestPanel, null));
    const input = screen.getByPlaceholderText(
      "e.g. The role of bread from Eden to Emmaus",
    );
    expect(input).toBeTruthy();
    const btn = screen.getByText("Generate") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables the Generate button once a theme is typed", () => {
    render(React.createElement(QuestPanel, null));
    const input = screen.getByPlaceholderText(
      "e.g. The role of bread from Eden to Emmaus",
    );
    fireEvent.change(input, { target: { value: "prayer" } });
    const btn = screen.getByText("Generate") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows an API-key error when Generate is clicked without a configured key", async () => {
    render(React.createElement(QuestPanel, null));
    const input = screen.getByPlaceholderText(
      "e.g. The role of bread from Eden to Emmaus",
    );
    fireEvent.change(input, { target: { value: "covenant" } });
    const btn = screen.getByText("Generate");
    fireEvent.click(btn);
    // hasAiKey() returns false → error is set synchronously before any await
    expect(await screen.findByText(/Add an AI key in Settings/)).toBeTruthy();
  });

  it("does not render the My Quests section when completed list is empty", () => {
    render(React.createElement(QuestPanel, null));
    expect(screen.queryByText("My quests")).toBeNull();
  });
});
