// @vitest-environment jsdom
// jsdom does not implement speechSynthesis, so the engine reports unavailable and
// the Reading pane shows its browser-fallback notice — the same path the legacy
// took. Switching to the Prayer tab exercises the prayer-formats loader via the
// mocked window.CODEX_MODULES and renders a tradition card.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { VoxPanel } from "./VoxPanel.js";
import type { VoxWindow } from "./vox-window.js";

const W = (): VoxWindow => window as unknown as VoxWindow;

// jsdom here ships a localStorage object with no methods; install an in-memory
// Storage so the panel's voice-pref reads/writes behave.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

beforeEach(() => {
  installStorage();
  delete W().CODEX_MODULES;
});

describe("VoxPanel", () => {
  it("renders both tabs and the speechSynthesis-unavailable notice in Reading mode", () => {
    render(<VoxPanel />);
    expect(screen.getByText("◉ READING")).toBeTruthy();
    expect(screen.getByText("✶ PRAYER")).toBeTruthy();
    expect(screen.getByText(/does not expose speechSynthesis/)).toBeTruthy();
  });

  it("switches to the Prayer tab and renders a tradition card from CODEX_MODULES", async () => {
    W().CODEX_MODULES = {
      loadModule: async () => ({
        formats: [
          { id: "test-format", name: "Test Prayer", tradition: "Testing", badge: "interfaith", summary: "A summary", sections: [] },
        ],
      }),
    };
    render(<VoxPanel />);
    fireEvent.click(screen.getByText("✶ PRAYER"));
    expect(await screen.findByText("Test Prayer")).toBeTruthy();
    expect(screen.getByText("1 traditions")).toBeTruthy();
  });
});
