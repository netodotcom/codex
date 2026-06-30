// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PoiDossier, type Poi, type WikiInfo, type PoiRefs } from "./PoiDossier.js";

const poi: Poi = { name: "Jericho", kind: "city", lat: 31.86, lng: 35.44, from: -8000, to: 70 };
const fmtYear = (y: number): string => (y < 0 ? `${Math.abs(y)} BC` : `${y} AD`);

function renderDossier(over: Partial<{ wiki: WikiInfo; refs: PoiRefs; onClose: () => void; onGoto: (r: string) => void }> = {}) {
  const wiki: WikiInfo = over.wiki ?? { summary: "Oldest city.", thumbUrl: null, pageUrl: "http://w/Jericho" };
  const refs: PoiRefs = over.refs ?? { refs: ["jos.6.20"], src: "atlas" };
  const onClose = over.onClose ?? vi.fn();
  const onGoto = over.onGoto ?? vi.fn();
  render(
    <PoiDossier
      poi={poi}
      onClose={onClose}
      onGoto={onGoto}
      fmtYear={fmtYear}
      resolveWiki={async () => wiki}
      resolveRefs={async () => refs}
    />,
  );
  return { onClose, onGoto };
}

describe("PoiDossier", () => {
  it("resolves wiki + refs and renders the summary and READ chips", async () => {
    const { onGoto } = renderDossier();
    expect(screen.getByText("Jericho")).toBeTruthy();
    expect(await screen.findByText("Oldest city.")).toBeTruthy();
    const chip = await screen.findByText(/READ Joshua 6:20/);
    fireEvent.click(chip);
    expect(onGoto).toHaveBeenCalledWith("jos.6.20");
  });

  it("shows the year range via the injected fmtYear and fires onClose", () => {
    const { onClose } = renderDossier();
    expect(screen.getByText(/known 8000 BC/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close dossier"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a no-refs message when none are on record", async () => {
    renderDossier({ refs: { refs: [], src: "atlas" } });
    expect(await screen.findByText(/no direct scripture refs/)).toBeTruthy();
  });
});
