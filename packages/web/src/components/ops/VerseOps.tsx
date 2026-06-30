// ops — VerseOps + OpsEvent + ArtifactBody + ArtifactBodyLegacy (migrated
// verbatim from ops.jsx). ZERO behaviour change: same DOM output, same event
// listeners, same side-effects. Only addition is TypeScript types and the
// ow() window accessor in place of bare `window.*` reads.
import React from "react";
import { injectOpsCSS } from "./style.js";
import { parseArtifactBody, artifactToMarkdown } from "./helpers.js";
import { ow } from "./ops-window.js";
import type {
  OpsArtifact,
  OpsArtifactSection,
  OpsHistoryMission,
  OpsKernelController,
} from "./ops-window.js";

const { useState, useEffect, useRef, useMemo } = React;

// ── Internal types ─────────────────────────────────────────────────────────

interface OpsMissionState {
  id: string;
  intent: string;
  status: string;
  artifact?: OpsArtifact;
  error?: string;
  live?: boolean;
  startedAt?: number;
  steps?: Array<{
    kind?: string;
    heading?: string;
    tool?: string;
    result?: unknown;
    failed?: boolean;
  }>;
}

// Discriminated union covering every event the kernel bus emits. The optional
// `id` field is present on bus-detail objects (used for mission matching) and
// on items pushed straight to the events feed state.
type OpsKernelEvent =
  | { id?: string; type: "start"; intent: string; maxSteps?: number }
  | { id?: string; type: "tool"; thought?: string; tool: string; args?: Record<string, unknown> }
  | { id?: string; type: "result"; tool?: string; result?: unknown; failed?: boolean }
  | { id?: string; type: "section"; section?: { heading?: string; body?: string } }
  | { id?: string; type: "done"; budget?: boolean; artifact?: OpsArtifact }
  | { id?: string; type: "error"; error?: string }
  | { id?: string; type: "abort" };

interface StudiesItem { type: string; body: string; _id: string; }
interface StudiesSection { id: string; heading: string; items: StudiesItem[]; }
interface StudiesStore { studies: unknown[]; activeStudyId: unknown; }

function isStudiesStore(v: unknown): v is StudiesStore {
  return v !== null && typeof v === "object" && Array.isArray((v as { studies?: unknown }).studies);
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface VerseOpsProps {
  seed?: string;
  onClose: () => void;
  onJumpRef?: (ref: string) => void;
}

export interface OpsEventProps {
  ev: OpsKernelEvent;
}

export interface ArtifactBodyProps {
  body?: string | null;
  onJumpRef?: ((ref: string) => void) | undefined;
}

// ── VerseOps ──────────────────────────────────────────────────────────────

export function VerseOps({ seed, onClose, onJumpRef }: VerseOpsProps): React.ReactElement {
  useEffect(() => { injectOpsCSS(); }, []);

  const [intent, setIntent] = useState(seed || "");
  const [mission, setMission] = useState<OpsMissionState | null>(null);
  const [events, setEvents] = useState<OpsKernelEvent[]>([]);
  const [history, setHistory] = useState<OpsHistoryMission[]>(() => {
    const k = ow().CODEX_KERNEL;
    return k ? k.missions() : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const ctlRef = useRef<OpsKernelController | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to the kernel bus for the live feed.
  useEffect(() => {
    const onK = (e: Event): void => {
      const d = ((e as CustomEvent<OpsKernelEvent | null | undefined>).detail) ?? null;
      if (!d || typeof d !== "object") return;
      if (!mission || d.id !== mission.id) {
        if (d.type === "start") {
          setMission({
            id: d.id ?? "",
            intent: d.intent,
            status: "running",
            artifact: { title: "", summary: "", sections: [] },
          });
          setEvents([{ type: "start", intent: d.intent, maxSteps: d.maxSteps }]);
        }
        return;
      }
      setEvents((prev) => [...prev, d]);
      if (d.type === "section") {
        const newSection: OpsArtifactSection = {
          heading: d.section?.heading ?? "",
          body: d.section?.body ?? "",
        };
        setMission((m) => {
          if (!m) return m;
          const art = m.artifact ?? { title: "", summary: "", sections: [] };
          return { ...m, artifact: { ...art, sections: [...art.sections, newSection] } };
        });
      } else if (d.type === "done") {
        setMission((m) => m ? { ...m, status: "done", artifact: d.artifact ?? m.artifact } : m);
        const k = ow().CODEX_KERNEL;
        if (k) setHistory(k.missions());
      } else if (d.type === "error" || d.type === "abort") {
        const errMsg = d.type === "error" ? d.error : undefined;
        setMission((m) => m ? { ...m, status: d.type, error: errMsg } : m);
        const k = ow().CODEX_KERNEL;
        if (k) setHistory(k.missions());
      }
    };
    window.addEventListener("codex:kernel", onK);
    return () => window.removeEventListener("codex:kernel", onK);
  }, [mission]);

  // Keep the feed pinned to the newest step.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  // ESC closes (unless a mission is mid-flight — then it aborts first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (mission?.status === "running" && ctlRef.current) { ctlRef.current.abort(); return; }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mission]);

  const launch = (): void => {
    const text = intent.trim();
    const k = ow().CODEX_KERNEL;
    if (!text || !k) return;
    if (mission?.status === "running") return;
    setEvents([]);
    setMission(null);
    ctlRef.current = k.run(text);
  };

  const abort = (): void => { if (ctlRef.current) ctlRef.current.abort(); };

  const openPast = (m: OpsHistoryMission): void => {
    setMission({ ...m, live: false });
    setEvents(
      (m.steps ?? []).map((s): OpsKernelEvent =>
        s.kind === "section"
          ? { type: "section", section: { heading: s.heading, body: "" } }
          : { type: "result", tool: s.tool, result: s.result, failed: s.failed }
      )
    );
    setShowHistory(false);
  };

  const copyArtifact = (): void => {
    const a = mission?.artifact;
    if (!a) return;
    const md = artifactToMarkdown(a, mission?.intent ?? "");
    try { navigator.clipboard.writeText(md); } catch { /* ignore */ }
    try {
      window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "◎ Artifact copied as markdown", kind: "ok" } }));
    } catch { /* ignore */ }
  };

  // Convert the artifact into a saved study (builder.jsx shape, codex.studies.v1).
  const saveAsStudy = (): void => {
    const a = mission?.artifact;
    if (!a) return;
    const uid = (prefix: string): string =>
      `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const sections: StudiesSection[] = [];
    if (a.summary) {
      sections.push({
        id: uid("section"),
        heading: "Summary",
        items: [{ type: "note", body: String(a.summary), _id: uid("item") }],
      });
    }
    for (const s of (a.sections ?? [])) {
      sections.push({
        id: uid("section"),
        heading: s.heading || "Section",
        items: [{ type: "note", body: String(s.body ?? ""), _id: uid("item") }],
      });
    }
    if (!sections.length) sections.push({ id: uid("section"), heading: "I. ", items: [] });
    const study = {
      id: uid("study"),
      title: a.title || mission?.intent || "Untitled study",
      created: now,
      modified: now,
      sections,
    };
    try {
      let store: StudiesStore;
      try {
        const raw = localStorage.getItem("codex.studies.v1") ?? "null";
        const parsed: unknown = JSON.parse(raw);
        store = isStudiesStore(parsed) ? parsed : { studies: [], activeStudyId: null };
      } catch { store = { studies: [], activeStudyId: null }; }
      store.studies.push(study);
      localStorage.setItem("codex.studies.v1", JSON.stringify(store));
      try { window.dispatchEvent(new CustomEvent("codex:studies-changed")); } catch { /* ignore */ }
      try {
        window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg: "✦ Saved to Studies", kind: "ok" } }));
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  };

  // Narrate the artifact (title, summary, then sections) via codexSpeak.
  const readArtifact = (): void => {
    const a = mission?.artifact;
    const speak = ow().codexSpeak;
    if (!a || typeof speak !== "function") return;
    const rawParts: Array<string | undefined> = [
      a.title || mission?.intent,
      a.summary,
      ...(a.sections ?? []).map((s) => `${s.heading}. ${s.body}`),
    ];
    const text = rawParts.filter((p): p is string => !!p).join(". ");
    speak(text);
  };

  const stopReading = (): void => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* ignore */ }
  };

  const canSpeak = typeof ow().codexSpeak === "function";
  const running = mission?.status === "running";
  const keyHint = !ow().CODEX_KERNEL ? "kernel not loaded" : null;

  const IB = ow().IntelBanner;
  const kernel = ow().CODEX_KERNEL;

  return (
    <div className="cx-ops-backdrop" onClick={onClose} role="dialog" aria-label="OPS — mission cockpit">
      <div className="cx-ops" onClick={(e) => e.stopPropagation()}>
        <span className="cx-corner cx-tl" /><span className="cx-corner cx-tr" />
        <span className="cx-corner cx-bl" /><span className="cx-corner cx-br" />

        <header className="cx-ops-h">
          <span className="cx-ops-h-tag">CODEX · OPS</span>
          <span className="cx-ops-h-status">
            {running ? <span className="cx-ops-live"><i />MISSION RUNNING</span>
              : mission?.status === "done" ? "MISSION COMPLETE"
              : mission?.status === "error" ? "MISSION FAILED"
              : mission?.status === "abort" ? "MISSION ABORTED"
              : "STANDING BY"}
          </span>
          <button className="cx-ops-hist" onClick={() => setShowHistory((h) => !h)} title="Past missions">
            ≣ MISSIONS {history.length ? `(${history.length})` : ""}
          </button>
          <button className="cx-ops-x" onClick={onClose} aria-label="Close" title="Close (ESC)">×</button>
        </header>

        {IB ? <IB console="OPS" scope="MISSION CONTROL" note="THE AGENT CALLS THE APP'S OWN TOOLS · EVERY RESULT COMPUTED LOCALLY · ARTIFACTS CITED" /> : null}

        <div className="cx-ops-intent">
          <textarea
            className="cx-ops-input"
            placeholder={'State your intent — e.g. "Trace the Logos from Genesis to Revelation and build me a cited study" or "How do the prophets and the gospels each use shepherd imagery?"'}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); launch(); } }}
            rows={2}
            disabled={running}
          />
          {running
            ? <button className="cx-ops-run is-abort" onClick={abort} title="Abort mission (ESC)">■ ABORT</button>
            : <button className="cx-ops-run" onClick={launch} disabled={!intent.trim() || !!keyHint} title="Launch mission (⌘↵)">▶ RUN</button>}
        </div>
        {keyHint ? <div className="cx-ops-warn">{keyHint}</div> : null}

        {showHistory ? (
          <div className="cx-ops-history">
            {history.length === 0 ? <p className="cx-ops-empty">No missions yet.</p> : (
              <ul>
                {history.map((m) => (
                  <li key={m.id} onClick={() => openPast(m)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") openPast(m); }}>
                    <b>{m.artifact?.title || m.intent}</b>
                    <span className={`cx-ops-hstat is-${m.status}`}>{m.status}</span>
                    <small>{(m.steps ?? []).length} steps · {new Date(m.startedAt).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {mission ? (
          <div className="cx-ops-mission">
            <div className="cx-ops-feed" ref={feedRef} aria-label="Mission step feed">
              {events.map((ev, i) => <OpsEvent key={i} ev={ev} />)}
              {running ? <div className="cx-ops-thinking"><i /><i /><i /></div> : null}
            </div>
            <div className="cx-ops-artifact" aria-label="Mission artifact">
              <h3 className="cx-ops-art-title">{mission.artifact?.title || mission.intent}</h3>
              {mission.artifact?.summary ? <p className="cx-ops-art-summary">{mission.artifact.summary}</p> : null}
              {(mission.artifact?.sections ?? []).map((s, i) => (
                <section key={i} className="cx-ops-art-sec">
                  <h4>{s.heading}</h4>
                  <ArtifactBody body={s.body} onJumpRef={onJumpRef} />
                </section>
              ))}
              {mission.status === "done" ? (
                <div className="cx-ops-art-actions">
                  <button onClick={copyArtifact} title="Copy the artifact as markdown">⎘ COPY MARKDOWN</button>
                  <button onClick={saveAsStudy} title="Save the artifact to the Studies tab">✦ SAVE AS STUDY</button>
                  {canSpeak ? <button onClick={readArtifact} title="Read the artifact aloud">▶ READ</button> : null}
                  {canSpeak ? <button onClick={stopReading} title="Stop reading">■</button> : null}
                </div>
              ) : null}
              {mission.status === "error" ? (
                <div className="cx-ops-error"><b>KERNEL FAULT</b><code>{mission.error}</code></div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="cx-ops-idle">
            <p className="cx-ops-idle-line">The kernel commands {kernel ? kernel.tools().length : 0} tools — search, passages, cross-references, gematria, the consoles.</p>
            <p className="cx-ops-idle-epigraph">"Ask, and it will be given to you; seek, and you will find." — Matt 7:7</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── OpsEvent ───────────────────────────────────────────────────────────────

// One event card in the feed.
export function OpsEvent({ ev }: OpsEventProps): React.ReactElement | null {
  if (ev.type === "start") {
    return <div className="cx-ops-ev is-start"><b>MISSION START</b><p>{ev.intent}</p></div>;
  }
  if (ev.type === "tool") {
    return (
      <div className="cx-ops-ev is-tool">
        {ev.thought ? <p className="cx-ops-ev-thought">{ev.thought}</p> : null}
        <code>▸ {ev.tool}({Object.entries(ev.args ?? {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")})</code>
      </div>
    );
  }
  if (ev.type === "result") {
    // Collapsible inline result: a one-line gist ("found 23 cross-refs…")
    // expands to the full tool output. <details> = keyboard-native.
    const full = String(ev.result ?? "");
    const lines = full.split("\n").map((s) => s.trim()).filter(Boolean);
    const first = lines[0] ?? "";
    const gist = ev.failed
      ? (first || "tool failed")
      : (lines.length > 1 ? `${lines.length} lines · ${first}` : (first || "(empty)"));
    return (
      <div className={`cx-ops-ev is-result ${ev.failed ? "is-failed" : ""}`}>
        <details>
          <summary title="Expand the full tool result">
            {ev.tool ? <b>{ev.tool}</b> : null}
            <span className="cx-ops-ev-gist">{gist.slice(0, 110)}</span>
          </summary>
          <pre>{full.slice(0, 1600)}</pre>
        </details>
      </div>
    );
  }
  if (ev.type === "section") {
    return <div className="cx-ops-ev is-section"><b>§ {ev.section?.heading}</b></div>;
  }
  if (ev.type === "done") {
    return <div className="cx-ops-ev is-done"><b>✓ MISSION COMPLETE{ev.budget ? " (step budget)" : ""}</b></div>;
  }
  if (ev.type === "error") {
    return <div className="cx-ops-ev is-failed"><b>✗ {ev.error}</b></div>;
  }
  if (ev.type === "abort") {
    return <div className="cx-ops-ev is-failed"><b>■ aborted</b></div>;
  }
  return null;
}

// ── ArtifactBody ────────────────────────────────────────────────────────────

// Artifact section body — renders through the shared CODEX_ARTIFACTS engine
// (rich markdown DOM, live ref chips with hover preview, codex:chart /
// codex:flow / codex:buttons / codex:verse-grid directives become real
// interactive SVG/buttons). Falls back to the legacy ref-chip renderer if
// the artifacts engine isn't loaded.
export function ArtifactBody({ body, onJumpRef }: ArtifactBodyProps): React.ReactElement {
  const A = ow().CODEX_ARTIFACTS;
  if (A && A.Rich) {
    return <div className="cx-ops-art-body"><A.Rich text={String(body ?? "")} /></div>;
  }
  return <ArtifactBodyLegacy body={body} onJumpRef={onJumpRef} />;
}

export function ArtifactBodyLegacy({ body, onJumpRef }: ArtifactBodyProps): React.ReactElement {
  const parts = useMemo(() => parseArtifactBody(String(body ?? "")), [body]);

  const jump = (ref: string): void => {
    if (typeof onJumpRef === "function") { onJumpRef(ref); return; }
    const fn = ow().codexJumpToRef;
    if (typeof fn === "function") fn(ref);
  };

  return (
    <p className="cx-ops-art-body">
      {parts.map((p, i) =>
        p.t === "ref"
          ? <button key={i} className="cx-ops-refchip" onClick={() => jump(p.v)} title={`Jump to ${p.v}`}>{p.v}</button>
          : <span key={i}>{p.v}</span>
      )}
    </p>
  );
}
