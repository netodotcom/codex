// plans — the PLANS panel and its sub-views (migrated from plans.jsx). Today's
// readings with check-off, a 12-week activity heatmap, a full-plan progress
// calendar, catch-up, and daily reminders. Behaviour is identical to v1: only
// the file shape changed (pure logic lifted to helpers.ts/data.ts).
import React from "react";
import type { Plan, ParsedReading } from "./types.js";
import { BUNDLED_PLANS, loadPlan } from "./data.js";
import { pw } from "./plans-window.js";
import {
  parseReading,
  isoToday,
  isoOffset,
  daysBetween,
  readStart,
  writeStart,
  clearPlan,
  readCompleted,
  writeCompleted,
  readReminder,
  writeReminder,
  emitDepthAction,
  unifiedContinuity,
  computeStreak,
  countCompletedDays,
  scheduleReminder,
} from "./helpers.js";

const { useState, useEffect } = React;

// ───────────────────────────────────────────────────────────────────────
// StreakHeatmap — last 12 weeks activity grid from engagement engine
// ───────────────────────────────────────────────────────────────────────
export function StreakHeatmap(): React.ReactElement | null {
  const engage = pw().CODEX_ENGAGE;
  if (!engage) return null;

  const sk = engage.loadStreak();
  const today = isoToday();
  const cells: React.ReactElement[] = [];

  // Build 84 days ending today, aligned to week start (Sunday)
  const todayDate = new Date(today + "T00:00:00");
  const todayDow = todayDate.getDay(); // 0=Sun
  const startOffset = -(83 + todayDow); // start from first Sunday
  const totalDays = 84 + todayDow; // fill to complete the current week

  for (let i = 0; i < totalDays; i++) {
    const d = isoOffset(today, startOffset + i);
    const isActive = !!sk.history[d];
    const isToday = d === today;
    const isFuture = d > today;
    const cls =
      "cx-heatmap-cell" +
      (isActive ? " is-active" : "") +
      (isToday ? " is-today" : "") +
      (isFuture ? " is-future" : "");
    cells.push(
      <div key={d} className={cls} data-date={d} title={d + (isActive ? " ✓" : "")} />,
    );
  }

  const dows = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="cx-heatmap">
      <div className="cx-heatmap-head">READING ACTIVITY · LAST 12 WEEKS</div>
      <div className="cx-heatmap-grid">
        {dows.map((d, i) => (
          <div key={"dow" + i} className="cx-heatmap-dow">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// PlansPanel
// ───────────────────────────────────────────────────────────────────────
export function PlansPanel(_ctx: Record<string, unknown>): React.ReactElement {
  const [plans, setPlans] = useState<Plan[]>([]); // [{meta, days}]
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Load all bundled plans on mount
  useEffect(() => {
    let alive = true;
    Promise.all(BUNDLED_PLANS.map(loadPlan)).then((mods) => {
      if (!alive) return;
      const ok = mods.filter((m): m is Plan => !!m);
      setPlans(ok);
      // Auto-select first plan with a start date (i.e. an active one)
      const active = ok.find((p) => readStart(p.meta.id));
      setActiveId(active ? active.meta.id : ok[0]?.meta.id || null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const force = (): void => setTick((t) => t + 1);

  if (!plans.length) {
    return <div className="cx-plans-empty">Loading reading plans…</div>;
  }

  const activePlan = plans.find((p) => p.meta.id === activeId) || plans[0];
  if (!activePlan) return <div className="cx-plans-empty">Loading reading plans…</div>;

  return (
    <div className="cx-plans">
      <div className="cx-plans-head">
        <div className="cx-plans-title">READING PLANS</div>
        <div className="cx-plans-sub">Pick a cadence. Track every day. Keep the streak.</div>
      </div>

      <div className="cx-plans-list">
        {plans.map((p) => {
          const isActive = !!readStart(p.meta.id);
          return (
            <button
              key={p.meta.id}
              type="button"
              className={`cx-plan-card ${activeId === p.meta.id ? "is-open" : ""} ${isActive ? "is-started" : ""}`}
              onClick={() => setActiveId(p.meta.id)}
            >
              <div className="cx-plan-card-row">
                <span className="cx-plan-card-name">{p.meta.name}</span>
                {isActive ? <span className="cx-plan-badge">ACTIVE</span> : null}
              </div>
              <div className="cx-plan-card-meta">
                {p.meta.days} day{p.meta.days === 1 ? "" : "s"}
                {p.meta._partial ? " · preview" : ""}
              </div>
              <div className="cx-plan-card-desc">{p.meta.description}</div>
            </button>
          );
        })}
      </div>

      <StreakHeatmap />

      <PlanDetail plan={activePlan} onChange={force} key={activePlan.meta.id + ":" + tick} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// PlanDetail — Today, streak, calendar, catch-up, reminders
// ───────────────────────────────────────────────────────────────────────
export function PlanDetail({ plan, onChange }: { plan: Plan; onChange?: () => void }): React.ReactElement {
  const id = plan.meta.id;
  const [start, setStart] = useState<string | null>(readStart(id));
  const [completed, setCompleted] = useState<Set<string>>(() => readCompleted(id));
  const [reminder, setReminder] = useState<string>(() => readReminder(id));

  useEffect(() => {
    setStart(readStart(id));
    setCompleted(readCompleted(id));
    setReminder(readReminder(id));
  }, [id]);

  function persistCompleted(set: Set<string>): void {
    writeCompleted(id, set);
    setCompleted(new Set(set));
    onChange && onChange();
  }

  function startToday(): void {
    const today = isoToday();
    writeStart(id, today);
    setStart(today);
    onChange && onChange();
  }
  function resetPlan(): void {
    if (!confirm("Reset progress for this plan? Your check-marks and start date will be cleared.")) return;
    clearPlan(id);
    setStart(null);
    setCompleted(new Set());
    setReminder("");
    onChange && onChange();
  }

  if (!start) {
    return (
      <div className="cx-plan-detail">
        <div className="cx-plan-detail-empty">
          <p>
            You haven't started <b>{plan.meta.name}</b> yet.
          </p>
          <p className="cx-plan-detail-empty-sub">
            {plan.meta.days} days · {plan.days[0]?.readings?.length || 0}+ readings per day
          </p>
          <button type="button" className="cx-plan-btn cx-plan-btn-primary" onClick={startToday}>
            Begin today
          </button>
        </div>
      </div>
    );
  }

  const todayIso = isoToday();
  const dayNum = Math.max(1, daysBetween(start, todayIso) + 1);
  const totalDays = plan.days.length;
  const behind = Math.max(0, dayNum - 1 - countCompletedDays(plan, completed, dayNum - 1));
  // Display continuity from the UNIFIED engine when present; fall back to the
  // legacy local per-plan computation so the UI never breaks in Lite/offline.
  const cont = unifiedContinuity();
  const streak =
    cont && typeof cont.current === "number" ? cont.current : computeStreak(plan, completed);
  const longestStreak =
    cont && typeof cont.longest === "number"
      ? cont.longest
      : pw().CODEX_ENGAGE?.loadStreak?.()?.longest || streak;
  const day = plan.days.find((d) => d.day === Math.min(dayNum, totalDays));

  function toggleReading(d: number, idx: number): void {
    const key = `${d}.${idx}`;
    const next = new Set(completed);
    const wasDone = next.has(key);
    if (wasDone) next.delete(key);
    else next.add(key);
    persistCompleted(next);

    // Only checking ON is a depth action; un-checking never advances anything.
    if (!wasDone) {
      const dayEntry0 = plan.days.find((x) => x.day === d);
      const r = dayEntry0?.readings?.[idx];
      const parsed = r ? parseReading(r) : null;
      const ref = parsed?.navRef || (r ? `${id}#${d}.${idx}` : `${id}#${d}.${idx}`);
      // A single reading read → canon-coverage, chapter-weight (1).
      emitDepthAction("read", ref, 1, "canon-coverage");
    }

    // Check if all readings for this day are now complete
    const dayEntry = plan.days.find((x) => x.day === d);
    if (dayEntry) {
      const dayAllDone = dayEntry.readings.every((_, i) => next.has(`${d}.${i}`));
      if (dayAllDone && !wasDone) {
        // Fire celebration animation
        const el = document.querySelector(".cx-plan-detail");
        if (el) {
          el.classList.add("cx-plan-celebrate");
          setTimeout(() => el.classList.remove("cx-plan-celebrate"), 6000);
        }
        // Completing a full day of the plan is a closed plan-step thread —
        // routed through the UNIFIED continuity engine (depth-gated, central).
        emitDepthAction("plan-step", `${id}#${d}`, 4, "canon-coverage");
        // Legacy engagement engine (window.CODEX_ENGAGE) — kept intact so the
        // existing heatmap / achievements keep working. Guarded defensively.
        const engage = pw().CODEX_ENGAGE;
        if (engage) {
          try {
            engage.recordDay();
          } catch {}
          try {
            engage.checkAchievements();
          } catch {}
        }
      }
    }
  }

  function catchUp(): void {
    // Mark the most-recent missed day(s) as "addressed" by surfacing them.
    // Instead of auto-checking, scroll user through missed readings inline.
    // For simplicity: mark all readings of any uncompleted past day as complete.
    if (!confirm(`Mark all ${behind} missed day(s) as complete? You can also just read them and check them off manually.`)) return;
    const next = new Set(completed);
    for (let d = 1; d < dayNum; d++) {
      const entry = plan.days.find((x) => x.day === d);
      if (!entry) continue;
      const wasAllDone = entry.readings.every((_, idx) => next.has(`${d}.${idx}`));
      entry.readings.forEach((_, idx) => next.add(`${d}.${idx}`));
      // Newly-closed catch-up day → one plan-step into the unified engine.
      if (!wasAllDone) emitDepthAction("plan-step", `${id}#${d}`, 4, "canon-coverage");
    }
    persistCompleted(next);
  }

  function navigateReading(parsed: ParsedReading): void {
    if (!parsed.navRef) return;
    const jump = pw().codexJumpToRef;
    if (typeof jump === "function") {
      jump(parsed.navRef);
    }
  }

  function toggleReminder(): void {
    if (reminder) {
      writeReminder(id, "");
      setReminder("");
      return;
    }
    const t = prompt("Reminder time (24-hour HH:MM):", "08:00");
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return;
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          writeReminder(id, t);
          setReminder(t);
          scheduleReminder(plan, t);
        }
      });
    } else {
      writeReminder(id, t);
      setReminder(t);
      scheduleReminder(plan, t);
    }
  }

  return (
    <div className="cx-plan-detail">
      {(() => {
        const warn = pw().CODEX_ENGAGE?.streakWarning?.();
        if (!warn) return null;
        return (
          <div className="cx-streak-warn">
            <span className="cx-streak-warn-icon">🔥</span>
            <span>{warn.msg}</span>
          </div>
        );
      })()}
      <div className="cx-plan-detail-head">
        <div className="cx-plan-detail-name">{plan.meta.name}</div>
        <div className="cx-plan-detail-meta">
          Day <b>{Math.min(dayNum, totalDays)}</b> of {totalDays} ·
          <span className="cx-plan-streak">{" 🔥 "}{streak} day streak{streak === longestStreak ? " · personal best!" : ` · best: ${longestStreak}`}</span>
        </div>
      </div>

      {behind >= 2 ? (
        <div className="cx-plan-catchup">
          <span>
            You're <b>{behind}</b> day{behind === 1 ? "" : "s"} behind.
          </span>
          <button type="button" className="cx-plan-btn" onClick={catchUp}>
            ✓ Catch up
          </button>
        </div>
      ) : behind === 1 ? (
        <div className="cx-plan-catchup">
          <span>
            You're <b>1</b> day behind.
          </span>
        </div>
      ) : null}

      {day ? (
        <div className="cx-plan-today">
          <div className="cx-plan-today-label">TODAY · DAY {day.day}</div>
          {day.parshah ? (
            <div className="cx-plan-today-parshah">
              Parashat {day.parshah} (Year {day.year})
            </div>
          ) : null}
          <ul className="cx-plan-readings">
            {day.readings.map((r, idx) => {
              const parsed = parseReading(r);
              const done = completed.has(`${day.day}.${idx}`);
              return (
                <li key={idx} className={`cx-plan-reading ${done ? "is-done" : ""}`}>
                  <button
                    type="button"
                    className="cx-plan-check"
                    onClick={() => toggleReading(day.day, idx)}
                    aria-label={done ? "Mark unread" : "Mark read"}
                  >
                    {done ? "✓" : "○"}
                  </button>
                  <button
                    type="button"
                    className="cx-plan-readlink"
                    onClick={() => navigateReading(parsed)}
                    disabled={!parsed.navRef}
                  >
                    {parsed.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="cx-plan-done-all">
          <div className="cx-plan-done-glyph">✦</div>
          <p>You've finished the plan. Well done.</p>
        </div>
      )}

      <PlanCalendar plan={plan} completed={completed} start={start} />

      <div className="cx-plan-actions">
        <button type="button" className="cx-plan-btn" onClick={toggleReminder}>
          {reminder ? `Reminder at ${reminder} · tap to clear` : "Daily reminder…"}
        </button>
        <button type="button" className="cx-plan-btn cx-plan-btn-danger" onClick={resetPlan}>
          Reset plan
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// PlanCalendar — 7 row × 52 col heat-map of past completion
// ───────────────────────────────────────────────────────────────────────
export function PlanCalendar({
  plan,
  completed,
  start,
}: {
  plan: Plan;
  completed: Set<string>;
  start: string;
}): React.ReactElement {
  const todayIso = isoToday();
  const todayN = Math.max(1, daysBetween(start, todayIso) + 1);
  const totalDays = plan.days.length;
  const showDays = Math.min(totalDays, 7 * 52);

  function statusFor(d: number): string {
    const entry = plan.days.find((x) => x.day === d);
    if (!entry) return "future";
    const all = entry.readings.every((_, idx) => completed.has(`${d}.${idx}`));
    if (all) return "done";
    if (d < todayN) return "miss";
    if (d === todayN) return "today";
    return "future";
  }

  // Build grid: rows of 7, total ceil(showDays/7) cols.
  const cells: Array<{ d: number; status: string; dateIso: string }> = [];
  for (let d = 1; d <= showDays; d++) {
    const status = statusFor(d);
    const dateIso = isoOffset(start, d - 1);
    cells.push({ d, status, dateIso });
  }

  return (
    <div className="cx-plan-cal-wrap">
      <div className="cx-plan-cal-label">PROGRESS</div>
      <div
        className="cx-plan-cal"
        style={{ gridTemplateColumns: `repeat(${Math.ceil(showDays / 7)}, 8px)` }}
      >
        {cells.map((c) => (
          <span
            key={c.d}
            className={`cx-plan-cell is-${c.status}`}
            title={`Day ${c.d} · ${c.dateIso} · ${c.status}`}
          />
        ))}
      </div>
      <div className="cx-plan-cal-legend">
        <span className="cx-plan-cell is-done" /> done
        <span className="cx-plan-cell is-miss" /> missed
        <span className="cx-plan-cell is-today" /> today
        <span className="cx-plan-cell is-future" /> upcoming
      </div>
    </div>
  );
}
