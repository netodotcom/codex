// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Omnibar } from "./Omnibar.js";

function input(): HTMLInputElement {
  return screen.getByLabelText("Omnibar input") as HTMLInputElement;
}

// jsdom under vitest ships a non-functional localStorage (setItem is not a
// function), which would push the bar onto its private-mode path. Install a
// working in-memory store so the real first-run / learned-usage logic runs.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string): string | null => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string): void => { store.set(k, String(v)); },
    removeItem: (k: string): void => { store.delete(k); },
    clear: (): void => { store.clear(); },
    key: (i: number): string | null => Array.from(store.keys())[i] ?? null,
    get length(): number { return store.size; },
  };
  Object.defineProperty(globalThis, "localStorage", { value: mock, configurable: true, writable: true });
  Object.defineProperty(window, "localStorage", { value: mock, configurable: true, writable: true });
}

describe("Omnibar", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("teaches on the empty bar: the five canonical guide rows + the first-run welcome, and self-injects its CSS", () => {
    render(<Omnibar onClose={() => {}} />);
    // the empty bar shows living examples in canonical order on a fresh install
    expect(screen.getByText("John 3:16")).toBeTruthy();
    expect(screen.getByText("sword John 1:1")).toBeTruthy();
    expect(screen.getByText("what do the prophets say about hope?")).toBeTruthy();
    expect(screen.getByText("galaxy")).toBeTruthy();
    expect(screen.getByText("help")).toBeTruthy();
    // guide chrome
    expect(screen.getByText("type anything — a verse, a question, a word")).toBeTruthy();
    expect(screen.getByText("try one — every row really runs")).toBeTruthy();
    // idempotent, self-injected stylesheet on mount
    expect(document.getElementById("cx-omni-guide-css")).not.toBeNull();
  });

  it("opens the command palette on '/': '/ops' filters to the OPS command", () => {
    render(<Omnibar onClose={() => {}} />);
    fireEvent.change(input(), { target: { value: "/ops" } });
    expect(screen.getByText("Open OPS — task the kernel")).toBeTruthy();
  });

  it("turns a question into a kernel mission row", () => {
    render(<Omnibar onClose={() => {}} />);
    fireEvent.change(input(), { target: { value: "how do prophets use fire?" } });
    expect(screen.getByText("Mission: how do prophets use fire?")).toBeTruthy();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Omnibar onClose={onClose} />);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens already aimed when handed a seed query", () => {
    render(<Omnibar onClose={() => {}} seed="John 1:14 " />);
    expect(input().value).toBe("John 1:14 ");
  });
});
