// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExegesisPanel, type ExegesisService, type ExegesisData } from "./ExegesisPanel.js";

const passage = { bookId: "jhn", book: "John", chapter: 1 };

function service(over: Partial<ExegesisService> = {}): ExegesisService {
  return {
    getCached: () => null,
    getMeta: () => null,
    load: async () => ({}),
    purge: () => {},
    ...over,
  };
}

describe("ExegesisPanel", () => {
  it("shows the empty/draft state and fetches on demand", async () => {
    const data: ExegesisData = { literary_structure: "chiasm", preferred_reading: "the Logos reading" };
    const load = vi.fn(async () => data);
    render(<ExegesisPanel passage={passage} service={service({ load })} />);
    expect(screen.getByText("EXEGESIS · DEEP ANALYSIS")).toBeTruthy();
    fireEvent.click(screen.getByText(/DRAFT VIA ORACLE/));
    expect(load).toHaveBeenCalledOnce();
    expect(await screen.findByText("chiasm")).toBeTruthy();
    expect(screen.getByText("the Logos reading")).toBeTruthy();
  });

  it("renders cached data immediately", () => {
    const cached: ExegesisData = { historical_context: "Second Temple Judaism" };
    render(<ExegesisPanel passage={passage} service={service({ getCached: () => cached })} />);
    expect(screen.getByText("Second Temple Judaism")).toBeTruthy();
    expect(screen.getByText("HISTORICAL CONTEXT")).toBeTruthy();
  });

  it("purges + refetches on regenerate", async () => {
    const purge = vi.fn();
    const load = vi.fn(async () => ({ literary_structure: "new" }));
    render(<ExegesisPanel passage={passage} service={service({ getCached: () => ({ literary_structure: "old" }), purge, load })} />);
    fireEvent.click(screen.getByText(/REDRAFT/));
    expect(purge).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText("new")).toBeTruthy());
  });
});
