// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { cxrInjectSoulCss, CXR_SOUL_CSS } from "./soul-style.js";

beforeEach(() => {
  const prev = document.getElementById("cxr-soul-style");
  if (prev) prev.remove();
});

describe("cxrInjectSoulCss", () => {
  it("injects an idempotent <style id='cxr-soul-style'> carrying the soul CSS", () => {
    cxrInjectSoulCss();
    const el = document.getElementById("cxr-soul-style");
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe("STYLE");
    expect(el?.textContent).toBe(CXR_SOUL_CSS);
  });

  it("does not inject a second time", () => {
    cxrInjectSoulCss();
    cxrInjectSoulCss();
    expect(document.querySelectorAll("#cxr-soul-style").length).toBe(1);
  });

  it("carries the golden-Name and gloss selectors", () => {
    expect(CXR_SOUL_CSS).toContain(".cxr-name");
    expect(CXR_SOUL_CSS).toContain(".cxr-gloss");
    expect(CXR_SOUL_CSS).toContain(".cxr-spawn-pop");
  });
});
