// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { txOfflineState } from "./helpers.js";

const t = { source: "network", name: "KJV" };

describe("txOfflineState (ground truth)", () => {
  it("returns net when no stats or dl", () => {
    expect(txOfflineState(t, null, null)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("returns net with undefined stats and dl", () => {
    expect(txOfflineState(t, undefined, undefined)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("returns full for bundle source regardless of stats", () => {
    expect(txOfflineState({ source: "bundle", name: "KJV" }, null, null)).toEqual({ kind: "full", downloading: false, ratio: 1 });
  });

  it("returns full when stats.fully is true", () => {
    expect(txOfflineState(t, { fully: true, total: 100, cached: 100 }, null)).toEqual({ kind: "full", downloading: false, ratio: 1 });
  });

  it("returns part when cached/total ratio > 0", () => {
    expect(txOfflineState(t, { total: 100, cached: 50 }, null)).toEqual({ kind: "part", downloading: false, ratio: 0.5 });
  });

  it("returns net when cached is 0 of total", () => {
    expect(txOfflineState(t, { total: 100, cached: 0 }, null)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("returns net when total is 0 (avoids division by zero)", () => {
    expect(txOfflineState(t, { total: 0, cached: 0 }, null)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("returns part with downloading=true when dl is active", () => {
    const dl = { complete: false, aborted: false, total: 100, done: 30 };
    expect(txOfflineState(t, null, dl)).toEqual({ kind: "part", downloading: true, ratio: 0.3 });
  });

  it("returns part with ratio 0 when dl has no total", () => {
    const dl = { complete: false, aborted: false, done: 30 };
    expect(txOfflineState(t, null, dl)).toEqual({ kind: "part", downloading: true, ratio: 0 });
  });

  it("ignores active dl when complete=true", () => {
    const dl = { complete: true, aborted: false, total: 100, done: 100 };
    expect(txOfflineState(t, null, dl)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("ignores active dl when aborted=true", () => {
    const dl = { complete: false, aborted: true, total: 100, done: 50 };
    expect(txOfflineState(t, null, dl)).toEqual({ kind: "net", downloading: false, ratio: 0 });
  });

  it("dl takes priority over stats when actively downloading", () => {
    const dl = { complete: false, aborted: false, total: 200, done: 60 };
    // even though stats says partly cached, the dl state wins
    expect(txOfflineState(t, { total: 200, cached: 60 }, dl)).toEqual({ kind: "part", downloading: true, ratio: 0.3 });
  });
});
