// verse-menu — self-injected CSS (migrated verbatim from verse-menu.jsx).
// Idempotent <style id="cx-vm-min-style"> appended to <head> on module load.
// The legacy ran this as an IIFE; we replicate the identical side-effect here.

export const CX_VM_CSS = `
.cx-vm.cx-vm-min { min-width: 218px; max-width: 260px; }
.cx-vm-verbs { display: flex; gap: 4px; padding: 6px 8px 4px; }
.cx-vm-verb {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: none; border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
  border-radius: 8px; color: inherit; cursor: pointer; padding: 7px 2px 5px;
  font: inherit;
}
.cx-vm-verb i { font-style: normal; font-size: 15px; line-height: 1; }
.cx-vm-verb span { font-size: 8.5px; letter-spacing: 0.12em; opacity: 0.55; }
.cx-vm-verb:hover, .cx-vm-verb:focus-visible {
  border-color: var(--cx-accent, #7ee0ff);
  color: var(--cx-accent, #7ee0ff);
  outline: none;
}
.cx-vm-min .cx-vm-row { gap: 9px; }
.cx-vm-min .cx-vm-row .cx-vm-sub { margin-left: auto; }
`;

export function injectVmCss(): void {
  try {
    if (typeof document === "undefined" || document.getElementById("cx-vm-min-style")) return;
    const s = document.createElement("style");
    s.id = "cx-vm-min-style";
    s.textContent = CX_VM_CSS;
    document.head.appendChild(s);
  } catch {}
}

// Run on module load — matches the legacy IIFE side-effect exactly.
injectVmCss();
