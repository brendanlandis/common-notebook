"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  const { pick, loading: pickLoading, savePick, saveError } = useDailyPick(today);
  const { location } = useLocation();
  const { events, loading: calendarLoading } = useCalendarEvents(today, tomorrow);
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

  /**
   * The day's selection, held locally and saved behind itself.
   *
   * Rendering straight from the query looked equivalent and wasn't: the write
   * is optimistic, but `onMutate` awaits `cancelQueries` before touching the
   * cache, so the DOM changes a microtask *after* the click. That's invisible
   * on its own and fatal to a view transition, which snapshots the page around
   * a synchronous callback and would have found nothing changed — the pill
   * blinked out of one list and into the other, which is precisely the thing
   * the review page's animation exists to avoid.
   *
   * Seeded once per day rather than tracked, because the query refetches after
   * every save and re-seeding from it would undo a pick made while an earlier
   * save was still in the air. Same shape, and the same reason, as the review
   * page's `seededFor`.
   */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (pickLoading || seededFor.current === today) return;
    seededFor.current = today;
    setSelected(new Set((pick?.tasks ?? []).map((task) => task.documentId)));
  }, [today, pick, pickLoading]);

  // Same shape as the review page: what's chosen lifts out of the pool, and the
  // pool is grouped by project. Here the chosen ones land in the checkbox list
  // rather than in a row of pills.
  const { picked, remaining } = useMemo(
    () => partitionSelected(groupByProject(reviewTasks), selected),
    [reviewTasks, selected]
  );

  const toggle = (documentId: string) => {
    const next = new Set(selected);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);

    // Animated exactly as on the review page: the task moves between two
    // containers, and only a view transition can tween that. `flushSync` is
    // what makes it work — React's normal batching would defer the re-render
    // past the transition's second snapshot. See `canViewTransition` for when
    // it's skipped.
    if (canViewTransition()) {
      document.startViewTransition(() => flushSync(() => setSelected(next)));
    } else {
      setSelected(next);
    }

    // Outside the transition: it's a network write, and holding the second
    // snapshot open until the server answered would freeze the page mid-morph.
    savePick([...next]);
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
            column when there's no line to meet.
            Handed over as a custom property rather than as padding, because
            whether to apply it at all is a question about the layout — see
            `.daily-chosen`, which uses it only in the two-column form. */}
        <div
          className="daily-chosen"
          style={{ "--now-offset": `${nowOffset ?? 0}px` } as CSSProperties}
        >
          {picked.length === 0 ? (
            <p className="review-empty">nothing chosen yet</p>
          ) : (
            <ul className="daily-todo">
              {picked.map((task) => (
                <li key={task.documentId}>
                  {/* The same name the pill carries in the pool below, so
                      choosing a task tweens the one into the other rather than
                      blinking one out and the other in. A task is in exactly one
                      of the two places — `partitionSelected` moves rather than
                      copies — so the name is unique in the document, which it
                      has to be: duplicates make the browser abandon the whole
                      transition.
                      On the label rather than the `li`: a block-level `li` is as
                      wide as the column, and the browser scales the old shape to
                      the new one, so the pill grew across the page instead of
                      travelling. The label is shrink-wrapped to about a pill's
                      width. */}
                  <label
                    className={task.completed ? "is-done" : undefined}
                    style={{ viewTransitionName: `pill-${task.documentId}` }}
                  >
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

        {/* Grid first, spinner over it — same as the review page, and for the
            same reason: the day's hours are knowable without the network, and a
            page that grows a large block several seconds after load is worse
            than one that fills a block already there. It matters more here,
            since the list beside it is positioned against the grid's
            now-indicator and would otherwise be aligned to nothing. */}
        <div className="daily-calendar review-calendar-frame" ref={calendarRef}>
          <WeekCalendar
            events={todaysEvents}
            periodStart={today}
            periodEnd={tomorrow}
            now={wallClockNow(timeZoneSettings)}
            boundaryHour={timeZoneSettings.dayBoundaryHour}
            sunsets={sunsets}
            showNow
          />
          {calendarLoading && (
            <div className="review-calendar-loading" role="status">
              <span className="loading loading-spinner" aria-hidden="true" />
              <span className="sr-only">fetching your calendars</span>
            </div>
          )}
        </div>
      </div>

      {/* The pool, same as the review page's: pick one and it lifts out, up into
          the list above. */}
      {remaining.length > 0 && (
        <section className="review-section">
          {/* The same words the review page uses for the same pool, because it
              is the same pool — what's on your plate, minus whatever you've
              already lifted out of it. */}
          <h2>not yet but soon</h2>
          {remaining.map((group) => (
            <div key={group.key} className="review-group">
              <h3>{group.projectTitle ?? "incidentals"}</h3>
              <TaskPickList
                tasks={group.tasks}
                selected={selected}
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

      {/* The list moves on click and the save follows it, so a rejected write
          leaves the page looking right and the server disagreeing. Nothing else
          here would ever say so — there's no button whose spinner could stall. */}
      {saveError && (
        <p className="error">couldn&apos;t save that — {saveError.message}</p>
      )}
    </div>
  );
}
