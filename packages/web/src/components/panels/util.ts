// panels — small shared UI utilities (Backlog 4.1). Extracted from panels.jsx.
import React from "react";

/** Zero-pad to two digits (the collapsible count badge). */
export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface ClickableProps {
  role: "button";
  tabIndex: number;
  "aria-label": string;
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/** Make a non-button element behave like a button (click + Enter/Space). */
export function clickableProps(onActivate: () => void, label: string): ClickableProps {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick: (e) => {
      e.stopPropagation();
      onActivate();
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
