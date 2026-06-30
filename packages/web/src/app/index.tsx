// app — migrated feature entry (Backlog 4.6). Replaces dist/app.js in the Vite
// build (gen-web-entry maps it): the top-level error boundary + the React root
// mount, exactly as the legacy app.jsx tail did. Runs the one-time IDB→LS API
// key hydration on import (the legacy ran it as a module-load IIFE).
import React from "react";
import { App } from "./App.js";
import { hydrateKeysFromIdb } from "./api-keys.js";

hydrateKeysFromIdb();

// Top-level error boundary — render a friendly recovery message instead of a
// blank page. The boot-splash polls for #root having children, so even the
// error block dismisses the splash gracefully.
class CodexAppBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  constructor(p: { children: React.ReactNode }) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err: Error): { err: Error } {
    return { err };
  }
  override componentDidCatch(err: Error, info: { componentStack?: string }): void {
    console.error("[CODEX] App boundary caught:", err, info && info.componentStack);
  }
  override render(): React.ReactNode {
    if (this.state.err) {
      return React.createElement(
        "div",
        { style: { padding: "60px 40px", color: "#c9d6e6", background: "#06080e", height: "100vh", overflow: "auto", fontFamily: "ui-monospace, Menlo, monospace" } },
        React.createElement("h1", { style: { color: "#7ee0ff", fontFamily: "Cormorant Garamond, serif", fontWeight: 400, fontSize: 28 } }, "CODEX hit a snag."),
        React.createElement("p", { style: { color: "#6b7c95", fontSize: 13, marginBottom: 24 } }, "The app caught a render error. Try clearing caches and reloading."),
        React.createElement(
          "button",
          {
            style: { background: "transparent", color: "#7ee0ff", border: "1px solid #7ee0ff", padding: "10px 18px", fontFamily: "inherit", fontSize: 12, letterSpacing: ".1em", cursor: "pointer", borderRadius: 4 },
            onClick: async () => {
              try {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) await r.unregister();
                const ks = await caches.keys();
                for (const k of ks) await caches.delete(k);
              } catch {
                /* ignore */
              }
              location.reload();
            },
          },
          "↺ CLEAR CACHE + RELOAD",
        ),
        React.createElement("pre", { style: { marginTop: 36, color: "#ff8291", fontSize: 11, whiteSpace: "pre-wrap", opacity: 0.85 } }, String(this.state.err.message || ""), "\n\n", String(this.state.err.stack || "")),
      );
    }
    return this.props.children;
  }
}

interface ReactDOMRoot {
  render(node: React.ReactNode): void;
}
interface ReactDOMApi {
  createRoot(el: Element): ReactDOMRoot;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  const ReactDOM = (window as unknown as { ReactDOM: ReactDOMApi }).ReactDOM;
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(CodexAppBoundary, null, React.createElement(App)));
}
