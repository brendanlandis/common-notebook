"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTasks } from "@/app/(main)/todo/hooks/useTasks";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useReviewCadence } from "@/app/hooks/useReviewCadence";
import {
  computeReviewPeriod,
  defaultReviewMode,
  type ReviewPeriodMode,
} from "@/app/lib/reviewCycle";
import { cadenceIsUsable, cycleNoun } from "@/app/lib/reviewCadence";
import { buildReviewLists, partitionSelected, type ProjectGroup } from "@/app/lib/reviewLists";
import { wallClockNow } from "@/app/lib/dateUtils";
import { canViewTransition } from "@/app/lib/viewTransition";
import { leaveThenUpdate } from "../leaveThenUpdate";
import { useReviewCovering, useSaveReview } from "../hooks/useReview";
import { useArrival } from "../hooks/useArrival";
import { useCycleSlide } from "../hooks/useCycleSlide";
import { useCalendarEvents, useSetDecision } from "../hooks/useCalendarEvents";
import { isFullyDecided, undecided, type ResolvedInstance } from "@/app/lib/ics/resolveDecisions";
import TaskPickList from "../components/TaskPickList";
import WeekCalendar from "../components/WeekCalendar";

/**
 * One project's worth of pills, under its name.
 *
 * The heading carries the project, so the pills don't repeat it — that muted
 * second label on every pill was a good part of what made the ungrouped list
 * dense. Tasks with no project sit under "incidentals", which is what this app
 * has always called them.
 */
function ProjectGroupList({
  group,
  selected,
  onToggle,
}: {
  group: ProjectGroup;
  selected: Set<string>;
  onToggle: (documentId: string) => void;
}) {
  return (
    <div className="review-group">
      <h3>{group.projectTitle ?? "incidentals"}</h3>
      <TaskPickList
        tasks={group.tasks}
        selected={selected}
        onToggle={onToggle}
        showProject={false}
      />
    </div>
  );
}

/**
 * The review itself: look at what's on your plate and pick a few things.
 *
 * The output is a `review` row holding a period and a task selection, written as
 * you pick rather than on a submit — see `toggle`. The daily page reads it back.
 * There is no scoring, no carry-over from last time, and no "leftovers" list —
 * each review opens on the same blank slate, which is what keeps it a planning
 * ritual rather than a report card.
 */
export default function PeriodicReviewPage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { tasks, loading: tasksLoading } = useTasks();
  const { cadence, loading: cadenceLoading } = useReviewCadence();
  const { createReview, updateReview, error } = useSaveReview();

  /**
   * The mode, chosen or defaulted.
   *
   * Held as "what the user picked, if they picked" rather than seeded with a
   * default, because the default depends on the cadence and the cadence arrives
   * from a query. Seeding state would mean either an effect that overwrites the
   * mode a moment after the page appears — moving the calendar under the
   * cursor — or a `key` remount. Deriving it costs nothing and is correct on the
   * first paint.
   */
  const [chosenMode, setChosenMode] = useState<ReviewPeriodMode | null>(null);
  const mode =
    chosenMode ??
    (cadence
      ? defaultReviewMode(cadence, timeZoneSettings, { anchorDate: cadence.anchorDate })
      : "remainder");
  /**
   * Switching cycles slides the grid out and the new one in.
   *
   * Without an animation the calendar was the one thing on the page that changed
   * by jumping — the columns, the dates and the hours all swapped at once — and
   * a cross-fade between two weeks turned out to be very nearly invisible: same
   * columns, same hours, only the dates differ. A slide says which direction you
   * went, which is the entire content of this control.
   *
   * `useCycleSlide` rather than a view transition, for a reason worth reading
   * before changing it back: the period change sets off a *second*,
   * asynchronous DOM change that removes named elements, and that kills a view
   * transition partway through. See the hook.
   */
  const cycle = useCycleSlide();
  const setMode = (next: ReviewPeriodMode) => {
    cycle.run(next === "upcoming" ? "forward" : "back", () => setChosenMode(next));
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ignored events stay out of the way by default. They were kept on the grid so
  // you could change your mind about one, but a week's worth of struck-through
  // things you already dismissed is most of what you'd be looking at — the
  // opposite of seeing what the week actually is.
  const [showIgnored, setShowIgnored] = useState(false);

  const period = useMemo(() => {
    if (!cadence) return null;
    return computeReviewPeriod(cadence, timeZoneSettings, {
      mode,
      anchorDate: cadence.anchorDate,
    });
  }, [cadence, timeZoneSettings, mode]);

  // The period decides which recurring tasks belong here — the ones that come
  // round during it. Null while the cadence is still loading, in which case
  // nothing is filtered; that render path shows the "needs more detail" message
  // rather than a list.
  const lists = useMemo(() => buildReviewLists(tasks, period), [tasks, period]);

  const { events, calendars, loading: calendarLoading } = useCalendarEvents(
    period?.periodStart ?? null,
    period?.periodEnd ?? null
  );
  const { setDecision } = useSetDecision();
  const arriving = useArrival(calendarLoading);

  /**
   * Clicking an event walks unset → show → hide → unset.
   *
   * The decision is written at the tier the user is looking at: for a recurring
   * event whose state came from its series (or from nowhere), the write is
   * series-level, so deciding once about a standup covers every future one.
   * Only an event already carrying its own override keeps overriding.
   */
  const cycleEvent = (instance: ResolvedInstance, element: HTMLElement) => {
    const next =
      instance.state === "unset" ? "show" : instance.state === "show" ? "hide" : null;

    // Calling an event fake takes it off the grid unless the ignored ones are
    // being shown, so it fades before it goes. Every other step of the cycle
    // repaints in place and needs nothing.
    const willVanish = next === "hide" && !showIgnored;
    leaveThenUpdate(willVanish ? [element] : [], () =>
      setDecision({
        calendar: instance.calendarDocumentId,
        uid: instance.uid,
        recurrenceId: instance.source === "instance" ? instance.recurrenceId : null,
        state: next,
      })
    );
  };

  /**
   * Folding the fake ones away, or bringing them back.
   *
   * This one change does three different things to the grid at once: events
   * leave, events arrive, and the *real* events that overlap them grow or shrink
   * as FullCalendar re-runs its overlap layout. Animating those separately would
   * mean owning all three, and the third has no hook at all — the widths are
   * inline styles FullCalendar computes.
   *
   * A view transition does all three for free, because it animates the
   * difference between two rendered states rather than any particular element's
   * story. It's available here where a decision can't use one: `showIgnored` is
   * local state, so `flushSync` has something to flush. The checkbox flips in the
   * same frame, which an earlier deferred version got wrong — a checkbox that
   * doesn't move for most of a second is the one thing a checkbox must never do.
   *
   * No `view-transition-name` on the events themselves. The default root
   * snapshot cross-fades the whole grid, which is what makes the width changes
   * legible; naming each event would tween them individually, and the names
   * would have to stay stable across a change that reorders the very list they
   * are derived from.
   */
  const revealIgnored = (show: boolean) => {
    if (canViewTransition()) {
      document.startViewTransition(() => flushSync(() => setShowIgnored(show)));
    } else {
      setShowIgnored(show);
    }
  };

  // The counts below deliberately read the *whole* set, not the filtered one:
  // hiding the ignored ones is a display choice and must not change what the
  // review says is left to decide.
  const stillUnset = undecided(events);
  const ignoredCount = events.filter((event) => event.state === "hide").length;
  // Nothing undecided and nothing fake on screen means every block is a real
  // event, which needs no key.
  const needsLegend = !isFullyDecided(events) || showIgnored;
  // Memoized because a fresh array each render would rebuild the calendar's
  // event list every time anything else on the page changes.
  const shownEvents = useMemo(
    () => (showIgnored ? events : events.filter((event) => event.state !== "hide")),
    [events, showIgnored]
  );

  // An existing review for this period means we're re-running one; its selection
  // seeds the pills rather than starting empty, and further picks update it
  // instead of leaving two reviews covering the same days.
  const { review: existing, loading: reviewLoading } = useReviewCovering(
    period?.periodStart ?? null
  );

  /**
   * The review being written into, once one exists.
   *
   * A ref rather than the query's answer, because the query cannot keep up with
   * clicking: the first pick creates a review, and a second pick landing before
   * that POST resolves would see no existing review and create a *second* one
   * covering the same days.
   */
  const reviewId = useRef<string | null>(null);

  /**
   * Seed the selection from the stored review, once per period.
   *
   * Guarded by a key rather than a dependency list, because this must happen
   * exactly once for a given period: the query refetches after every save, and
   * re-seeding from it would overwrite a pick made while the save was in flight.
   * Switching modes changes the period, which is a different review, so it seeds
   * again — deliberately.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!period || reviewLoading) return;
    const key = `${period.periodStart}..${period.periodEnd}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    reviewId.current = existing?.documentId ?? null;
    setSelected(new Set((existing?.tasks ?? []).map((task) => task.documentId)));
  }, [period, existing, reviewLoading]);

  /**
   * Saves, serialized.
   *
   * Every pick is its own write, so they have to queue: two overlapping writes
   * would be a lost update at best, and at worst a create racing a create. The
   * chain swallows failures so one rejected save doesn't wedge every later one —
   * the error surfaces through the mutation's own state, which is rendered.
   */
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const persist = (taskIds: string[]) => {
    if (!period || !cadence) return;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        if (reviewId.current) {
          await updateReview({ documentId: reviewId.current, tasks: taskIds });
        } else {
          const created = await createReview({
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            cycleType: cadence.recurrenceType,
            anchorDate: cadence.anchorDate,
            tasks: taskIds,
          });
          reviewId.current = created?.data?.documentId ?? null;
        }
      });
  };

  // Picked tasks move out of their project group and into a list of their own at
  // the top. Derived rather than held: `selected` is the state, and a second
  // copy of "which ones" would be a second thing to keep in step with it.
  const { picked, remaining } = useMemo(
    () => partitionSelected(lists.groups, selected),
    [lists.groups, selected]
  );

  // The practice lane partitions the same way against the same `selected` set —
  // one selection, stored in one `review.tasks` relation, rendered as two steps.
  // Splitting the *storage* would have meant a schema change and a second thing
  // for the daily page to read; splitting only the presentation is what the
  // attention budget actually needed.
  const practice = useMemo(
    () => partitionSelected(lists.practiceGroups, selected),
    [lists.practiceGroups, selected]
  );

  /**
   * Picking a task saves it. There is no commit button.
   *
   * The button was a second step that added nothing: a review is a handful of
   * picks, not a form, and having to confirm them made the page feel like
   * something you could get wrong. Every pick is reversible by clicking it
   * again, which is a better guarantee than a submit button ever was.
   */
  const toggle = (documentId: string) => {
    const next = new Set(selected);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);

    /**
     * The pill moves between the two lists, so the move is animated.
     *
     * `flushSync` is what makes this work: `startViewTransition` snapshots the
     * page, runs the callback, and snapshots again, so the DOM has to be updated
     * *inside* it. React's normal batching would defer the re-render past the
     * second snapshot, and the browser would tween the page against itself and
     * animate nothing.
     */
    if (canViewTransition()) {
      document.startViewTransition(() => flushSync(() => setSelected(next)));
    } else {
      setSelected(next);
    }

    // Outside the transition: it's a network write, and holding the second
    // snapshot open until the server answered would freeze the page mid-morph.
    persist([...next]);
  };

  if (cadenceLoading || tasksLoading) return <div className="review-page">loading...</div>;

  if (!cadence || !cadenceIsUsable(cadence)) {
    return (
      <div className="review-page">
        <h1>periodic review</h1>
        <p>
          your review cadence needs a little more detail before it can work out a
          period — have a look in settings.
        </p>
      </div>
    );
  }

  // "week", "month", "moon phase" — whatever one period of this cadence is.
  const noun = cycleNoun(cadence);

  return (
    <div className="review-page">
      <h1>periodic review</h1>

      {/* The period used to be spelled out here as a date range. The calendar
          below is a week of labelled day columns, so it was saying the same
          thing twice — and less clearly. */}

      {/* One row of controls, immediately above the grid: which cycle on the
          left, the key and the reveal on the right.

          It lives outside the calendar's section deliberately. The section is
          conditional on there being calendars to show, and the cycle switch must
          not disappear with them — someone with no calendars is still reviewing
          a week and still choosing which one.

          Two radios became one switch because it is a binary with a natural
          order: this cycle, then the next. `name` is what the e2e spec locates
          it by, since the labels are cadence-dependent and a test matching their
          text would break the moment the account changed its review schedule. */}
      <div className="review-controls">
        <label className="review-mode">
          <span className={mode === "remainder" ? "is-current" : undefined}>
            this {noun}
          </span>
          <input
            type="checkbox"
            role="switch"
            className="toggle"
            name="review-mode"
            checked={mode === "upcoming"}
            onChange={(event) => setMode(event.target.checked ? "upcoming" : "remainder")}
          />
          <span className={mode === "upcoming" ? "is-current" : undefined}>
            next {noun}
          </span>
        </label>

        {/* A key to glyphs that are on the grid, and nothing more. Once the week
            is fully decided and the fake ones are folded away, every block is a
            real event and there is nothing left to explain — so the key goes and
            only the reveal remains. */}
        {events.length > 0 && (needsLegend || ignoredCount > 0) && (
          <div className="review-legend">
            {needsLegend && stillUnset.length > 0 && (
              <span>
                <i className="swatch swatch-unset" aria-hidden="true" />? undecided
              </span>
            )}
            {needsLegend && (
              <span>
                <i className="swatch swatch-show" aria-hidden="true" />✓ real
              </span>
            )}
            {/* Only while they're on screen — a key to a symbol you can't see is
                just more to read. */}
            {needsLegend && showIgnored && (
              <span>
                <i className="swatch swatch-hide" aria-hidden="true" />✕ fake
              </span>
            )}
            {/* Only offered when there's something to reveal — an empty checkbox
                promising nothing is just another control to read past. Last in
                the row so it doesn't move as the keys beside it come and go. */}
            {ignoredCount > 0 && (
              <label className="review-legend-toggle">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={showIgnored}
                  onChange={(event) => revealIgnored(event.target.checked)}
                />
                show all
              </label>
            )}
          </div>
        )}
      </div>

      {/* The calendar's job here is to show what the week already is, so the
          intentions below get chosen against it rather than in a vacuum. Not to
          hold the tasks — nothing on this page ever becomes a calendar entry. */}
      {/* The grid renders as soon as the period is known, and the spinner sits
          over it while the feeds are polled — rather than the whole section
          appearing at once when the slowest calendar answers. The week's shape
          is knowable without the network, so there's no reason to withhold it,
          and a page that grows a large block several seconds after load is worse
          than one that fills a block that was already there.

          It does still vanish for someone with no calendars at all: an empty
          grid promising events that can never arrive would be a worse lie than
          showing nothing. `calendars` is only known once the query answers,
          hence the `calendarLoading ||`. */}
      {period && (calendarLoading || calendars.length > 0) && (
        <section className="review-section review-calendar-section">
          {/* No heading. It's a labelled seven-day grid — anything written over
              it is a caption on a photograph of itself. The key and the controls
              sit in the row above, outside this section. */}
          <div className={`review-calendar-frame${cycle.phase ? ` ${cycle.phase}` : ""}`}>
            <WeekCalendar
              events={shownEvents}
              periodStart={period.periodStart}
              periodEnd={period.periodEnd}
              now={wallClockNow(timeZoneSettings)}
              arriving={arriving}
              onCycle={cycleEvent}
            />
            {calendarLoading && (
              <div className="review-calendar-loading" role="status">
                <span className="loading loading-spinner" aria-hidden="true" />
                <span className="sr-only">fetching your calendars</span>
              </div>
            )}
          </div>
          {/* How much is left, while there is any left. Finishing says itself:
              the count stops, the key above disappears, and every block on the
              grid is a real event — a line announcing that you're done is a
              congratulation nobody asked for. */}
          {stillUnset.length > 0 && (
            <p className="review-hint">{stillUnset.length} still undecided</p>
          )}
          {calendars.some((c) => c.unreachable) && (
            <p className="error">
              couldn&apos;t reach:{" "}
              {calendars.filter((c) => c.unreachable).map((c) => c.name).join(", ")}
            </p>
          )}
        </section>
      )}

      {/* What you've picked, lifted clear of everything else.
          A picked pill that stays where it was makes you re-read the whole page
          to see what you chose; gathered at the top, the answer is the first
          thing you see.

          No project name here either, though there's no heading carrying it.
          With one, a pill changed width as it moved and the animation read as
          the thing growing rather than travelling — and a pill that is the same
          object in both places is what makes the move legible at all. */}
      {/* Practising, first and entirely on its own.
          Above the tasks rather than after them, and not sharing their lists at
          any point. Below, it is the thing that gets left: by the time you have
          read a page of things that can be finished and ticked, "play through
          the Bach" reads as the optional extra. Asking "what am I practising?"
          *before* "what am I doing?" is what makes it get an answer — and it is
          the whole reason practice lives in this app rather than beside it.

          Still one click, one `selected` set and one stored review. Only the
          order and the heading separate the two, which is all the separation the
          attention budget needed. */}
      {(practice.picked.length > 0 || practice.remaining.length > 0) && (
        <section className="review-section review-practice">
          <h2>practising this {noun}</h2>
          {practice.picked.length > 0 && (
            <TaskPickList
              tasks={practice.picked}
              selected={selected}
              onToggle={toggle}
              showProject={false}
            />
          )}
          {practice.remaining.map((group) => (
            <ProjectGroupList
              key={group.key}
              group={group}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </section>
      )}

      {picked.length > 0 && (
        <section className="review-section">
          {/* Named for the period it's a plan for, in the same words as the
              switch above — "this week" while you're reviewing this one, "next
              week" while you're reviewing the next. A fixed "this week" would be
              a lie half the time, and on a lunar or seasonal cadence it would be
              the wrong noun as well. */}
          <h2>
            {mode === "upcoming" ? "next" : "this"} {noun}
          </h2>
          <TaskPickList
            tasks={picked}
            selected={selected}
            onToggle={toggle}
            showProject={false}
          />
        </section>
      )}

      {/* One list, grouped by project.
          It was three — the top-of-mind project, `soon`, and recurring — which
          is a distinction that matters to the code deciding what belongs here
          and not to the person reading it. Whatever put a task on this page,
          it's on this page; the only grouping that helps while choosing is which
          project it's part of. */}
      {remaining.length > 0 && (
        <section className="review-section">
          {/* Everything you haven't picked, which is not the same as everything
              you're ignoring — hence the wording. It says "these are real and
              they're coming" without saying when, which is the whole line this
              feature walks. */}
          <h2>not yet but soon</h2>
          {remaining.map((group) => (
            <ProjectGroupList
              key={group.key}
              group={group}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </section>
      )}


      {lists.groups.length === 0 && lists.practiceGroups.length === 0 && (
        <p className="review-empty">nothing on your plate — enjoy it</p>
      )}

      {/* No commit button and no confirmation: a pick saves itself, and the
          pill going solid is the acknowledgement. A line reporting success under
          a page whose whole interaction is one click each is a receipt for
          something nobody doubted.

          The failure case does still show. Losing a pick is the one write here a
          person would notice, and with no button to press there is nothing else
          that would tell them. */}
      {error && (
        <p className="error">couldn&apos;t save that — {error.message}</p>
      )}
    </div>
  );
}
