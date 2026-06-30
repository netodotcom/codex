// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TouristPanel, type TouristData } from "./TouristPanel.js";

const noop = () => {};

describe("TouristPanel", () => {
  it("shows the loading state", () => {
    render(<TouristPanel loading err={null} tourist={null} userPos={null} selected={null} onSelect={noop} onRetry={noop} />);
    expect(screen.getByText(/scanning 50 km/i)).toBeTruthy();
  });

  it("shows the error state and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<TouristPanel loading={false} err="boom" tourist={null} userPos={null} selected={null} onSelect={noop} onRetry={onRetry} />);
    expect(screen.getByText("boom")).toBeTruthy();
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders places and fires onSelect", () => {
    const tourist: TouristData = {
      your_location: "Jerusalem",
      places: [{ name: "Temple Mount", distance_km: 1.2, era: "Second Temple", summary: "…", biblical_refs: ["2chr.3.1"] }],
    };
    const onSelect = vi.fn();
    render(
      <TouristPanel
        loading={false}
        err={null}
        tourist={tourist}
        userPos={{ lat: 31.78, lng: 35.22, accuracy: 12 }}
        selected={null}
        onSelect={onSelect}
        onRetry={noop}
      />,
    );
    expect(screen.getByText("📍 Jerusalem")).toBeTruthy();
    expect(screen.getByText("Temple Mount")).toBeTruthy();
    expect(screen.getByText("1.2 km")).toBeTruthy();
    fireEvent.click(screen.getByText("Temple Mount"));
    expect(onSelect).toHaveBeenCalledWith(tourist.places?.[0]);
  });

  it("shows the empty state with an enable-location button", () => {
    render(<TouristPanel loading={false} err={null} tourist={null} userPos={null} selected={null} onSelect={noop} onRetry={noop} />);
    expect(screen.getByText("Enable location")).toBeTruthy();
  });
});
