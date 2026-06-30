// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TimelinePanel } from "./TimelinePanel.js";

describe("TimelinePanel", () => {
  it("renders the resolving-chronology loading state and injects its CSS", () => {
    render(<TimelinePanel />);
    expect(screen.getByText(/RESOLVING CHRONOLOGY/)).toBeTruthy();
    // self-injected, idempotent stylesheet
    expect(document.getElementById("cx-tl2-css")).not.toBeNull();
  });
});
