// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TweakToggle, TweakSlider, TweakRadio, TweakSelect, TweakColor } from "./controls.js";
import { TweaksPanel } from "./TweaksPanel.js";

function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
});

describe("tweak controls", () => {
  it("TweakToggle flips on click", () => {
    const onChange = vi.fn();
    render(<TweakToggle label="Red letter" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("TweakSlider shows the value with unit and emits numbers", () => {
    const onChange = vi.fn();
    render(<TweakSlider label="Size" value={22} min={16} max={30} unit="px" onChange={onChange} />);
    expect(screen.getByText("22px")).toBeTruthy();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "24" } });
    expect(onChange).toHaveBeenCalledWith(24);
  });

  it("TweakRadio renders short options as segments and selects", () => {
    const onChange = vi.fn();
    render(
      <TweakRadio
        label="Theme"
        value="day"
        options={[
          { value: "auto", label: "AUTO" },
          { value: "day", label: "DAY" },
          { value: "night", label: "NIGHT" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "NIGHT" }));
    expect(onChange).toHaveBeenCalledWith("night");
  });

  it("TweakRadio falls back to a select when labels are too long", () => {
    render(
      <TweakRadio
        label="Long"
        value="a"
        options={[
          { value: "a", label: "An extremely long label that will not fit as a segment" },
          { value: "b", label: "Another very long one indeed here" },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("TweakSelect emits the chosen value", () => {
    const onChange = vi.fn();
    render(<TweakSelect label="Lang" value="en" options={["en", "pt", "de"]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pt" } });
    expect(onChange).toHaveBeenCalledWith("pt");
  });

  it("TweakColor renders swatch chips and selects one", () => {
    const onChange = vi.fn();
    render(<TweakColor label="Mark" value="#7ee0ff" options={["#7ee0ff", "#ffd700"]} onChange={onChange} />);
    const chips = screen.getAllByRole("radio");
    expect(chips).toHaveLength(2);
    fireEvent.click(chips[1]!);
    expect(onChange).toHaveBeenCalledWith("#ffd700");
  });
});

describe("TweaksPanel", () => {
  it("is closed until opened, then renders all the setting groups", () => {
    const { container } = render(<TweaksPanel title="Settings" />);
    expect(container.querySelector(".twkx-panel")).toBeNull();
    act(() => {
      window.dispatchEvent(new CustomEvent("codex:open-settings"));
    });
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    // each group name appears twice — once in the nav rail, once as the header
    expect(screen.getAllByText("APPEARANCE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("THE NAME").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DANGER").length).toBeGreaterThan(0);
    // a self-rendered control is present
    expect(screen.getByText("Red-letter words of Jesus")).toBeTruthy();
  });

  it("closes on the ✕ button", () => {
    render(<TweaksPanel title="Settings" />);
    act(() => {
      window.dispatchEvent(new CustomEvent("codex:open-settings"));
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
