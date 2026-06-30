// panels — chrome components (Backlog 4.1). Migrated from panels.jsx: the small
// presentational pieces every panel shares (collapsible section, pane header,
// cache badge, status/empty/error states, regen + save buttons).
import React, { useState } from "react";
import { humanAgo } from "./format.js";
import { pad } from "./util.js";
import { tx } from "./tx.js";

export interface CacheMeta {
  seed?: boolean;
  fromCache?: boolean;
  fetchedAt?: number;
  fresh?: boolean;
}

export function CacheBadge({ meta }: { meta?: CacheMeta | null }): React.ReactElement | null {
  if (!meta) return null;
  if (meta.seed) return <span className="cx-cache-pill is-seed">{tx("panel.seed", "▣ SEED · BUILT-IN")}</span>;
  if (meta.fromCache) {
    const ago = humanAgo(meta.fetchedAt || 0);
    return (
      <span
        className="cx-cache-pill is-cached"
        title={meta.fetchedAt ? `Fetched ${new Date(meta.fetchedAt).toLocaleString()}` : "Cached — fetched date unknown"}
      >
        ✓ CACHED · OFFLINE{ago ? ` · ${ago}` : ""}
      </span>
    );
  }
  if (meta.fresh) return <span className="cx-cache-pill is-fresh">✦ JUST FETCHED · NOW CACHED</span>;
  return null;
}

export function PaneHead({
  title,
  sub,
  action,
  meta,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  meta?: CacheMeta | null;
}): React.ReactElement {
  return (
    <div className="cx-pane-head">
      <div>
        <h3>{title}</h3>
        <span>{sub}</span>
        {meta ? <CacheBadge meta={meta} /> : null}
      </div>
      <div className="cx-pane-head-deco">
        {action || (
          <>
            <span className="cx-deco-dot" />
            <span className="cx-deco-dash" />
            <span className="cx-deco-dot" />
          </>
        )}
      </div>
    </div>
  );
}

export function RegenBtn({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button className="cx-regen" onClick={onClick} title="Re-draft via Oracle">
      <span className="cx-regen-dot" />
      {tx("panel.redraft", "REDRAFT")}
    </button>
  );
}

export function PanelMarkBtn({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      className="cx-panel-mark"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Save this reading to your notes"
      aria-label="Save to notes"
    >
      ✎ save
    </button>
  );
}

export interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  title: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  count?: number;
  children?: React.ReactNode;
}

export function Collapsible({
  open: openProp,
  defaultOpen = true,
  title,
  sub,
  accent,
  count,
  children,
}: CollapsibleProps): React.ReactElement {
  const controlled = typeof openProp === "boolean";
  const [openS, setOpenS] = useState(defaultOpen);
  const open = controlled ? openProp : openS;
  return (
    <section className={`cx-coll ${open ? "is-open" : ""}`}>
      <button className="cx-coll-h" onClick={() => !controlled && setOpenS((o) => !o)}>
        <span className="cx-coll-arr" aria-hidden>
          ▾
        </span>
        <span className="cx-coll-title">
          {accent ? <i className="cx-coll-accent" style={{ background: accent }} /> : null}
          {title}
        </span>
        {typeof count === "number" ? <span className="cx-coll-count">{pad(count)}</span> : null}
        {sub ? <span className="cx-coll-sub">{sub}</span> : null}
      </button>
      <div className="cx-coll-body">{children}</div>
    </section>
  );
}

export interface PanelStatusState {
  loading?: boolean;
  error?: string;
}

export function PanelStatus({
  status,
  passage,
  onRegenerate,
  kind,
}: {
  status: PanelStatusState;
  passage: { book: string; chapter: number };
  onRegenerate: () => void;
  kind: string;
}): React.ReactElement {
  if (status.loading) {
    return (
      <div className="cx-pane-status is-loading">
        <div className="cx-pane-spin">
          <i />
          <i />
          <i />
        </div>
        <b>
          DRAFTING {kind.toUpperCase()} · {passage.book} {passage.chapter}
        </b>
        <span>oracle is composing scholarly companions across traditions…</span>
      </div>
    );
  }
  if (status.error) {
    return (
      <div className="cx-pane-status is-err">
        <b>{tx("panel.offline", "ORACLE OFFLINE")}</b>
        <span>{status.error}</span>
        <button className="cx-pane-retry" onClick={onRegenerate}>
          {tx("panel.retry", "↻ RETRY")}
        </button>
      </div>
    );
  }
  const ref = `${passage.book} ${passage.chapter}`;
  const emptyBody = tx("panel.empty.body", "Generate companion material for {ref}.").replace("{ref}", ref);
  return (
    <div className="cx-pane-status">
      <b>{tx("panel.empty", "NO PANEL CACHE")}</b>
      <span>{emptyBody}</span>
      <button className="cx-pane-retry" onClick={onRegenerate}>
        {tx("panel.draft", "✦ DRAFT VIA ORACLE")}
      </button>
    </div>
  );
}
