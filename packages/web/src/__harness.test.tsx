// @vitest-environment jsdom
// Component-test harness validation (Backlog 4.0): proves classic-JSX .tsx +
// real React 18 + jsdom + Testing Library all work, so component migrations can
// be driven test-first. (The build-side React shim is exercised by the first
// real component migration in 4.1, gated by the parity probe.)
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

function Hello({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}

describe("component test harness", () => {
  it("renders a TSX component under jsdom", () => {
    render(<Hello name="CODEX" />);
    expect(screen.getByText("Hello, CODEX")).toBeTruthy();
  });
});
