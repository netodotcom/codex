// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CrossRefPanel } from "./CrossRefPanel.js";

interface PanelWindow {
  CODEX_MODULES?: { loadModule: () => Promise<never> };
  codexXrefCenter?: unknown;
  codexXrefState?: unknown;
}
const pw = (): PanelWindow => window as unknown as PanelWindow;

beforeEach(() => {
  // Hold the panel in its loading state deterministically (never resolves),
  // so the canvas (which jsdom can't paint) is never mounted.
  pw().CODEX_MODULES = { loadModule: () => new Promise<never>(() => {}) };
});

describe("CrossRefPanel", () => {
  it("renders the loading state, self-injects its CSS, and installs the automation hooks", () => {
    render(<CrossRefPanel bookId="jhn" chapter={3} verse={16} />);

    // the in-surface loading line + the masthead label
    expect(screen.getByText("Loading TSK…")).toBeTruthy();
    expect(screen.getByText("Treasury of Scripture Knowledge")).toBeTruthy();

    // idempotent self-injected stylesheet (same id as v1)
    expect(document.getElementById("cx-xref-graph-css")).not.toBeNull();

    // the codexConstInspect automation hooks land on window on mount
    expect(typeof pw().codexXrefCenter).toBe("function");
    expect(typeof pw().codexXrefState).toBe("function");
  });
});
