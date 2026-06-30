// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderScripture, renderRedLetter } from "./render-scripture.js";

describe("renderScripture", () => {
  it("wraps red clauses in .cx-red and leaves plain text bare", () => {
    const { container } = render(<p>{renderScripture("Jesus said Love one another to them.", ["Love one another"], false)}</p>);
    const reds = container.querySelectorAll(".cx-red");
    expect(reds).toHaveLength(1);
    expect(reds[0]?.textContent).toBe("Love one another");
    expect(container.textContent).toBe("Jesus said Love one another to them.");
  });

  it("paints the whole verse red on the last-resort fallback", () => {
    const { container } = render(<p>{renderScripture("Ego sum via veritas et vita.", null, true)}</p>);
    const reds = container.querySelectorAll(".cx-red");
    expect(reds).toHaveLength(1);
    expect(reds[0]?.textContent).toBe("Ego sum via veritas et vita.");
  });

  it("renders nothing red when there are no quotes", () => {
    const { container } = render(<p>{renderScripture("In the beginning.", null, false)}</p>);
    expect(container.querySelectorAll(".cx-red")).toHaveLength(0);
    expect(container.textContent).toBe("In the beginning.");
  });

  it("renderRedLetter is an alias", () => {
    const { container } = render(<p>{renderRedLetter("a beta c", ["beta"], false)}</p>);
    expect(container.querySelector(".cx-red")?.textContent).toBe("beta");
  });
});
