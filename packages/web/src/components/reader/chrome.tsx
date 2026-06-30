// reader — visual primitives (migrated from components.jsx). The corner-framed
// container, the small pill, and the tick label used across the shell.
import React from "react";

export function CornerFrame({
  children,
  className = "",
  label,
  glow = false,
}: {
  children?: React.ReactNode;
  className?: string;
  label?: React.ReactNode;
  glow?: boolean;
}): React.ReactElement {
  return (
    <div className={`cx-frame ${glow ? "is-glow" : ""} ${className}`}>
      <span className="cx-corner cx-tl" />
      <span className="cx-corner cx-tr" />
      <span className="cx-corner cx-bl" />
      <span className="cx-corner cx-br" />
      {label ? <span className="cx-frame-label">{label}</span> : null}
      {children}
    </div>
  );
}

export function Pill({ children, dim, accent }: { children?: React.ReactNode; dim?: boolean; accent?: boolean }): React.ReactElement {
  return <span className={`cx-pill ${dim ? "is-dim" : ""} ${accent ? "is-accent" : ""}`}>{children}</span>;
}

export function Tick({ children, className = "" }: { children?: React.ReactNode; className?: string }): React.ReactElement {
  return <span className={`cx-tick ${className}`}>{children}</span>;
}
