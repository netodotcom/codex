// Node env: chunkText is pure; the engine is a singleton with no speechSynthesis
// here (window is undefined), so isAvailable() is false and speak() reports the
// unavailable error — exactly the legacy fallback path. Ground-truth values were
// captured by running a faithful copy of the original chunkText in node.
import { describe, it, expect } from "vitest";
import { VoxEngine } from "./engine.js";

describe("VoxEngine.chunkText (ground truth)", () => {
  it("returns [] for empty / whitespace", () => {
    expect(VoxEngine.chunkText("")).toEqual([]);
    expect(VoxEngine.chunkText("   ")).toEqual([]);
    expect(VoxEngine.chunkText(undefined)).toEqual([]);
  });

  it("returns the whole string when under the cap", () => {
    expect(VoxEngine.chunkText("Short verse.")).toEqual(["Short verse."]);
  });

  it("splits on sentence terminators under a small cap", () => {
    expect(
      VoxEngine.chunkText(
        "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep.",
        60,
      ),
    ).toEqual([
      "In the beginning God created the heaven and the earth.",
      "And the earth was without form, and void;",
      "and darkness was upon the face of the deep.",
    ]);
  });

  it("hard-splits a long terminator-free run on word boundaries", () => {
    expect(
      VoxEngine.chunkText("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi", 20),
    ).toEqual(["alpha beta gamma", "delta epsilon zeta", "eta theta iota kappa", "lambda mu nu xi"]);
  });

  it("keeps a single oversize word whole", () => {
    expect(VoxEngine.chunkText("supercalifragilisticexpialidocious word", 10)).toEqual([
      "supercalifragilisticexpialidocious",
      "word",
    ]);
    expect(VoxEngine.chunkText("x".repeat(250))).toEqual(["x".repeat(250)]);
  });

  it("packs short sentences up to the cap", () => {
    expect(VoxEngine.chunkText("A. B. C. D. E.", 5)).toEqual(["A. B.", "C. D.", "E."]);
    expect(VoxEngine.chunkText("one two three. four five six. seven eight nine ten.", 15)).toEqual([
      "one two three.",
      "four five six.",
      "seven eight",
      "nine ten.",
    ]);
  });
});

describe("VoxEngine without speechSynthesis", () => {
  it("reports unavailable and never throws on transport calls", () => {
    expect(VoxEngine.isAvailable()).toBe(false);
    expect(VoxEngine.isPlaying()).toBe(false);
    expect(VoxEngine.isPaused()).toBe(false);
    expect(VoxEngine.voices()).toEqual([]);
    expect(VoxEngine.listByLang()).toEqual({});
    expect(() => { VoxEngine.pause(); VoxEngine.resume(); VoxEngine.stop(); }).not.toThrow();
  });

  it("speak() invokes onError with the unavailable error and does not call onEnd", () => {
    let errored: unknown = null;
    let ended = false;
    VoxEngine.speak({ text: "hello", onError: (e) => { errored = e; }, onEnd: () => { ended = true; } });
    expect(errored).toBeInstanceOf(Error);
    expect((errored as Error).message).toBe("speechSynthesis unavailable");
    expect(ended).toBe(false);
  });
});
