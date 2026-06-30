// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import "./index.js"; // side-effect: installs the busy bus + sets the public surface

interface ArtifactsWindow {
  CODEX_ARTIFACTS?: {
    Rich: unknown;
    render(text: unknown): React.ReactElement;
    splitOnRefs: (t: unknown) => Array<{ type: string }>;
    runAction: unknown;
    openPanel: unknown;
    setTweak: unknown;
    jump: unknown;
    directiveDoc: () => string;
    ensureCss: () => void;
    parseBlocks: (t: unknown) => Array<{ type: string }>;
  };
  ArtifactsRich?: unknown;
  CODEX_AI_BUSY?: { begin(l: string): number; end(id: number): void; active(): boolean };
}
function aw(): ArtifactsWindow {
  return window as unknown as ArtifactsWindow;
}

describe("artifacts entry — window surface", () => {
  it("exposes window.CODEX_ARTIFACTS with the exact legacy surface", () => {
    const api = aw().CODEX_ARTIFACTS;
    expect(api).toBeTruthy();
    expect(typeof api?.Rich).toBe("function");
    expect(typeof api?.render).toBe("function");
    expect(typeof api?.splitOnRefs).toBe("function");
    expect(typeof api?.runAction).toBe("function");
    expect(typeof api?.openPanel).toBe("function");
    expect(typeof api?.setTweak).toBe("function");
    expect(typeof api?.jump).toBe("function");
    expect(typeof api?.directiveDoc).toBe("function");
    expect(typeof api?.ensureCss).toBe("function");
    expect(typeof api?.parseBlocks).toBe("function");
  });

  it("also re-exports window.ArtifactsRich", () => {
    expect(typeof aw().ArtifactsRich).toBe("function");
    expect(aw().ArtifactsRich).toBe(aw().CODEX_ARTIFACTS?.Rich);
  });

  it("render() builds an ArtifactsRich element and ensureCss injects the stylesheet", () => {
    const api = aw().CODEX_ARTIFACTS;
    const el = api?.render("John 1:1");
    expect(React.isValidElement(el)).toBe(true);
    api?.ensureCss();
    expect(document.getElementById("cx-artifacts-css")).not.toBeNull();
  });

  it("splitOnRefs / parseBlocks are wired to the real engines", () => {
    const api = aw().CODEX_ARTIFACTS;
    expect(api?.splitOnRefs("John 1:1").some((s) => s.type === "ref")).toBe(true);
    expect(api?.parseBlocks("# Hi")).toEqual([{ type: "h", level: 1, text: "Hi" }]);
  });

  it("installs the CODEX_AI_BUSY bus and toggles the orb", () => {
    const bus = aw().CODEX_AI_BUSY;
    expect(bus).toBeTruthy();
    expect(bus?.active()).toBe(false);
    const id = bus!.begin("thinking");
    expect(bus?.active()).toBe(true);
    expect(document.getElementById("cx-ai-orb")).not.toBeNull();
    bus!.end(id);
    expect(bus?.active()).toBe(false);
    expect(document.getElementById("cx-ai-orb")).toBeNull();
  });
});
