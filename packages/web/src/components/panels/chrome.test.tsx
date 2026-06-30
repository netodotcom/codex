// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CacheBadge, Collapsible, PanelStatus, RegenBtn } from "./chrome.js";

describe("CacheBadge", () => {
  it("renders seed / cached / fresh states (and nothing for no meta)", () => {
    const { rerender, container } = render(<CacheBadge meta={{ seed: true }} />);
    expect(screen.getByText(/SEED/)).toBeTruthy();
    rerender(<CacheBadge meta={{ fromCache: true, fetchedAt: 0 }} />);
    expect(screen.getByText(/CACHED · OFFLINE/)).toBeTruthy();
    rerender(<CacheBadge meta={{ fresh: true }} />);
    expect(screen.getByText(/JUST FETCHED/)).toBeTruthy();
    rerender(<CacheBadge meta={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Collapsible", () => {
  it("toggles when uncontrolled and pads the count", () => {
    const { container } = render(
      <Collapsible title="Talmud" count={5} defaultOpen={false}>
        <p>body</p>
      </Collapsible>,
    );
    expect(screen.getByText("05")).toBeTruthy(); // padded count
    const section = container.querySelector(".cx-coll")!;
    expect(section.classList.contains("is-open")).toBe(false);
    fireEvent.click(screen.getByText("Talmud"));
    expect(section.classList.contains("is-open")).toBe(true);
  });
});

describe("PanelStatus", () => {
  const passage = { book: "John", chapter: 1 };
  it("shows loading, error (with retry) and empty states", () => {
    const onRegen = vi.fn();
    const { rerender } = render(<PanelStatus status={{ loading: true }} passage={passage} onRegenerate={onRegen} kind="talmud" />);
    expect(screen.getByText(/DRAFTING TALMUD · John 1/)).toBeTruthy();

    rerender(<PanelStatus status={{ error: "boom" }} passage={passage} onRegenerate={onRegen} kind="talmud" />);
    expect(screen.getByText("boom")).toBeTruthy();
    fireEvent.click(screen.getByText(/RETRY/));
    expect(onRegen).toHaveBeenCalledOnce();

    rerender(<PanelStatus status={{}} passage={passage} onRegenerate={onRegen} kind="talmud" />);
    expect(screen.getByText(/Generate companion material for John 1/)).toBeTruthy();
  });
});

describe("RegenBtn", () => {
  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<RegenBtn onClick={onClick} />);
    fireEvent.click(screen.getByText(/REDRAFT/));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
