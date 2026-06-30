// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MapField } from "./MapField.js";

describe("MapField", () => {
  it("renders label + body inside the field row", () => {
    const { container } = render(<MapField label="POPULATIONS" body="dense settlement" />);
    expect(screen.getByText("POPULATIONS")).toBeTruthy();
    expect(screen.getByText("dense settlement")).toBeTruthy();
    expect(container.querySelector(".cx-map-field-row")).toBeTruthy();
    expect(container.querySelector(".cx-map-field-lbl")?.textContent).toBe("POPULATIONS");
    expect(container.querySelector(".cx-map-field-bd")?.textContent).toBe("dense settlement");
  });
});
