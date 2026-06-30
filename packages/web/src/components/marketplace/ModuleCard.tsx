// marketplace — ModuleCard sub-component (migrated from marketplace.jsx).
import React from "react";
import type { IndexModule } from "./data.js";
import { typeBadge, fmtSize } from "./helpers.js";
import { S } from "./style.js";

interface ModuleCardProps {
  mod: IndexModule;
  installed: boolean;
  onOpen: (mod: IndexModule) => void;
  onInstall: (mod: IndexModule) => void;
  busy: boolean;
}

export function ModuleCard({ mod, installed, onOpen, onInstall, busy }: ModuleCardProps): React.ReactElement {
  const soon = !!mod._status && mod._status === "coming-soon";
  return (
    React.createElement("div", {
      style: S.card,
      className: "cx-mkt-card",
      onClick: () => onOpen(mod),
    },
      React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
        React.createElement("span", { style: S.badge(soon ? "soon" : "ok") },
          soon ? "Coming Soon" : typeBadge(mod.type)),
        !soon && React.createElement("span", { style: { ...S.badge("ok"), opacity: 0.6 } },
          typeBadge(mod.type))
      ),
      React.createElement("h3", { style: S.name }, mod.name),
      React.createElement("p", { style: S.desc },
        (mod.description || "").slice(0, 140) + ((mod.description || "").length > 140 ? "…" : "")),
      React.createElement("div", { style: S.meta },
        (mod.author || "—") + " · " + (mod.license || "—") + " · " + fmtSize(mod.size_kb)),
      React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4 } },
        installed
          ? React.createElement("span", { style: { ...S.meta, color: "var(--cx-accent, #7ee0ff)" } },
              "✓ Installed")
          : React.createElement("button", {
              style: soon ? { ...S.pill, opacity: 0.4, cursor: "not-allowed" } : S.pill,
              disabled: soon || busy,
              onClick: (e: React.MouseEvent) => { e.stopPropagation(); if (!soon) onInstall(mod); },
            }, busy ? "Installing…" : (soon ? "Coming Soon" : "Install"))
      )
    )
  );
}
