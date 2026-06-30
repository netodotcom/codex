// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IntelDecrypt, IntelBars, IntelBanner, IntelTicker, IntelStamp } from "./components.js";

// ── IntelDecrypt ─────────────────────────────────────────────────────────────
describe("IntelDecrypt", () => {
  it("always sets aria-label to the full target text", () => {
    render(<IntelDecrypt text="GENESIS" />);
    expect(document.querySelector("[aria-label='GENESIS']")).not.toBeNull();
  });

  it("renders a <span> by default", () => {
    render(<IntelDecrypt text="TEST" />);
    const el = document.querySelector("span[aria-label='TEST']");
    expect(el).not.toBeNull();
  });

  it("renders with a custom `as` prop (div)", () => {
    render(<IntelDecrypt text="DIV-TAG" as="div" />);
    expect(document.querySelector("div[aria-label='DIV-TAG']")).not.toBeNull();
  });

  it("applies the cx-intel-decrypt class", () => {
    render(<IntelDecrypt text="CLS" className="extra" />);
    const el = document.querySelector(".cx-intel-decrypt.extra");
    expect(el).not.toBeNull();
  });

  it("handles null/undefined text gracefully (renders as empty)", () => {
    render(<IntelDecrypt text={null} />);
    expect(document.querySelector("[aria-label='']")).not.toBeNull();
  });
});

// ── IntelBars ────────────────────────────────────────────────────────────────
describe("IntelBars", () => {
  it("renders exactly 5 bar elements", () => {
    render(<IntelBars value={60} />);
    const bars = document.querySelectorAll(".cx-intel-bars i");
    expect(bars.length).toBe(5);
  });

  it("shows STRONG grade at value=80", () => {
    render(<IntelBars value={80} />);
    expect(screen.getByText("STRONG")).toBeTruthy();
  });

  it("shows MODERATE grade at value=50", () => {
    render(<IntelBars value={50} />);
    expect(screen.getByText("MODERATE")).toBeTruthy();
  });

  it("shows FAINT grade at value=0", () => {
    render(<IntelBars value={0} />);
    expect(screen.getByText("FAINT")).toBeTruthy();
  });

  it("has role=img for accessibility", () => {
    render(<IntelBars value={40} label="resonance" />);
    expect(document.querySelector("[role='img']")).not.toBeNull();
  });

  it("marks at least 1 bar lit even at value=0", () => {
    render(<IntelBars value={0} />);
    const lit = document.querySelectorAll(".cx-intel-bars i.is-lit");
    expect(lit.length).toBeGreaterThanOrEqual(1);
  });
});

// ── IntelBanner ──────────────────────────────────────────────────────────────
describe("IntelBanner", () => {
  it("renders the CODEX// prefix with console name", () => {
    render(<IntelBanner console="ORACLE" />);
    const sig = document.querySelector(".cx-intel-banner-sig");
    expect(sig?.textContent).toContain("CODEX//ORACLE");
  });

  it("appends //scope when provided", () => {
    render(<IntelBanner console="MIRROR" scope="GENESIS" />);
    const sig = document.querySelector(".cx-intel-banner-sig");
    expect(sig?.textContent).toContain("CODEX//MIRROR//GENESIS");
  });

  it("renders the default scholarly-survey note", () => {
    render(<IntelBanner />);
    expect(screen.getByText(/SCHOLARLY SURVEY, NOT PREDICTION/)).toBeTruthy();
  });

  it("renders a custom note when provided", () => {
    render(<IntelBanner note="CUSTOM NOTE" />);
    expect(screen.getByText("CUSTOM NOTE")).toBeTruthy();
  });

  it("has role=note", () => {
    render(<IntelBanner />);
    expect(document.querySelector("[role='note']")).not.toBeNull();
  });
});

// ── IntelTicker ──────────────────────────────────────────────────────────────
describe("IntelTicker", () => {
  it("renders the first item", () => {
    render(<IntelTicker items={["Alpha", "Beta", "Gamma"]} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("shows N/total counter when multiple items", () => {
    render(<IntelTicker items={["Alpha", "Beta"]} />);
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("hides counter for a single item", () => {
    render(<IntelTicker items={["Only"]} />);
    expect(document.querySelector(".cx-intel-ticker-n")).toBeNull();
  });

  it("returns null for empty items array", () => {
    const { container } = render(<IntelTicker items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("accepts object items with .text", () => {
    render(<IntelTicker items={[{ text: "Hello" }, { text: "World" }]} />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("filters out blank/invalid items", () => {
    const { container } = render(<IntelTicker items={["", null, undefined]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── IntelStamp ───────────────────────────────────────────────────────────────
describe("IntelStamp", () => {
  it("renders the code text", () => {
    render(<IntelStamp code="H-03" />);
    expect(screen.getByText("H-03")).toBeTruthy();
  });

  it("applies default accent tone class", () => {
    render(<IntelStamp code="X" />);
    expect(document.querySelector(".cx-intel-stamp.is-accent")).not.toBeNull();
  });

  it("applies a custom tone class", () => {
    render(<IntelStamp code="SRC-12" tone="dim" />);
    expect(document.querySelector(".cx-intel-stamp.is-dim")).not.toBeNull();
  });

  it("applies extra className", () => {
    render(<IntelStamp code="Y" className="my-stamp" />);
    expect(document.querySelector(".cx-intel-stamp.my-stamp")).not.toBeNull();
  });
});
