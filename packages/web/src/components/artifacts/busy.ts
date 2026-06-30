// artifacts — the AI-BUSY bus + the orb (migrated VERBATIM from artifacts.jsx).
// window.CODEX_AI_BUSY {begin(label)→id, end(id)} dispatches codex:ai-busy
// {active, labels} and renders one small pulsing orb fixed bottom-right above the
// dock while any call is live. Installed once, on import (the legacy IIFE ran at
// module load); the guard means a pre-existing bus is never clobbered.
import { aw } from "./artifacts-window.js";
import { artEnsureCss } from "./style.js";

export function installBusyBus(): void {
  if (typeof window === "undefined" || aw().CODEX_AI_BUSY) return;
  let seq = 0;
  const active = new Map<number, string>(); // id → label

  function orbRender(): void {
    let orb = document.getElementById("cx-ai-orb");
    if (!active.size) {
      if (orb) orb.remove();
      return;
    }
    artEnsureCss();
    const labels = [...new Set(active.values())].join(" · ");
    if (!orb) {
      orb = document.createElement("div");
      orb.id = "cx-ai-orb";
      orb.setAttribute("role", "status");
      orb.setAttribute("aria-live", "polite");
      orb.tabIndex = 0;
      const lbl = document.createElement("span");
      lbl.className = "cx-ai-orb-lbl";
      const core = document.createElement("span");
      core.className = "cx-ai-orb-core";
      core.setAttribute("aria-hidden", "true");
      orb.appendChild(lbl);
      orb.appendChild(core);
      (document.body || document.documentElement).appendChild(orb);
    }
    const lblEl = orb.querySelector(".cx-ai-orb-lbl");
    if (lblEl) lblEl.textContent = labels; // textContent only — never HTML
    orb.setAttribute("aria-label", "AI processing: " + labels);
    (orb as HTMLElement).title = labels;
  }

  function fire(): void {
    try {
      window.dispatchEvent(
        new CustomEvent("codex:ai-busy", {
          detail: { active: active.size > 0, labels: [...active.values()] },
        }),
      );
    } catch {
      /* ignore */
    }
    try {
      orbRender();
    } catch {
      /* ignore */
    }
  }

  aw().CODEX_AI_BUSY = {
    begin(label: string): number {
      const id = ++seq;
      active.set(id, String(label || "AI"));
      fire();
      return id;
    },
    end(id: number): void {
      if (active.delete(id)) fire();
    },
    active(): boolean {
      return active.size > 0;
    },
  };
}

installBusyBus();
