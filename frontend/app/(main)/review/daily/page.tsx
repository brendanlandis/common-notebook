"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useLocation } from "@/app/hooks/useLocation";
import { getToday, shiftISODate, toISODate, wallClockNow } from "@/app/lib/dateUtils";
import { sunsetOn } from "@/app/lib/sunset";
import { groupByProject, partitionSelected } from "@/app/lib/reviewLists";
import { canViewTransition } from "@/app/lib/viewTransition";
import { useReviewCovering } from "../hooks/useReview";
import { useDailyPick } from "../hooks/useDailyPick";
import { useCompleteTask } from "../hooks/useCompleteTask";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import TaskPickList from "../components/TaskPickList";
import WeekCalendar from "../components/WeekCalendar";

/**
 * What's on your plate today.
 *
 * Three things, in the order you'd want them: the handful you've chosen, beside
 * the shape of the day itself, over the pool you'd choose more from.
 *
 * The list on the left is the only place in this feature where a task can be
 * *completed*. Everything else here is planning — picking, deciding, looking —
 * and this is the one surface where the day is actually being worked. That's why
 * it has checkboxes and nothing else does: a checkbox beside a task means done,
 * and pretending otherwise anywhere else was a real misread.
 *
 * Narrowing to a few things is still optional. A day nobody narrowed leaves the
 * list empty and every task sitting in the pool below — which is a legible state
 * ("I haven't chosen yet"), not a broken one.
 */
export default function DailyReviewPage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const today = toISODate(getToday(timeZoneSettings), timeZoneSettings);
  const tomorrow = shiftISODate(today, 1);

  const { review, loading: reviewLoading } = useReviewCovering(today);
  const { pick, loading: pickLoading, savePick } = useDailyPick(today);
  const { location } = useLocation();
  const { events } = useCalendarEvents(today, tomorrow);
  const { toggleComplete } = useCompleteTask(today);

  // Only what you decided to be at. This is the reading surface, not the
  // deciding one — fake events are rendered on the review page precisely so you
  // can change your mind there. Anything still undecided shows: better an extra
  // line than a missed thing.
  const todaysEvents = useMemo(
    () => events.filter((event) => event.state !== "hide"),
    [events]
  );

  /**
   * Sunset on each day the grid shows.
   *
   * The one thing here that isn't on a clock. "How much of today is left" is a
   * question the light answers better than the hour does, which is the same
   * instinct this whole feature runs on — and the opposite of counting hours.
   */
  const sunsets = useMemo(() => {
    if (!location) return [];
    return [today, tomorrow]
      .map((date) => sunsetOn(date, location, timeZoneSettings))
      .filter((sunset): sunset is string => sunset !== null);
  }, [location, today, tomorrow, timeZoneSettings]);

  const reviewTasks = useMemo(() => review?.tasks ?? [], [review]);
  const pickedIds = useMemo(
    () => new Set((pick?.tasks ?? []).map((task) => task.documentId)),
    [pick]
  );

  // Same shape as the review page: what's chosen lifts out of the pool, and the
  // pool is grouped by project. Here the chosen ones land in the checkbox list
  // rather than in a row of pills.
  const { picked, remaining } = useMemo(
    () => partitionSelected(groupByProject(reviewTasks), pickedIds),
    [reviewTasks, pickedIds]
  );

  const toggle = (documentId: string) => {
    const next = new Set(pickedIds);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);

    // Animated, for the same reason as on the review page: the pill moves
    // between two containers, and only a view transition can tween that. See
    // `canViewTransition` for when it's skipped.
    if (canViewTransition()) {
      document.startViewTransition(() => flushSync(() => savePick([...next])));
    } else {
      savePick([...next]);
    }
  };

  /**
   * Line the day's list up with the current time.
   *
   * Measured rather than computed: the indicator's offset depends on the grid's
   * rendered height and its slot range, both of which FullCalendar decides. The
   * line moves as the day passes, so this re-measures on a timer as well as on
   * resize, and reads null before FullCalendar's first layout — and whenever now
   * falls outside the visible hours, in which case there is nothing to align to
   * and the list simply starts at the top.
   */
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [nowOffset, setNowOffset] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const container = calendarRef.current;
      const line = container?.querySelector<HTMLElement>(
        ".fc-timegrid-now-indicator-line"
      );
      if (!container || !line) {
        setNowOffset(null);
        return;
      }
      setNowOffset(
        line.getBoundingClientRect().top - container.getBoundingClientRect().top
      );
    };

    measure();
    // FullCalendar positions the line after its first layout pass, which is
    // after this effect runs.
    const settled = requestAnimationFrame(measure);
    const ticking = window.setInterval(measure, 60_000);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(settled);
      window.clearInterval(ticking);
      window.removeEventListener("resize", measure);
    };
  }, [todaysEvents, sunsets]);

  if (reviewLoading || pickLoading) return <div className="review-page">loading...</div>;

  if (!review) {
    return (
      <div className="review-page">
        <h1>today</h1>
        <p>no review covers today yet.</p>
      </div>
    );
  }

  return (
    <div className="review-page">
      <h1>today</h1>

      <div className="daily-layout">
        {/* Pushed down to meet the now-indicator, so "what I'm doing" starts
            level with "where the day has got to". Falls back to the top of the
            column when there's no line to meet. */}
        <div className="daily-chosen" style={{ paddingTop: nowOffset ?? 0 }}>
          {picked.length === 0 ? (
            <p className="review-empty">nothing chosen yet</p>
          ) : (
            <ul className="daily-todo">
              {picked.map((task) => (
                <li key={task.documentId}>
                  <label className={task.completed ? "is-done" : undefined}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={Boolean(task.completed)}
                      onChange={() =>
                        toggleComplete({
                          documentId: task.documentId,
                          isCurrentlyCompleted: Boolean(task.completed),
                        })
                      }
                    />
                    <span>{task.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="daily-calendar" ref={calendarRef}>
          <WeekCalendar
            events={todaysEvents}
            periodStart={today}
            periodEnd={tomorrow}
            now={wallClockNow(timeZoneSettings)}
            sunsets={sunsets}
            showNow
          />
        </div>
      </div>

      {/* The pool, same as the review page's: pick one and it lifts out, up into
          the list above. */}
      {remaining.length > 0 && (
        <section className="review-section">
          <h2>the rest of it</h2>
          {remaining.map((group) => (
            <div key={group.key} className="review-group">
              <h3>{group.projectTitle ?? "incidentals"}</h3>
              <TaskPickList
                tasks={group.tasks}
                selected={pickedIds}
                onToggle={toggle}
                showProject={false}
              />
            </div>
          ))}
        </section>
      )}

      {reviewTasks.length === 0 && (
        <p className="review-empty">this review didn&apos;t commit to anything</p>
      )}
    </div>
  );
}
