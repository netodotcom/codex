// jewish-study — JewishStudyPanel React component (migrated verbatim from
// jewish-study.jsx). Faithful reproduction: identical DOM structure, class
// names, event handlers, and side-effects. Quirks preserved as-is.
import React from "react";
import { jw } from "./jewish-study-window.js";
import type { ParshaModule, CalendarModule, DafModule, Holiday, HebrewDate } from "./jewish-study-window.js";
import {
  loadModule,
  approxHebrewDate,
  bookName,
  formatRef,
  jumpToRef,
  emitDepth,
  holidayGreg,
  daysUntilHoliday,
  pickParshaIndex,
  todaysDaf,
} from "./helpers.js";

// Internal: the `.catch` in the useEffect returns either valid module data or
// this error shape when loading fails — only ever lives inside the component.
interface WithErr {
  _err: string;
}
function hasErr(x: unknown): x is WithErr {
  return x !== null && typeof x === "object" && "_err" in x && typeof (x as WithErr)._err === "string";
}

export function JewishStudyPanel(): React.ReactElement {
  const [parsha, setParsha] = React.useState<ParshaModule | null>(null);
  const [cal, setCal] = React.useState<CalendarModule | null>(null);
  const [daf, setDaf] = React.useState<DafModule | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [parshaIdx, setParshaIdx] = React.useState<number | null>(null);
  const [showMonths, setShowMonths] = React.useState(false);
  const [showHolidays, setShowHolidays] = React.useState(false);
  const [holYear, setHolYear] = React.useState<number>(() => {
    try { return new Date().getFullYear(); } catch (_e) { return 2026; }
  });

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadModule("parsha").catch((e: unknown) => ({ _err: e instanceof Error ? e.message : String(e) })),
      loadModule("hebrew-calendar").catch((e: unknown) => ({ _err: e instanceof Error ? e.message : String(e) })),
      loadModule("plan-daf-yomi").catch(() => null), // optional
    ]).then(([p, c, d]) => {
      if (cancelled) return;
      if (hasErr(p) && hasErr(c)) setErr(p._err);
      if (p && !hasErr(p)) setParsha(p as ParshaModule);
      if (c && !hasErr(c)) {
        const cm = c as CalendarModule;
        setCal(cm);
        jw().CODEX_JEWISH_MONTHS_CACHE = cm.months;
      }
      if (d && !hasErr(d)) setDaf(d as DafModule);
      if (p && !hasErr(p)) {
        const pm = p as ParshaModule;
        if (Array.isArray(pm.parashot)) {
          setParshaIdx(pickParshaIndex(pm.parashot));
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const today = React.useMemo(() => new Date(), []);
  const heb: HebrewDate = React.useMemo(() => approxHebrewDate(today), [today, cal]);

  const parashot = (parsha && parsha.parashot) || [];
  const current = parshaIdx !== null ? parashot[parshaIdx] : null;

  // Holiday awareness
  const holidayInfo = React.useMemo(() => {
    if (!cal || !Array.isArray(cal.holidays)) return null;
    const withDays = cal.holidays
      .map((h): { h: Holiday; days: number | null } => ({ h, days: daysUntilHoliday(h, heb, cal.months) }))
      .filter((x): x is { h: Holiday; days: number } => x.days != null)
      .sort((a, b) => a.days - b.days);
    const upcoming = withDays.find((x) => x.days >= -3 && x.days <= 14);
    const next = withDays.find((x) => x.days > 14) ?? withDays[0];
    return { upcoming, next };
  }, [cal, heb]);

  const todayDaf = React.useMemo(() => todaysDaf(daf), [daf]);

  // ── Engagement: a daf view ──────────────────────────────────────────────
  // The panel only mounts when the user opens Jewish Study, so a truthy
  // todayDaf represents an actual Daf Yomi view. De-dupe per daf day so we
  // emit once per distinct daf (re-opening the same daf won't double-count).
  const lastDafRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!todayDaf) return;
    const dayKey = todayDaf.day != null ? String(todayDaf.day) : null;
    if (dayKey != null && lastDafRef.current === dayKey) return;
    lastDafRef.current = dayKey;
    const ref = dayKey != null
      ? "daf:" + dayKey
      : ((todayDaf.readings && todayDaf.readings[0]) || "daf");
    emitDepth("daf-read", ref, 3);
  }, [todayDaf]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const renderRefList = (refs: string[] | undefined | null): React.ReactNode => {
    if (!refs || refs.length === 0) return <span style={{ opacity: 0.6 }}>—</span>;
    return refs.map((r, i) => (
      <span key={i}>
        {i > 0 ? <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span> : null}
        <button className="cx-js-ref" onClick={() => jumpToRef(r)}>{formatRef(r)}</button>
      </span>
    ));
  };

  return (
    <div className="cx-js-pane">
      {/* ── Date strip ───────────────────────────────────────── */}
      <header className="cx-js-datestrip">
        <div className="cx-js-hebdate">
          <span className="cx-js-approx" title="Approximate — see help article">≈</span>
          <span className="cx-js-hebbig">
            {heb.day} <span className="cx-js-hebmonth">{heb.month.name || heb.month.translit}</span>
          </span>
          <span className="cx-js-translit">
            {heb.day} {heb.month.translit} {heb.year}
          </span>
        </div>
        <div className="cx-js-gregdate">
          {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </header>

      {err ? (
        <div className="cx-js-status cx-js-warn">Couldn't load Jewish study modules: {err}</div>
      ) : null}

      {/* ── This week's parsha ──────────────────────────────── */}
      {current ? (
        <section className="cx-js-parsha">
          <div className="cx-js-section-label">PARASHAT HASHAVUA · WEEK {current.n}/54</div>
          <div className="cx-js-parsha-name">{current.name}</div>
          <div className="cx-js-parsha-translit">
            {current.translit} <span className="cx-js-parsha-meaning">— "{current.meaning}"</span>
          </div>
          <div className="cx-js-parsha-readings">
            <div className="cx-js-reading-row">
              <span className="cx-js-reading-label">Torah</span>
              <button className="cx-js-ref cx-js-ref-lg" onClick={() => jumpToRef(current.torah)}>
                {formatRef(current.torah)}
              </button>
            </div>
            <div className="cx-js-reading-row">
              <span className="cx-js-reading-label">Haftarah</span>
              <button className="cx-js-ref cx-js-ref-lg" onClick={() => jumpToRef(current.haftarah)}>
                {formatRef(current.haftarah)}
              </button>
            </div>
          </div>
          <div className="cx-js-parsha-nav">
            <button className="cx-js-pill" onClick={() => setParshaIdx((i) => ((i ?? 0) - 1 + parashot.length) % parashot.length)}>← PREV</button>
            <button className="cx-js-pill cx-js-pill-today" onClick={() => setParshaIdx(pickParshaIndex(parashot))}>JUMP TO TODAY</button>
            <button className="cx-js-pill" onClick={() => setParshaIdx((i) => ((i ?? 0) + 1) % parashot.length)}>NEXT →</button>
          </div>
        </section>
      ) : !err ? <div className="cx-js-status">Loading parashot…</div> : null}

      {/* ── Holiday awareness ──────────────────────────────── */}
      {holidayInfo && holidayInfo.upcoming ? (
        <section className="cx-js-holiday-card">
          <div className="cx-js-section-label cx-js-gold">
            {holidayInfo.upcoming.days <= 0 ? "HAPPENING NOW" : `IN ${holidayInfo.upcoming.days} DAYS`}
          </div>
          <div className="cx-js-holiday-name">{holidayInfo.upcoming.h.hebrew}</div>
          <div className="cx-js-holiday-translit">
            {holidayInfo.upcoming.h.name} <span className="cx-js-dim">· {holidayInfo.upcoming.h.date}</span>
            {(() => {
              const g = holidayGreg(holidayInfo.upcoming!.h.date, (today && today.getFullYear ? today.getFullYear() : holYear));
              return g ? <span style={{ color: "var(--cx-accent)", marginLeft: 6 }}>· {g}</span> : null;
            })()}
          </div>
          <div className="cx-js-holiday-readings">
            <span className="cx-js-reading-label">Readings</span>
            <div className="cx-js-reading-refs">{renderRefList(holidayInfo.upcoming.h.readings)}</div>
          </div>
        </section>
      ) : holidayInfo && holidayInfo.next ? (
        <div className="cx-js-next-holiday">
          Next holiday: <b>{holidayInfo.next.h.name}</b> in {Math.max(0, holidayInfo.next.days)} days
        </div>
      ) : null}

      {/* ── Daf Yomi today ─────────────────────────────────── */}
      {todayDaf ? (
        <section className="cx-js-daf">
          <div className="cx-js-section-label">DAF YOMI · DAY {todayDaf.day}</div>
          <div className="cx-js-daf-refs">
            {todayDaf.readings.map((r, i) => (
              /* v10 — dapim are READABLE now: codexOpenText fetches the
                 page live from Sefaria into a floating text window. */
              <button key={i} type="button" className="cx-js-daf-ref is-live"
                title={`Open ${r.replace(/^talmud\./, "").replace(/\./g, " ")} (live from Sefaria)`}
                onClick={() => { const fn = jw().codexOpenText; if (fn) fn(r); }}>
                {r.replace(/^talmud\./, "").replace(/\./g, " ")}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Calendar reference ─────────────────────────────── */}
      {cal ? (
        <>
          <section className="cx-js-collapse">
            <button className="cx-js-collapse-head" onClick={() => setShowMonths((s) => !s)}>
              <span>{showMonths ? "▾" : "▸"}</span> All 12 Hebrew months
            </button>
            {showMonths ? (
              <table className="cx-js-table">
                <thead>
                  <tr><th>#</th><th>Hebrew</th><th>Translit</th><th>Gregorian</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {cal.months.map((m) => (
                    <tr key={m.n}>
                      <td>{m.n}</td>
                      <td className="cx-js-heb">{m.name}</td>
                      <td>{m.translit}</td>
                      <td className="cx-js-dim">{m.approxGregorian}</td>
                      <td className="cx-js-dim">{m.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>

          <section className="cx-js-collapse">
            <button className="cx-js-collapse-head" onClick={() => setShowHolidays((s) => !s)}>
              <span>{showHolidays ? "▾" : "▸"}</span> All major holidays
            </button>
            {showHolidays ? (
              <>
                <div className="cx-js-year-row" style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 10px", fontSize: "0.85em" }}>
                  <span className="cx-js-dim">Gregorian dates ·</span>
                  <button className="cx-js-ref" onClick={() => setHolYear((y) => y - 1)} aria-label="Previous year" title="Earlier year">◀</button>
                  <b style={{ minWidth: 42, textAlign: "center" }}>{holYear}</b>
                  <button className="cx-js-ref" onClick={() => setHolYear((y) => y + 1)} aria-label="Next year" title="Later year">▶</button>
                </div>
                <ul className="cx-js-holiday-list">
                  {cal.holidays.map((h) => {
                    const greg = holidayGreg(h.date, holYear);
                    return (
                      <li key={h.id} className="cx-js-holiday-li">
                        <div className="cx-js-holiday-li-head">
                          <span className="cx-js-heb">{h.hebrew}</span>
                          <span> · </span>
                          <span>{h.name}</span>
                          <span className="cx-js-dim"> · {h.date}</span>
                          {greg ? <span style={{ color: "var(--cx-accent)", marginLeft: 6 }}>· {greg}</span> : null}
                        </div>
                        <div className="cx-js-reading-refs">{renderRefList(h.readings)}</div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </section>
        </>
      ) : null}

      <footer className="cx-js-foot">
        Hebrew dates here are an approximation. A precise lunar-calendar engine is on the roadmap.
      </footer>
    </div>
  );
}
