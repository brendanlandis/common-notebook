"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { ArrowDownIcon, MetronomeIcon } from "@phosphor-icons/react";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useLocation } from "@/app/hooks/useLocation";
import { getToday, shiftISODate, toISODate, wallClockNow } from "@/app/lib/dateUtils";
import { sunsetOn } from "@/app/lib/sunset";
import { groupByProject, partitionSelected, isPracticeMaterial } from "@/app/lib/reviewLists";
import { usePracticeSessionUI } from "@/app/contexts/PracticeSessionContext";
import { useProjects, withProjectWorld } from "@/app/hooks/useProjects";
import { canViewTransition } from "@/app/lib/viewTransition";
import { useReviewCovering } from "../hooks/useReview";
import { useDailyPick } from "../hooks/useDailyPick";
import { useCompleteTask } from "../hooks/useCompleteTask";
import { useArrival } from "../hooks/useArrival";
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

  const { openFor } = usePracticeSessionUI();
  const { review, loading: reviewLoading } = useReviewCovering(today);
  const { pick, loading: pickLoading, savePick, saveError } = useDailyPick(today);
  const { location } = useLocation();
  const { events, loading: calendarLoading } = useCalendarEvents(today, tomorrow);
  const { toggleComplete } = useCompleteTask(today);
  const arriving = useArrival(calendarLoading);

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

  /**
   * The review's tasks, with each one's World stitched back on.
   *
   * `/api/reviews` populates `tasks.project` but not the project's `worldRef`,
   * so every task arrives with `project.world` undefined — and this page decides
   * which lane a task belongs in by exactly that. Without the join every piece
   * of practice material read as an ordinary task: it got a checkbox, and
   * clicking it completed the piece instead of opening the practice screen.
   *
   * Joined client-side rather than populated server-side, because that is what
   * every other task list here does (`useTasks` and the three done-view lists
   * all go through `withProjectWorld`) — and because the world would otherwise
   * reach this page by a different route from every other page, which is two
   * sources of truth for one fact.
   */
  const { projectsById } = useProjects();
  const reviewTasks = useMemo(
    () => (review?.tasks ?? []).map((task) => withProjectWorld(task, projectsById)),
    [review, projectsById]
  );

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

  // The two lanes, split the same way the review page splits them — and here it
  // matters for a second reason: material has no checkbox. Practicing is not
  // something you tick off, so the two lists cannot share a control.
  const { material, ordinary } = useMemo(() => {
    const material: typeof reviewTasks = [];
    const ordinary: typeof reviewTasks = [];
    for (const task of reviewTasks) {
      (isPracticeMaterial(task) ? material : ordinary).push(task);
    }
    return { material, ordinary };
  }, [reviewTasks]);

  // Same shape as the review page: what's chosen lifts out of the pool, and the
  // pool is grouped by project. Here the chosen ones land in the checkbox list
  // rather than in a row of pills.
  const { picked, remaining } = useMemo(
    () => partitionSelected(groupByProject(ordinary), selected),
    [ordinary, selected]
  );

  const practice = useMemo(
    () => partitionSelected(groupByProject(material), selected),
    [material, selected]
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
    const container = calendarRef.current;
    if (!container) return;

    const measure = () => {
      const line = container.querySelector<HTMLElement>(
        ".fc-timegrid-now-indicator-line"
      );
      if (!line) {
        setNowOffset(null);
        return null;
      }
      const offset =
        line.getBoundingClientRect().top - container.getBoundingClientRect().top;
      setNowOffset(offset);
      return offset;
    };

    /**
     * Measure every frame until the answer stops changing.
     *
     * Two failures this replaces, both of which showed up as the list sitting at
     * the top of its column instead of beside the current hour.
     *
     * FullCalendar draws the now-indicator after its own first layout pass, some
     * unknown number of frames after this effect — so a single
     * `requestAnimationFrame` was usually too early, and the next measurement
     * was whenever the events arrived. The list waited several seconds for the
     * feeds to answer a question the clock had already answered.
     *
     * And measuring once as soon as the line exists is also too early: the grid
     * is still settling, and the line moved ~36px after the first frame it
     * appeared in. So this stops when the same value comes back a few times
     * running, not when it first gets one.
     */
    let raf = 0;
    const settle = () => {
      let frames = 0;
      let steady = 0;
      let last: number | null = null;

      const tick = () => {
        const offset = measure();
        steady = offset !== null && offset === last ? steady + 1 : 0;
        last = offset;
        // Three frames of agreement, or a second of trying. Beyond that it's
        // waiting on something that isn't coming, and the observer below picks
        // up anything that turns up later.
        if (steady >= 3 || ++frames > 60) return;
        raf = requestAnimationFrame(tick);
      };

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    settle();

    // The line moves whenever the grid is laid out again — when the events
    // arrive and widen the visible hours, when the window resizes, when the
    // column reflows. One observer covers all three, and each time it fires the
    // measurement has to settle again for the same reason as above.
    const observer = new ResizeObserver(() => settle());
    observer.observe(container);

    // And it moves on its own as the day passes.
    const ticking = window.setInterval(measure, 60_000);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearInterval(ticking);
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
          {/* Today's practice, in the same column as the tasks — it is part of
              what you are doing today, not a separate shelf above the day. It
              leads the column: practice is what gets skipped when it comes
              after a list of things that can be ticked off, which is the same
              reason it leads on the periodic review.
              Inside `daily-chosen`, so it sits under the same now-offset as the
              tasks and the whole column starts level with the current hour. */}
          {practice.picked.length > 0 && (
            <section className="daily-practice">
              <ul>
                {practice.picked.map((task) => (
                  <li key={task.documentId}>
                    {/* An icon, not a checkbox. A checkbox beside a task means done
                        everywhere else in this app, and practice is measured in
                        minutes spent, not in being finished — so it borrows no
                        control that would say otherwise. Pressing it opens the
                        practice modal ready to go; pressing the name does the same,
                        because the whole row is one intention.
                        The button carries the view-transition name so the pill
                        tweens up out of the pool below, exactly as a task does. */}
                    <button
                      type="button"
                      className="daily-practice-item"
                      style={{ viewTransitionName: `pill-${task.documentId}` }}
                      onClick={() => openFor(task)}
                    >
                      <MetronomeIcon size={22} weight="regular" aria-hidden="true" />
                      {/* One text flow, so the subject follows the last word of a
                          wrapped title rather than sitting off at the row's right
                          edge — see the same nesting in `TaskPickList`. */}
                      <span>
                        {task.title}
                        {task.project?.title && (
                          <span className="review-pick-project">{task.project.title}</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="daily-unpick"
                      aria-label={`put ${task.title} back`}
                      onClick={() => toggle(task.documentId)}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                      traveling. The label is shrink-wrapped to about a pill's
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
                  {/* Back to the pool.
                      A separate control because the row already has one, and it
                      means what a checkbox means everywhere else in this app:
                      done. Overloading the title to un-pick would have been free
                      in pixels and expensive in convention — a task's name is
                      not a button anywhere else here.
                      Right-aligned rather than trailing the text, so the arrows
                      line up in a column the way the checkboxes do; a control
                      that lands in a different place on every row reads as
                      clutter even when it's the same control. */}
                  <button
                    type="button"
                    className="daily-unpick"
                    aria-label={`put ${task.title} back`}
                    onClick={() => toggle(task.documentId)}
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </button>
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
            arriving={arriving}
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

      {/* Material committed to this cycle but not picked up today.
          Leads the pools, the same way it leads the periodic review — a separate
          question, asked first. Below the tasks it is the section you have
          already scrolled past by the time you reach it. */}
      {practice.remaining.length > 0 && (
        <section className="review-section review-practice">
          <h2>could practice</h2>
          {practice.remaining.map((group) => (
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

      {/* The pool, same as the review page's: pick one and it lifts out, up into
          the list above. */}
      {remaining.length > 0 && (
        <section className="review-section">
          {/* What's left of what you committed to this cycle, minus whatever
              you've already lifted out of it into today. Phrased as an
              invitation rather than a promise: "not yet but soon" said when,
              which is exactly what this feature refuses to say. */}
          <h2>could work on</h2>
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
