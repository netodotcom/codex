// app — cross-device sync settings (migrated from app.jsx). Personal-link sync
// via a private GitHub Gist (default) or Firebase. The QR encodes only the app
// URL, never the token.
import React from "react";
import { aw } from "./app-window.js";

const { useState, useEffect } = React;

export function SyncQR({ data, size = 180 }: { data: string; size?: number }): React.ReactElement {
  const [errored, setErrored] = useState(false);
  const enc = encodeURIComponent(data);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${enc}`;
  if (errored) {
    return (
      <div className="cx-sync-qr-fallback">
        <a href={data} target="_blank" rel="noopener noreferrer">{data}</a>
      </div>
    );
  }
  return (
    <div className="cx-sync-qr">
      <img src={src} alt="QR code" width={size} height={size} onError={() => setErrored(true)} />
      <a className="cx-sync-qr-link" href={data} target="_blank" rel="noopener noreferrer">{data.length > 48 ? data.slice(0, 48) + "…" : data}</a>
    </div>
  );
}

export function SyncHelpModal({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="cx-syncmod-scrim" onMouseDown={onClose}>
      <div className="cx-syncmod" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cross-device sync tutorial">
        <div className="cx-syncmod-hd">
          <b>How Cross-device sync works</b>
          <button className="cx-syncmod-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cx-syncmod-body">
          <section>
            <h4>What this does</h4>
            <p>Every device you use opens the same CODEX — your marks, notes, settings, cached scripture, and Oracle history follow you. Mark a verse on your phone, see it on your laptop within ~60s.</p>
          </section>
          <section>
            <h4>What stays on each device (never syncs)</h4>
            <ul>
              <li><b>API keys</b> — each device keeps its own. Security.</li>
              <li><b>Boot intro toggle</b> — per-device preference.</li>
              <li>Session-only state like the open tab.</li>
            </ul>
          </section>
          <section>
            <h4>Where your data lives</h4>
            <p>In a <b>private GitHub Gist owned by you</b>. CODEX creates one file (<code>codex-sync.json</code>) the first time you connect. Only requests signed with your token can read it — GitHub's servers enforce that. I never see your data, your token, or your gist.</p>
          </section>
          <section>
            <h4>Setup, first device</h4>
            <ol>
              <li>Click <b>Open GitHub token page</b> in the Sync section. GitHub opens with the right permission (<code>gist</code>) pre-checked.</li>
              <li>Scroll down → <b>Generate token</b>.</li>
              <li>Copy the <code>ghp_…</code> string.</li>
              <li>Paste it back in CODEX → <b>Connect &amp; create personal gist</b>.</li>
            </ol>
          </section>
          <section>
            <h4>Adding more devices</h4>
            <ol>
              <li>Once connected, expand <b>"Add another device →"</b>.</li>
              <li>Scan the QR code with the new device's camera — it opens CODEX.</li>
              <li>In Settings on the new device, paste the SAME GitHub token.</li>
              <li>App finds your existing gist and joins the sync.</li>
            </ol>
            <p className="cx-syncmod-aside">The QR contains <b>only the app URL</b>, never your token. Re-pasting on the new device is the safe way to authorise it (URLs leak through history, screenshots, screen shares — tokens shouldn't).</p>
          </section>
          <section>
            <h4>Sync rhythm</h4>
            <ul>
              <li><b>Push:</b> 1.5s after any local change (when auto-sync is on).</li>
              <li><b>Pull:</b> every 60s while the tab is open.</li>
              <li>Manual <b>↑ Push now</b> / <b>↓ Pull now</b> always available.</li>
              <li>Conflicts: per-key last-write-wins, merged against last known remote — keys edited only on Device A and keys edited only on Device B both survive.</li>
            </ul>
          </section>
          <section>
            <h4>Privacy &amp; cost</h4>
            <ul>
              <li><b>Cost:</b> $0. GitHub gists are free, unlimited for personal use.</li>
              <li><b>Access:</b> only people with your token can read the gist.</li>
              <li><b>Revoking:</b> github.com/settings/tokens → delete the CODEX token. All devices immediately lose sync (their local data is untouched).</li>
              <li><b>Wiping remote:</b> github.com → gists → delete the <code>codex-sync.json</code> gist. Next push recreates it from the current device's state.</li>
            </ul>
          </section>
          <section>
            <h4>Troubleshooting</h4>
            <ul>
              <li>"Token is missing the 'gist' scope" → the token wasn't created with the gist box checked. Use the in-app <b>Open GitHub token page</b> button — it pre-checks it.</li>
              <li>Marks don't appear on Device B → tap <b>↓ Pull now</b>. Auto-pull is 60s, manual is instant.</li>
              <li>Got the token confused with the API key → API keys (<code>sk-ant-…</code>) are for the Oracle. Sync uses a GitHub PAT (<code>ghp_…</code>). They live in separate boxes.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function FirebaseSetupBlock(): React.ReactElement {
  const [cfgText, setCfgText] = useState(() => {
    const c = aw().CODEX_SYNC?.firebase?.getConfig();
    return c ? JSON.stringify(c, null, 2) : "";
  });
  const [err, setErr] = useState("");
  const save = (): void => {
    setErr("");
    try {
      const parsed = JSON.parse(cfgText.trim()) as Record<string, unknown>;
      const need = ["apiKey", "authDomain", "projectId", "appId"];
      const missing = need.filter((k) => !parsed[k]);
      if (missing.length) {
        setErr("Missing: " + missing.join(", "));
        return;
      }
      aw().CODEX_SYNC?.firebase.setConfig(parsed);
      window.location.reload();
    } catch (e) {
      setErr("Invalid JSON: " + (e as Error).message);
    }
  };
  return (
    <>
      <ol>
        <li>console.firebase.google.com → Add project</li>
        <li>Auth → Sign-in method → Google → Enable</li>
        <li>Firestore Database → Create database</li>
        <li>Project settings → Add web app → copy <code>firebaseConfig</code></li>
        <li>Paste JSON below + add Firestore rule:{" "}
          <code>match /users/{"{"}uid{"}"}/{"{"}document=**{"}"} {"{"} allow read, write: if request.auth.uid == uid; {"}"}</code>
        </li>
      </ol>
      <textarea className="cx-sync-cfg" placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..." }' value={cfgText} onChange={(e) => setCfgText(e.target.value)} rows={6} spellCheck={false} />
      {err ? <p className="cx-sync-err">{err}</p> : null}
      <button className="cx-mini-btn" onClick={save} disabled={!cfgText.trim()}>Save Firebase config &amp; reload</button>
    </>
  );
}

type SyncUser = { name?: string; email?: string; photo?: string } | null;
type SyncLast = { at?: number; direction?: string; changed?: number; count?: number } | null;

export function SyncSection(): React.ReactElement {
  const [backend, setBackendState] = useState(() => aw().CODEX_SYNC?.getBackend() || "");
  const [user, setUser] = useState<SyncUser>(() => aw().CODEX_SYNC?.user || null);
  const [last, setLast] = useState<SyncLast>(() => aw().CODEX_SYNC?.getLast() || null);
  const [auto, setAuto] = useState(() => aw().CODEX_SYNC?.getAuto() || false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => 0);
  const [pat, setPat] = useState("");
  const [link, setLink] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const sync = aw().CODEX_SYNC;
    if (!sync) return;
    setNow(Date.now());
    const offAuth = sync.on("auth", (info) => {
      setUser(info.user ?? null);
      setBackendState(info.backend || "");
      if (info.user && info.backend === "github") {
        const gl = sync.github.getGistLink?.();
        if (gl) setLink(gl);
      } else {
        setLink("");
      }
    });
    const offSynced = sync.on("synced", (info) => setLast(info));
    const offErr = sync.on("error", (e) => setErr(e.message || ""));
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      offAuth();
      offSynced();
      offErr();
      clearInterval(tick);
    };
  }, []);

  const fmtAgo = (tms?: number): string => {
    if (!tms) return "—";
    const s = Math.floor((now - tms) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };

  const connectGithub = async (): Promise<void> => {
    if (!pat.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await aw().CODEX_SYNC!.github.connect(pat.trim());
      setLink(r.gistLink || "");
      setPat("");
    } catch (e) {
      setErr((e as Error).message || String(e));
    }
    setBusy(false);
  };
  const disconnect = async (): Promise<void> => {
    const sync = aw().CODEX_SYNC!;
    if (backend === "github") sync.github.disconnect();
    else if (backend === "firebase") await sync.firebase.signOut();
    setUser(null);
    setBackendState("");
    setLink("");
  };
  const pushNow = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      await aw().CODEX_SYNC!.pushNow();
    } catch (e) {
      setErr((e as Error).message || String(e));
    }
    setBusy(false);
  };
  const pullNow = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      await aw().CODEX_SYNC!.pullOnce();
    } catch (e) {
      setErr((e as Error).message || String(e));
    }
    setBusy(false);
  };
  const copyLink = async (): Promise<void> => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setErr("");
    } catch {
      /* ignore */
    }
  };

  const helpBtn = (
    <button className="cx-sync-help-btn" onClick={() => setHelpOpen(true)} title="How sync works" aria-label="Open sync tutorial">?</button>
  );

  if (!backend || !user) {
    return (
      <div className="cx-sync">
        <SyncHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <div className="cx-sync-titlebar">
          <span>Cross-device sync</span>
          {helpBtn}
        </div>
        <div className="cx-sync-setup">
          <p className="cx-sync-hint">Sync your marks, notes, settings, and cached scripture across every device you use. Setup takes about 30 seconds — your data lives in a private gist owned by your GitHub account; only your token can read it.</p>
          <div className="cx-sync-steps">
            <div className="cx-sync-step">
              <span className="cx-sync-step-n">1</span>
              <div>
                <b>Get your GitHub token</b>
                <p>Click below — opens GitHub with the right scope (<code>gist</code>) pre-checked. Scroll down and hit <b>Generate token</b>, then copy.</p>
                <button
                  className="cx-mini-btn"
                  onClick={() => {
                    const url = "https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist";
                    const w = window.open(url, "codex-gh-token", "width=900,height=700,noopener,noreferrer");
                    if (!w) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >⚡ Open GitHub token page</button>
                <details className="cx-sync-help">
                  <summary>On a phone? Scan this with your laptop instead</summary>
                  <SyncQR data="https://github.com/settings/tokens/new?description=CODEX%20sync&scopes=gist" size={160} />
                </details>
              </div>
            </div>
            <div className="cx-sync-step">
              <span className="cx-sync-step-n">2</span>
              <div>
                <b>Paste the token here</b>
                <p>App will create your private gist and turn on sync.</p>
                <input className="cx-sync-cfg" type="password" placeholder="ghp_..." value={pat} onChange={(e) => setPat(e.target.value)} spellCheck={false} autoComplete="off" style={{ fontFamily: "ui-monospace, monospace", padding: "10px", height: "auto" }} onKeyDown={(e) => { if (e.key === "Enter") void connectGithub(); }} />
                {err ? <p className="cx-sync-err">{err}</p> : null}
                <button className="cx-mini-btn" onClick={connectGithub} disabled={busy || !pat.trim()}>{busy ? "Connecting…" : "Connect & create personal gist"}</button>
              </div>
            </div>
          </div>
          <details className="cx-sync-help">
            <summary>Or use Firebase (Google sign-in, more setup)</summary>
            <FirebaseSetupBlock />
          </details>
        </div>
      </div>
    );
  }

  const loc = window.location;
  return (
    <div className="cx-sync">
      <SyncHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="cx-sync-titlebar">
        <span>Cross-device sync</span>
        {helpBtn}
      </div>
      <div className="cx-sync-active">
        <div className="cx-sync-user">
          {user.photo ? <img src={user.photo} alt="" className="cx-sync-avatar" referrerPolicy="no-referrer" /> : null}
          <div>
            <b>{user.name || user.email || "(connected)"}</b>
            <em>{backend === "github" ? "GitHub Gist" : "Firebase · " + (user.email || "")}</em>
          </div>
        </div>
        {link ? (
          <div className="cx-sync-link">
            <span>Your personal sync gist:</span>
            <div className="cx-sync-link-row">
              <input className="cx-sync-link-input" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="cx-mini-btn cx-sync-tiny" onClick={copyLink}>copy</button>
              <a className="cx-mini-btn cx-sync-tiny" href={link} target="_blank" rel="noopener noreferrer">open ↗</a>
            </div>
            <details className="cx-sync-help" style={{ marginTop: 6 }}>
              <summary><b>Add another device →</b> two ways</summary>
              <div className="cx-sync-join">
                <p className="cx-sync-hint">
                  <b>Quick path:</b> open <a href={loc.origin + loc.pathname} target="_blank" rel="noopener noreferrer">{loc.host + loc.pathname}</a> on the other device, open <b>Settings → Cross-device sync</b>, and paste the same GitHub token (the one starting <code>ghp_</code>). It will find this gist and join the sync.
                </p>
                <div className="cx-sync-qr-block">
                  <SyncQR data={loc.origin + loc.pathname} size={160} />
                  <div>
                    <p className="cx-sync-hint" style={{ margin: 0 }}>Scan this with your phone camera to open CODEX there, then paste your token. <b>Your token never leaves this device</b> — re-pasting it on the new device is the secure way to authorise it.</p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : null}
        <div className="cx-sync-status">
          <span>Last sync:</span>
          <b>{last ? `${fmtAgo(last.at)} · ${last.direction === "up" ? "↑ pushed" : "↓ pulled"}${last.changed ? ` ${last.changed} keys` : last.count ? ` ${last.count} keys` : ""}` : "never"}</b>
        </div>
        <div className="cx-sync-row">
          <button className="cx-mini-btn" onClick={pushNow} disabled={busy}>↑ Push now</button>
          <button className="cx-mini-btn" onClick={pullNow} disabled={busy}>↓ Pull now</button>
          <label className="cx-sync-auto">
            <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); aw().CODEX_SYNC!.setAuto(e.target.checked); }} />
            <span>auto-sync on change</span>
          </label>
        </div>
        <div className="cx-sync-row">
          <button className="cx-mini-btn cx-sync-tiny" onClick={disconnect} disabled={busy}>Disconnect</button>
        </div>
        {err ? <p className="cx-sync-err">{err}</p> : null}
      </div>
    </div>
  );
}
