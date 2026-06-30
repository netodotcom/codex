// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ContinuityIndicator, AnalystDossier, QuestList, NextThread, ContinuityMount } from "./ContinuityPanel.js";

// Minimal window-boundary shims. The components read the engine + a couple of
// host globals through the typed accessor; tests assign loose stubs via unknown.
type WinStub = {
  CODEX_ENGAGEMENT?: unknown;
  IntelBanner?: unknown;
};
function win(): WinStub {
  return window as unknown as WinStub;
}
function setEngine(stub: Record<string, unknown> | null): void {
  win().CODEX_ENGAGEMENT = stub === null ? undefined : stub;
}

beforeEach(() => {
  win().CODEX_ENGAGEMENT = undefined;
  win().IntelBanner = undefined;
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("ContinuityIndicator", () => {
  it("renders the count, status text, grace dots and the ring %", () => {
    const status = {
      current: 5,
      longest: 9,
      grace: 1,
      graceCap: 2,
      graceSpent: 0,
      sinceGrace: 3,
      nextGraceIn: 4,
      lastDay: "2024-01-01",
      statusText: "Active continuity",
    };
    setEngine({ continuity: () => status, continuityStatus: () => status });

    const { container } = render(<ContinuityIndicator />);
    expect(screen.getByText("5")).toBeTruthy(); // current continuity count
    expect(screen.getByText("Active continuity")).toBeTruthy(); // verbatim engine status
    expect(screen.getByText("Grace ◆◇")).toBeTruthy(); // 1 held of cap 2

    // ringPct = round(3 / (3 + 4) * 100) = 43
    const ring = container.querySelector(".cx-continuity-ring");
    expect(ring?.getAttribute("aria-label")).toBe("Continuity ring · 43%");
  });

  it("renders nothing when the engine has no status", () => {
    setEngine({ continuity: () => null, continuityStatus: () => null });
    const { container } = render(<ContinuityIndicator />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AnalystDossier", () => {
  it("shows the graceful empty state when the engine is absent", () => {
    setEngine(null);
    render(<AnalystDossier />);
    expect(screen.getByText(/No threads opened yet/)).toBeTruthy();
  });

  it("renders the desk, the host IntelBanner, and the derived top-domain stat", () => {
    win().IntelBanner = () => React.createElement("div", null, "INTEL-BANNER");
    setEngine({
      continuityStatus: () => ({ current: 2, longest: 9 }),
      continuity: () => ({ current: 2, longest: 9 }),
      mastery: () => ({
        "canon-coverage": { threads: 3 },
        gematria: { threads: 7, score: 50, level: 0, levelLabel: "Apprentice" },
      }),
      milestones: () => ({ unlocked: {} }),
      eventLog: () => [],
      listQuests: () => [],
    });

    render(<AnalystDossier />);
    expect(screen.getByText("Analyst desk")).toBeTruthy();
    expect(screen.getByText("INTEL-BANNER")).toBeTruthy(); // unconditional host chrome
    expect(screen.getByText("Mastery")).toBeTruthy();
    // top domain by closed threads = gematria · 7
    expect(screen.getByText("gematria · 7")).toBeTruthy();
  });
});

describe("QuestList", () => {
  it("renders the empty case when there are no quests", () => {
    setEngine({ listQuests: () => [] });
    render(<QuestList />);
    expect(screen.getByText(/No threads opened yet/)).toBeTruthy();
  });
});

describe("NextThread", () => {
  it("renders a suggestion and hides it once dismissed", () => {
    setEngine({ nextThread: () => ({ kind: "quest-start", title: "Open a new thread" }) });
    render(<NextThread />);
    expect(screen.getByText("Open a new thread")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Dismiss suggestion"));
    expect(screen.queryByText("Open a new thread")).toBeNull();
  });

  it("renders nothing when the engine reports no suggestion", () => {
    setEngine({ nextThread: () => ({ kind: "none" }) });
    const { container } = render(<NextThread />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ContinuityMount", () => {
  it("mounts the next-thread surface when not in lite mode and the engine is live", () => {
    setEngine({ nextThread: () => ({ kind: "quest-start", title: "Open a new thread" }) });
    const { container } = render(<ContinuityMount />);
    expect(container.querySelector(".cx-continuity-mount")).not.toBeNull();
    expect(screen.getByText("Open a new thread")).toBeTruthy();
  });

  it("renders nothing when the engine is absent", () => {
    setEngine(null);
    const { container } = render(<ContinuityMount />);
    expect(container.firstChild).toBeNull();
  });
});
